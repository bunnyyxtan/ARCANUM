"use client";

import { ARC_NETWORK_BADGE } from "@arcanum/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Connector } from "wagmi";
import { ConnectorAlreadyConnectedError, useAccount, useConnect, useDisconnect } from "wagmi";

type WalletOption = { name: string; hint: string; logo: string; match: string[] };

const WALLET_OPTIONS: WalletOption[] = [
  {
    name: "MetaMask",
    hint: "Browser extension",
    logo: "/wallets/metamask.png",
    match: ["metamask", "io.metamask"],
  },
  {
    name: "Rabby",
    hint: "Browser extension",
    logo: "/wallets/rabby.png",
    match: ["rabby", "io.rabby"],
  },
  {
    name: "OKX Wallet",
    hint: "Extension · mobile",
    logo: "/wallets/okx.png",
    match: ["okx", "com.okex.wallet"],
  },
  {
    name: "Phantom",
    hint: "Extension · mobile",
    logo: "/wallets/phantom.png",
    match: ["phantom", "app.phantom"],
  },
  {
    name: "Coinbase Wallet",
    hint: "Extension · mobile",
    logo: "/wallets/coinbase.png",
    match: ["coinbase", "coinbasewalletsdk", "com.coinbase.wallet"],
  },
];

function matchesOption(connector: Connector, option: WalletOption): boolean {
  return option.match.some(
    (needle) =>
      connector.id.toLowerCase().includes(needle) || connector.name.toLowerCase().includes(needle),
  );
}

/**
 * A wallet extension announced through EIP-6963 shows up as its own injected
 * connector with the extension's reverse-DNS id (io.rabby, app.phantom, ...).
 * The generic "injected" connector is wagmi's catch-all, not a detection.
 */
function isAnnouncedExtension(connector: Connector): boolean {
  return connector.type === "injected" && connector.id !== "injected";
}

function isDetected(connectors: readonly Connector[], option: WalletOption): boolean {
  return connectors.some(
    (connector) => isAnnouncedExtension(connector) && matchesOption(connector, option),
  );
}

function resolveConnector(
  connectors: readonly Connector[],
  option: WalletOption,
): Connector | undefined {
  // 1. The extension the user actually asked for, announced via EIP-6963.
  const announced = connectors.find(
    (connector) => isAnnouncedExtension(connector) && matchesOption(connector, option),
  );
  if (announced) return announced;
  // 2. SDK-backed connectors (e.g. Coinbase Wallet) work without an extension.
  const sdk = connectors.find((connector) => matchesOption(connector, option));
  if (sdk) return sdk;
  // 3. Development-only test wallet stands in for every option locally.
  const testWallet = connectors.find(
    (connector) =>
      connector.id.toLowerCase().includes("arcanum") ||
      connector.name.toLowerCase().includes("arcanum"),
  );
  if (testWallet) return testWallet;
  // 4. Legacy browsers: a wallet sits on window.ethereum without announcing
  // itself. Only use the catch-all when NO extension announced itself, so
  // clicking Phantom can never secretly open MetaMask.
  const anyAnnounced = connectors.some(isAnnouncedExtension);
  if (
    !anyAnnounced &&
    typeof window !== "undefined" &&
    (window as { ethereum?: unknown }).ethereum
  ) {
    return connectors.find(
      (connector) => connector.id === "injected" || connector.type === "injected",
    );
  }
  return undefined;
}

export function ConnectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { connectors, connectAsync } = useConnect();
  const { isConnected, connector: activeConnector } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const [chosenWallet, setChosenWallet] = useState<WalletOption | null>(null);
  const [connecting, setConnecting] = useState(false);

  // Once a wallet is connected while the modal is open, hand off to the dashboard.
  useEffect(() => {
    if (open && isConnected && connecting) {
      onClose();
      router.push("/dashboard");
    }
  }, [open, isConnected, connecting, onClose, router]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setConnecting(false);
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setConnecting(false);
      setChosenWallet(null);
    }
  }, [open]);

  if (!open) return null;

  const close = () => {
    setConnecting(false);
    onClose();
  };

  const handleConnect = async (option: WalletOption) => {
    const connector = resolveConnector(connectors, option);
    if (!connector) {
      toast.error(`NOT DETECTED / install the ${option.name} extension and reload`);
      return;
    }
    // wagmi silently restores the persisted connection after a refresh, so the
    // wallet may already be connected even though the user is on the landing
    // page. Same wallet chosen → skip the connect ceremony and go straight to
    // the dashboard. Different wallet chosen → explicit switch (disconnect the
    // restored connector first, then connect the requested one).
    const wantsSwitch = isConnected && activeConnector && activeConnector.id !== connector.id;
    if (isConnected && !wantsSwitch) {
      onClose();
      router.push("/dashboard");
      return;
    }
    setChosenWallet(option);
    setConnecting(true);
    try {
      if (wantsSwitch) {
        await disconnectAsync();
      }
      await connectAsync({ connector });
      // WalletAuthBridge (mounted in providers) performs the SIWE ceremony.
      // The isConnected effect above pushes to /dashboard on success.
    } catch (error) {
      setConnecting(false);
      if (
        error instanceof ConnectorAlreadyConnectedError ||
        (error instanceof Error && error.name === "ConnectorAlreadyConnectedError")
      ) {
        // Not a failure — the connector reconnected underneath us.
        onClose();
        router.push("/dashboard");
        return;
      }
      const message = error instanceof Error ? error.message : "Wallet connection failed";
      toast.error(`CONNECT FAILED / ${message}`);
    }
  };

  const readOnly = () => {
    onClose();
    router.push("/dashboard?preview=1");
  };

  return (
    <div
      className="warm-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-[rgba(var(--wl-ink-rgb),.32)] p-5"
      role="dialog"
      aria-modal="true"
      aria-label="Connect wallet"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        className="warm-modal-panel w-full max-w-[440px] border border-[var(--wl-line-strong2)] bg-[var(--wl-bg)] shadow-[0_24px_60px_-16px_rgba(var(--wl-ink-rgb),.35)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--wl-line-soft)] px-7 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[var(--wl-signal)]">
            ARCANUM / ACCESS
          </p>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="flex h-7 w-7 items-center justify-center rounded-full font-mono text-[13px] leading-none text-[var(--wl-secondary)] transition-colors hover:bg-[var(--wl-bg-deep)] hover:text-[var(--wl-ink)]"
          >
            ✕
          </button>
        </div>
        {connecting ? (
          <div className="px-7 py-10">
            <div className="flex items-center gap-4">
              <span className="relative flex h-12 w-12 items-center justify-center border border-[var(--wl-line-soft)] bg-[var(--wl-glass-strong)]">
                {chosenWallet && (
                  <img src={chosenWallet.logo} alt="" className="h-7 w-7 object-contain" />
                )}
                <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--wl-signal)] opacity-60" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--wl-signal)]" />
                </span>
              </span>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
                  CONNECTING / {ARC_NETWORK_BADGE}
                </p>
                <p className="mt-1 text-[15px] font-semibold tracking-[-.02em]">
                  {chosenWallet?.name ?? "Wallet"}
                </p>
              </div>
            </div>
            <p className="mt-5 text-[14px] leading-[1.5] text-[var(--wl-body)]">
              Waiting for an operator signature in {chosenWallet?.name ?? "your wallet"}…
            </p>
            <div className="mt-6 h-[3px] overflow-hidden rounded-full bg-[var(--wl-line-soft)]">
              <span
                className="block h-full w-1/3 rounded-full bg-[var(--wl-signal)]"
                style={{ animation: "warmScan 1.1s cubic-bezier(.45,.05,.55,.95) infinite" }}
              />
            </div>
            <p className="mt-3 font-mono text-[9px] tracking-[.12em] text-[var(--wl-muted)]">
              SIWE · NO CUSTODY · POLICY-SCOPED SESSION
            </p>
            <button
              type="button"
              onClick={() => setConnecting(false)}
              className="warm-link mt-6 font-mono text-[10px] tracking-[.12em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
            >
              CANCEL
            </button>
          </div>
        ) : (
          <div className="px-7 pb-7 pt-6">
            <h2 className="font-display text-[26px] font-semibold leading-[1.02] tracking-[-.015em]">
              Connect your governed wallet.
            </h2>
            <p className="mt-3 text-[13.5px] leading-[1.55] text-[var(--wl-body)]">
              ARCANUM never takes custody. Sign in to inspect the governed ledger and manage
              policies.
            </p>
            <div className="mt-6 space-y-2.5">
              {WALLET_OPTIONS.map((option) => (
                <button
                  key={option.name}
                  type="button"
                  onClick={() => handleConnect(option)}
                  className="warm-wallet-option flex w-full items-center gap-3.5 border border-[var(--wl-line)] bg-[var(--wl-glass)] px-3.5 py-3 text-left"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-[var(--wl-line-soft)] bg-[var(--wl-surface)]">
                    <img src={option.logo} alt="" className="h-6 w-6 object-contain" />
                  </span>
                  <span className="flex-1">
                    <span className="flex items-center gap-2">
                      <span className="block text-[13.5px] font-semibold tracking-[-.01em]">
                        {option.name}
                      </span>
                      {isDetected(connectors, option) && (
                        <span className="rounded-full bg-[var(--wl-green-tint)] px-2 py-0.5 font-mono text-[8px] tracking-[.1em] text-[var(--wl-green)]">
                          INSTALLED
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block font-mono text-[9px] tracking-[.06em] text-[var(--wl-muted)]">
                      {option.hint.toUpperCase()}
                    </span>
                  </span>
                  <span className="warm-wallet-arrow font-mono text-[12px] text-[var(--wl-signal)]">
                    →
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between border-t border-[var(--wl-line-soft)] pt-4">
              <p className="font-mono text-[9px] tracking-[.12em] text-[var(--wl-muted)]">
                SIWE · {ARC_NETWORK_BADGE}
              </p>
              <button
                type="button"
                onClick={readOnly}
                className="warm-link font-mono text-[10px] tracking-[.12em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
              >
                CONTINUE READ-ONLY
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
