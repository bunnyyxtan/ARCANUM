"use client";

import { ARC_NETWORK_BADGE } from "@arcanum/shared";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConnectorAlreadyConnectedError, useAccount, useConnect, useDisconnect } from "wagmi";

import { useDialogFocus } from "@/lib/use-dialog-focus";
import { clearWalletLaunch, requestWalletLaunch } from "@/lib/wallet-launch-intent";

import {
  type Environment,
  WALLET_OPTIONS,
  type WalletOption,
  availabilityHint,
  availabilityOf,
  dappUrlFor,
  detectEnvironment,
  resolveConnector,
} from "./wallet-options";

const DESKTOP_ENVIRONMENT: Environment = { isMobile: false, hasInjectedProvider: false };

export function ConnectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { connectors, connectAsync } = useConnect();
  const { isConnected, connector: activeConnector } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const [chosenWallet, setChosenWallet] = useState<WalletOption | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [environment, setEnvironment] = useState<Environment>(DESKTOP_ENVIRONMENT);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const close = () => {
    setConnecting(false);
    onClose();
  };
  const dialogRef = useDialogFocus(open, close);

  useEffect(() => {
    setEnvironment(
      detectEnvironment(navigator.userAgent, Boolean((window as { ethereum?: unknown }).ethereum)),
    );
  }, []);

  useEffect(() => {
    if (!open) {
      setConnecting(false);
      setChosenWallet(null);
    }
  }, [open]);

  if (!open) return null;

  const handleConnect = async (option: WalletOption) => {
    const connector = resolveConnector(connectors, option, environment.hasInjectedProvider);
    if (!connector) {
      const availability = availabilityOf(option, connectors, environment);
      if (availability === "mobile-app" && option.mobileLink) {
        // No extension exists on a phone. Hand the page to the wallet app's
        // own browser, where the wallet is injected and this modal reopens.
        window.location.assign(option.mobileLink(dappUrlFor(window.location.origin)));
        return;
      }
      if (availability === "desktop-only") {
        toast.error(
          `DESKTOP ONLY / ${option.name} has no mobile app browser. Use MetaMask, Phantom, OKX or Coinbase Wallet here, or open Arcanum on desktop`,
        );
        return;
      }
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
      // The request is consumed by the bridge above the identity-scoped
      // provider. The modal itself may already have unmounted after wagmi
      // reported the new account.
      requestWalletLaunch();
      window.dispatchEvent(new Event("arcanum:wallet-launch-requested"));
    } catch (error) {
      clearWalletLaunch();
      setConnecting(false);
      if (
        error instanceof ConnectorAlreadyConnectedError ||
        (error instanceof Error && error.name === "ConnectorAlreadyConnectedError")
      ) {
        // Not a failure - the connector reconnected underneath us.
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
    <dialog
      open
      className="warm-modal-backdrop fixed inset-0 z-50 flex h-full w-full items-center justify-center bg-[rgba(var(--wl-ink-rgb),.32)] p-5"
      aria-modal="true"
      aria-label="Connect wallet"
    >
      <button
        type="button"
        aria-label="Close connect dialog"
        aria-hidden="true"
        data-dialog-backdrop
        tabIndex={-1}
        className="fixed inset-0 cursor-default"
        onClick={close}
      />
      <div
        ref={dialogRef}
        className="warm-modal-panel relative max-h-[calc(100dvh-40px)] w-full max-w-[440px] overflow-y-auto border border-[var(--wl-line-strong2)] bg-[var(--wl-bg)] shadow-[0_24px_60px_-16px_rgba(var(--wl-ink-rgb),.35)]"
      >
        <div className="flex items-center justify-between border-b border-[var(--wl-line-soft)] px-7 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[var(--wl-signal)]">
            ARCANUM / ACCESS
          </p>
          <button
            ref={closeButtonRef}
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
              {WALLET_OPTIONS.map((option) => {
                const availability = availabilityOf(option, connectors, environment);
                return (
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
                        {availability === "installed" && (
                          <span className="rounded-full bg-[var(--wl-green-tint)] px-2 py-0.5 font-mono text-[8px] tracking-[.1em] text-[var(--wl-green)]">
                            INSTALLED
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block font-mono text-[9px] tracking-[.06em] text-[var(--wl-muted)]">
                        {availabilityHint(availability).toUpperCase()}
                      </span>
                    </span>
                    <span className="warm-wallet-arrow font-mono text-[12px] text-[var(--wl-signal)]">
                      {availability === "mobile-app" ? "↗" : "→"}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={readOnly}
              className="warm-wallet-option mt-5 flex w-full items-center gap-3.5 border border-dashed border-[var(--wl-line)] px-3.5 py-3 text-left"
            >
              <span className="flex-1">
                <span className="block text-[13.5px] font-semibold tracking-[-.01em]">
                  Browse read-only
                </span>
                <span className="mt-0.5 block font-mono text-[9px] tracking-[.06em] text-[var(--wl-muted)]">
                  NO WALLET NEEDED · WRITES STAY LOCKED
                </span>
              </span>
              <span className="warm-wallet-arrow font-mono text-[12px] text-[var(--wl-signal)]">
                →
              </span>
            </button>
            <p className="mt-4 font-mono text-[9px] tracking-[.12em] text-[var(--wl-muted)]">
              SIWE · {ARC_NETWORK_BADGE}
            </p>
          </div>
        )}
      </div>
    </dialog>
  );
}
