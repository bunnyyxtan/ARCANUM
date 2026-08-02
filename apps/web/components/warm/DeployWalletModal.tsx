"use client";

import { arcTestnet } from "@arcanum/shared";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { toast } from "sonner";
import { parseEventLogs, parseUnits } from "viem";
import type { Address, Hash } from "viem";
import { isAddress as isViemAddress } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";

import { getArcscanAddressUrl, getArcscanTxUrl } from "@/lib/arcscan";
import {
  allPolicyCategoriesMask,
  deployedContracts,
  initialDeployWalletForm,
  walletFactoryAbi,
  type DeployWalletFormState,
} from "@/lib/contracts";
import { isConfiguredAddress, shortAddress } from "@/lib/format/address";
import { trpc } from "@/lib/trpc";

/* ------------------------------------------------------------------ */
/* Helpers preserved from the old Deploy Governed Wallet modal          */
/* ------------------------------------------------------------------ */

type CreatedWalletResult = {
  wallet: Address;
  txHash: Hash;
  label: string;
  perTxCap: string;
  dailyCap: string;
  monthlyCap: string;
  escalationThreshold: string;
  requireAllowlist: boolean;
};

type CreatedWalletSyncInput = {
  walletAddress: Address;
  ownerAddress: Address;
  label: string;
  deployTxHash: Hash;
  chainId: number;
  perTxCap: number;
  dailyCap: number;
  monthlyCap: number;
  escalationThreshold: number;
  requireAllowlist: boolean;
  signers: Address[];
  council: Address[];
  quorum: number;
};

function allowTrustedMutation(action: string, event: ReactMouseEvent<HTMLElement>) {
  if (event.nativeEvent.isTrusted) {
    return true;
  }
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[Arcanum] Blocked ${action}: mutations require an explicit trusted click.`);
  }
  return false;
}

function deployContractStatus() {
  const contracts = deployedContracts.map((contract) => ({
    ...contract,
    configured: isConfiguredAddress(contract.value),
  }));
  return { contracts, ready: contracts.every((contract) => contract.configured) };
}

function configuredAddress(value: string | undefined): Address | null {
  return isConfiguredAddress(value) ? (value as Address) : null;
}

function parseUsdcInput(value: string, label: string) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error(`${label} must be a positive USDC amount with up to 6 decimals.`);
  }
  const parsed = parseUnits(trimmed, 6);
  if (parsed <= 0n) {
    throw new Error(`${label} must be greater than zero.`);
  }
  return parsed;
}

function parseAddressList(value: string, fallback: Address, label: string) {
  const parts = value
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const candidates = parts.length > 0 ? parts : [fallback];
  const unique = new Map<string, Address>();
  for (const candidate of candidates) {
    if (!isViemAddress(candidate)) {
      throw new Error(`${label} contains an invalid address: ${candidate}`);
    }
    unique.set(candidate.toLowerCase(), candidate as Address);
  }
  return Array.from(unique.values());
}

function buildWalletPolicy(form: DeployWalletFormState) {
  const perTxCap = parseUsdcInput(form.perTxCap, "Per transaction cap");
  const daily24hCap = parseUsdcInput(form.dailyCap, "Daily cap");
  const monthlyRollingCap = parseUsdcInput(form.monthlyCap, "Monthly cap");
  const escalationThreshold = parseUsdcInput(form.escalationAmount, "Escalation amount");

  if (perTxCap > daily24hCap) {
    throw new Error("Per transaction cap must be less than or equal to the daily cap.");
  }
  if (daily24hCap > monthlyRollingCap) {
    throw new Error("Daily cap must be less than or equal to the monthly cap.");
  }

  return {
    perTxCap,
    daily24hCap,
    monthlyRollingCap,
    allowedCategories: allPolicyCategoriesMask,
    escalationThreshold,
    requireAllowlist: form.requireAllowlist,
  };
}

function errorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "shortMessage" in error) {
    return String((error as { shortMessage?: unknown }).shortMessage);
  }
  return error instanceof Error ? error.message : "Transaction failed. Please retry.";
}

function walletCreatedFromReceipt(logs: readonly unknown[]) {
  const parsed = parseEventLogs({
    abi: walletFactoryAbi,
    eventName: "WalletCreated",
    logs: logs as Parameters<typeof parseEventLogs>[0]["logs"],
  });
  return parsed[0]?.args.wallet as Address | undefined;
}

/* ------------------------------------------------------------------ */

function ResultLine({ href, label, value }: Readonly<{ href?: string; label: string; value: string }>) {
  const copyValue = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} COPIED`);
    } catch {
      toast.error(`${label} COPY FAILED`);
    }
  };

  return (
    <div className="grid grid-cols-[130px_minmax(0,1fr)_auto] items-center gap-2">
      <span className="text-[var(--wl-mute)]">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="min-w-0 truncate font-mono text-[var(--wl-body)] hover:text-[var(--wl-signal)]"
          title={value}
        >
          {shortAddress(value)}
        </a>
      ) : (
        <span className="min-w-0 truncate font-mono text-[var(--wl-body)]" title={value}>
          {shortAddress(value)}
        </span>
      )}
      <button
        type="button"
        onClick={() => void copyValue()}
        className="flex h-6 w-6 items-center justify-center border border-[var(--wl-line)] font-mono text-[10px] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
        aria-label={`Copy ${label.toLowerCase()}`}
      >
        ⧉
      </button>
    </div>
  );
}

const fieldClass =
  "h-9 w-full border border-[var(--wl-line)] bg-[var(--wl-bg-soft)] px-3 text-[13px] text-[var(--wl-ink)] outline-none placeholder:text-[var(--wl-mute)] focus:border-[var(--wl-signal)]";
const fieldLabelClass = "font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-secondary)]";

export function DeployWalletModal({
  onClose,
  onWalletCreated,
}: Readonly<{ onClose: () => void; onWalletCreated?: (result: CreatedWalletResult) => void }>) {
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();
  const { writeContractAsync, isPending: writePending } = useWriteContract();
  const recordCreatedWallet = trpc.agents.recordCreatedWallet.useMutation();
  const deployment = deployContractStatus();
  const walletFactoryAddress = configuredAddress(process.env.NEXT_PUBLIC_WALLET_FACTORY);
  const missingLabels = deployment.contracts
    .filter((contract) => !contract.configured)
    .map((contract) => contract.label);
  const [form, setForm] = useState<DeployWalletFormState>(initialDeployWalletForm);
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [createdWallet, setCreatedWallet] = useState<Address | null>(null);
  const [predictedWallet, setPredictedWallet] = useState<Address | null>(null);
  const [status, setStatus] = useState<"idle" | "confirming" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [persistenceState, setPersistenceState] = useState<
    "idle" | "saving" | "supabase" | "supabase_failed" | "supabase_unconfigured"
  >("idle");
  const [persistenceMessage, setPersistenceMessage] = useState<string | null>(null);
  const [pendingSyncInput, setPendingSyncInput] = useState<CreatedWalletSyncInput | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedGovernanceOpen, setAdvancedGovernanceOpen] = useState(false);
  const submittingRef = useRef(false);
  const readyForTransaction =
    deployment.ready && walletFactoryAddress !== null && isConnected && chainId === arcTestnet.id;
  const isBusy = writePending || switchPending || status === "confirming" || submittingRef.current;
  const primaryDisabled =
    isBusy ||
    !deployment.ready ||
    !isConnected ||
    (chainId === arcTestnet.id && !readyForTransaction);

  useEffect(() => {
    if (!address) {
      return;
    }
    setForm((current) => ({
      ...current,
      signerAddresses: current.signerAddresses || address,
      councilAddresses: current.councilAddresses || address,
    }));
  }, [address]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const updateForm = (key: keyof DeployWalletFormState, value: string | boolean) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const resetForAnotherWallet = () => {
    setForm({
      ...initialDeployWalletForm,
      signerAddresses: address ?? "",
      councilAddresses: address ?? "",
    });
    setTxHash(null);
    setCreatedWallet(null);
    setPredictedWallet(null);
    setStatus("idle");
    setError(null);
    setPersistenceState("idle");
    setPersistenceMessage(null);
    setPendingSyncInput(null);
  };

  const syncCreatedWallet = async (input: CreatedWalletSyncInput) => {
    setPersistenceState("saving");
    setPersistenceMessage(null);
    try {
      const persisted = await recordCreatedWallet.mutateAsync(input);
      setPersistenceState(persisted.dataSource);
      setPersistenceMessage(
        persisted.dataSource === "supabase"
          ? null
          : (persisted.message ??
              "Wallet deployed on-chain, but Supabase sync failed. Save this wallet address and retry sync."),
      );
      return persisted.dataSource;
    } catch (persistError) {
      const message = errorMessage(persistError);
      setPersistenceState("supabase_failed");
      setPersistenceMessage(
        message ||
          "Wallet deployed on-chain, but Supabase sync failed. Save this wallet address and retry sync.",
      );
      return "supabase_failed" as const;
    }
  };

  const handleCreateWallet = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!allowTrustedMutation("walletFactory.createWallet", event)) {
      return;
    }
    if (!isConnected || !address) {
      setError("Connect wallet first.");
      setStatus("error");
      return;
    }
    if (chainId !== arcTestnet.id) {
      setError(null);
      setStatus("idle");
      try {
        await switchChainAsync({ chainId: arcTestnet.id });
      } catch (caught) {
        setStatus("error");
        setError(errorMessage(caught));
      }
      return;
    }
    if (!deployment.ready || !walletFactoryAddress) {
      setError("Configure deployed contract addresses before creating a governed wallet.");
      setStatus("error");
      return;
    }
    if (!publicClient) {
      setError("Arc Testnet client is not ready. Please retry.");
      setStatus("error");
      return;
    }
    if (submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setError(null);
    setCreatedWallet(null);
    setTxHash(null);
    setPredictedWallet(null);
    setStatus("confirming");
    setPersistenceState("idle");
    setPersistenceMessage(null);
    setPendingSyncInput(null);

    try {
      const label = form.label.trim();
      if (!label) {
        throw new Error("Wallet label is required.");
      }

      const policy = buildWalletPolicy(form);
      const signers = parseAddressList(form.signerAddresses, address, "Agent signers");
      const council = parseAddressList(form.councilAddresses, address, "Escalation council");
      const quorum = Number.parseInt(form.quorum, 10);
      if (!Number.isInteger(quorum) || quorum < 1 || quorum > 255) {
        throw new Error("Quorum must be a whole number between 1 and 255.");
      }
      if (quorum > council.length) {
        throw new Error("Quorum cannot be greater than the number of council addresses.");
      }

      const nonce = await publicClient.readContract({
        address: walletFactoryAddress,
        abi: walletFactoryAbi,
        functionName: "nonces",
        args: [address],
      });
      const predicted = await publicClient.readContract({
        address: walletFactoryAddress,
        abi: walletFactoryAbi,
        functionName: "predictWallet",
        args: [address, label, nonce, policy, signers, council, quorum],
      });
      setPredictedWallet(predicted);

      const hash = await writeContractAsync({
        address: walletFactoryAddress,
        abi: walletFactoryAbi,
        functionName: "createWallet",
        args: [address, label, policy, signers, council, quorum],
        chainId: arcTestnet.id,
      });
      setTxHash(hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const wallet = walletCreatedFromReceipt(receipt.logs) ?? predicted;
      const createdResult: CreatedWalletResult = {
        wallet,
        txHash: hash,
        label,
        perTxCap: form.perTxCap,
        dailyCap: form.dailyCap,
        monthlyCap: form.monthlyCap,
        escalationThreshold: form.escalationAmount,
        requireAllowlist: form.requireAllowlist,
      };
      setCreatedWallet(wallet);
      setStatus("success");
      onWalletCreated?.(createdResult);
      const syncInput = {
        walletAddress: wallet,
        ownerAddress: address,
        label,
        deployTxHash: hash,
        chainId: arcTestnet.id,
        perTxCap: Number(form.perTxCap),
        dailyCap: Number(form.dailyCap),
        monthlyCap: Number(form.monthlyCap),
        escalationThreshold: Number(form.escalationAmount),
        requireAllowlist: form.requireAllowlist,
        signers,
        council,
        quorum,
      } satisfies CreatedWalletSyncInput;
      setPendingSyncInput(syncInput);
      const persistence = await syncCreatedWallet(syncInput);

      if (persistence === "supabase") {
        toast.success("GOVERNED WALLET CREATED", {
          description: `${shortAddress(wallet)} saved to Supabase`,
        });
      } else {
        toast.warning("WALLET DEPLOYED - SUPABASE SYNC FAILED", {
          description: "Save the wallet address and retry sync.",
        });
      }
    } catch (caught) {
      setStatus("error");
      setError(errorMessage(caught));
    } finally {
      submittingRef.current = false;
    }
  };

  const primaryLabel = !deployment.ready
    ? "DEPLOYMENT CONFIG REQUIRED"
    : !isConnected
      ? "CONNECT WALLET FIRST"
      : chainId !== arcTestnet.id
        ? switchPending
          ? "SWITCHING NETWORK"
          : "SWITCH TO ARC TESTNET"
        : status === "confirming" || writePending
          ? txHash
            ? "WAITING FOR RECEIPT"
            : "CONFIRM IN WALLET"
          : "CREATE GOVERNED WALLET";

  const hasSuccess = status === "success" && createdWallet !== null && txHash !== null;
  const createdAgentHref = createdWallet ? `/agents/${createdWallet}` : "/agents";
  const createdWalletArcscanUrl = getArcscanAddressUrl(createdWallet);
  const txArcscanUrl = getArcscanTxUrl(txHash);
  const persistenceFailed =
    persistenceState === "supabase_failed" || persistenceState === "supabase_unconfigured";

  const copyCreatedWallet = async () => {
    if (!createdWallet) {
      return;
    }
    try {
      await navigator.clipboard.writeText(createdWallet);
      toast.success("WALLET ADDRESS COPIED");
    } catch {
      toast.error("WALLET ADDRESS COPY FAILED");
    }
  };

  return (
    <div
      className="warm-modal-backdrop fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgba(var(--wl-ink-rgb),.28)] p-4 md:items-center"
      role="dialog"
      aria-modal="true"
    >
      <button type="button" aria-label="Close deploy dialog" className="fixed inset-0 -z-10 cursor-default" onClick={onClose} />
      <section className="warm-modal-panel my-6 w-full max-w-[560px] border border-[var(--wl-line-bold)] bg-[var(--wl-bg)] shadow-[12px_14px_0_var(--wl-line-faint)]">
        <div className="flex h-[52px] items-center justify-between border-b border-[var(--wl-line)] bg-[var(--wl-bg-soft)] px-5">
          <div className="font-mono text-[11px] uppercase tracking-[.18em] text-[var(--wl-ink)]">
            DEPLOY GOVERNED WALLET
          </div>
          <button
            type="button"
            aria-label="Close deploy dialog"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center border border-[var(--wl-line)] font-mono text-[12px] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
          >
            ✕
          </button>
        </div>
        <div className="space-y-4 p-5 text-[12px] leading-relaxed text-[var(--wl-secondary)]">
          <p>
            {!deployment.ready
              ? `Deployment is paused until ${missingLabels.join(", ")} ${
                  missingLabels.length === 1 ? "is" : "are"
                } configured in the frontend environment.`
              : isConnected
                ? chainId === arcTestnet.id
                  ? "Arc Testnet contracts are ready. WalletFactory is configured for real governed wallet creation."
                  : "Wallet is connected. Switch to Arc Testnet before creating a governed wallet."
                : "Connect and authenticate wallet to deploy a governed wallet."}
          </p>
          <div className="flex items-center justify-between border border-[var(--wl-line)] bg-[var(--wl-bg-soft)] px-3 py-2">
            <span
              className={`font-mono text-[10px] uppercase tracking-[.12em] ${deployment.ready ? "text-[var(--wl-green)]" : "text-[var(--wl-signal)]"}`}
            >
              {deployment.ready ? "ARC TESTNET CONTRACTS READY" : "DEPLOYMENT CONFIG INCOMPLETE"}
            </span>
            <button
              type="button"
              onClick={() => setAdvancedOpen((open) => !open)}
              className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
            >
              ADVANCED DEPLOYMENT DETAILS {advancedOpen ? "-" : "+"}
            </button>
          </div>
          {advancedOpen ? (
            <div className="space-y-2 border border-[var(--wl-line)] bg-[var(--wl-bg-soft)] p-3">
              {deployment.contracts.map((contract) => (
                <div
                  key={contract.label}
                  className="grid grid-cols-[170px_minmax(0,1fr)_72px] items-center gap-3 font-mono text-[10px] uppercase tracking-[.12em]"
                >
                  <span className="text-[var(--wl-mute)]">{contract.label}</span>
                  <span
                    className={`min-w-0 truncate ${contract.configured ? "text-[var(--wl-body)]" : "text-[var(--wl-signal)]"}`}
                    title={contract.value ?? "not configured"}
                  >
                    {contract.configured ? shortAddress(contract.value ?? "") : "MISSING"}
                  </span>
                  <span className={contract.configured ? "text-[var(--wl-green)]" : "text-[var(--wl-signal)]"}>
                    {contract.configured ? "READY" : "MISSING"}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          {hasSuccess ? (
            <div
              className={`space-y-4 border bg-[var(--wl-green-tint)] p-4 ${persistenceFailed ? "border-[var(--wl-amber)]" : "border-[var(--wl-green)]"}`}
            >
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-green)]">
                  GOVERNED WALLET CREATED
                </div>
                <div className="mt-2 font-mono text-[18px] text-[var(--wl-ink)]">
                  {shortAddress(createdWallet)}
                </div>
                <div className="mt-1 font-mono text-[11px] uppercase tracking-[.08em] text-[var(--wl-secondary)]">
                  {persistenceState === "supabase"
                    ? "PENDING INDEXER SYNC - SAVED TO SUPABASE"
                    : persistenceState === "saving"
                      ? "PENDING INDEXER SYNC - SAVING READ MODEL"
                      : persistenceFailed
                        ? "ON-CHAIN DEPLOYED - SUPABASE SYNC FAILED"
                        : "PENDING INDEXER SYNC"}
                </div>
              </div>
              {persistenceFailed ? (
                <div className="border border-[var(--wl-amber)] bg-[var(--wl-bg-soft)] p-3 text-[11px] leading-relaxed text-[var(--wl-amber)]">
                  {persistenceMessage ??
                    "Wallet deployed on-chain, but Supabase sync failed. Save this wallet address and retry sync."}
                </div>
              ) : null}
              <div className="space-y-2 border border-[var(--wl-line)] bg-[var(--wl-bg-soft)] p-3 font-mono text-[10px] uppercase tracking-[.12em]">
                <ResultLine
                  label="GUARDEDWALLET"
                  value={createdWallet ?? ""}
                  href={createdWalletArcscanUrl ?? undefined}
                />
                <ResultLine label="TX HASH" value={txHash ?? ""} href={txArcscanUrl ?? undefined} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={createdAgentHref}
                  onClick={onClose}
                  className="flex h-9 items-center justify-center border border-[var(--wl-signal)] font-mono text-[11px] uppercase tracking-[.12em] text-[var(--wl-signal)] hover:bg-[var(--wl-signal)] hover:text-white"
                >
                  VIEW GOVERNED WALLET
                </Link>
                <a
                  href={txArcscanUrl ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex h-9 items-center justify-center border border-[var(--wl-line-bold)] font-mono text-[11px] uppercase tracking-[.12em] text-[var(--wl-body)] hover:border-[var(--wl-signal)] hover:text-[var(--wl-signal)]"
                >
                  VIEW TRANSACTION
                </a>
                <button
                  type="button"
                  onClick={() => void copyCreatedWallet()}
                  className="flex h-9 items-center justify-center border border-[var(--wl-line-bold)] font-mono text-[11px] uppercase tracking-[.12em] text-[var(--wl-body)] hover:border-[var(--wl-signal)] hover:text-[var(--wl-signal)]"
                >
                  COPY WALLET ADDRESS
                </button>
                {persistenceFailed && pendingSyncInput ? (
                  <button
                    type="button"
                    onClick={() => void syncCreatedWallet(pendingSyncInput)}
                    disabled={recordCreatedWallet.isPending}
                    className="flex h-9 items-center justify-center border border-[var(--wl-amber)] font-mono text-[11px] uppercase tracking-[.12em] text-[var(--wl-amber)] hover:bg-[var(--wl-amber)] hover:text-[var(--wl-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {recordCreatedWallet.isPending ? "SYNCING SUPABASE" : "RETRY SUPABASE SYNC"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={resetForAnotherWallet}
                  className={`flex h-9 items-center justify-center border border-[var(--wl-line-bold)] font-mono text-[11px] uppercase tracking-[.12em] text-[var(--wl-body)] hover:border-[var(--wl-signal)] hover:text-[var(--wl-signal)] ${persistenceFailed ? "col-span-2" : ""}`}
                >
                  CREATE ANOTHER WALLET
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="col-span-2 flex h-9 items-center justify-center border border-[var(--wl-line-bold)] font-mono text-[11px] uppercase tracking-[.12em] text-[var(--wl-body)] hover:border-[var(--wl-signal)] hover:text-[var(--wl-signal)]"
                >
                  CLOSE
                </button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-mute)]">
                  CREATE A GOVERNED WALLET ON ARC TESTNET
                </div>
                <div className="mt-1 text-[12px] text-[var(--wl-ink)]">
                  Contracts ready. Choose a wallet name and simple spend limits.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAdvancedGovernanceOpen((open) => !open)}
                className="flex h-10 w-full items-center justify-between border border-[var(--wl-line)] bg-[var(--wl-bg-soft)] px-3 font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
              >
                <span>ADVANCED GOVERNANCE SETTINGS</span>
                <span>{advancedGovernanceOpen ? "-" : "+"}</span>
              </button>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className={fieldLabelClass}>WALLET OWNER</span>
                  <div className="flex h-9 w-full items-center border border-[var(--wl-line)] bg-[var(--wl-bg-soft)] px-3 font-mono text-[11px] text-[var(--wl-ink)]">
                    {address ? shortAddress(address) : "connect wallet"}
                  </div>
                </div>
                <label className="space-y-1">
                  <span className={fieldLabelClass}>WALLET LABEL</span>
                  <input
                    value={form.label}
                    onChange={(event) => updateForm("label", event.target.value)}
                    className={fieldClass}
                  />
                </label>
                <label className={`space-y-1 ${!advancedGovernanceOpen ? "hidden" : ""}`}>
                  <span className={fieldLabelClass}>QUORUM</span>
                  <input
                    value={form.quorum}
                    onChange={(event) => updateForm("quorum", event.target.value)}
                    inputMode="numeric"
                    className={fieldClass}
                  />
                </label>
                <label className="space-y-1">
                  <span className={fieldLabelClass}>PER TX CAP / USDC</span>
                  <input
                    value={form.perTxCap}
                    onChange={(event) => updateForm("perTxCap", event.target.value)}
                    inputMode="decimal"
                    className={fieldClass}
                  />
                </label>
                <label className="space-y-1">
                  <span className={fieldLabelClass}>DAILY CAP / USDC</span>
                  <input
                    value={form.dailyCap}
                    onChange={(event) => updateForm("dailyCap", event.target.value)}
                    inputMode="decimal"
                    className={fieldClass}
                  />
                </label>
                <label className={`space-y-1 ${!advancedGovernanceOpen ? "hidden" : ""}`}>
                  <span className={fieldLabelClass}>MONTHLY CAP / USDC</span>
                  <input
                    value={form.monthlyCap}
                    onChange={(event) => updateForm("monthlyCap", event.target.value)}
                    inputMode="decimal"
                    className={fieldClass}
                  />
                </label>
                <label className={`space-y-1 ${!advancedGovernanceOpen ? "hidden" : ""}`}>
                  <span className={fieldLabelClass}>ESCALATE ABOVE / USDC</span>
                  <input
                    value={form.escalationAmount}
                    onChange={(event) => updateForm("escalationAmount", event.target.value)}
                    inputMode="decimal"
                    className={fieldClass}
                  />
                </label>
              </div>
              <div className={`grid grid-cols-2 gap-3 ${!advancedGovernanceOpen ? "hidden" : ""}`}>
                <label className="space-y-1">
                  <span className={fieldLabelClass}>AGENT SIGNERS / COMMA SEPARATED</span>
                  <input
                    value={form.signerAddresses}
                    onChange={(event) => updateForm("signerAddresses", event.target.value)}
                    placeholder={address ?? "0x..."}
                    className={`${fieldClass} font-mono text-[11px]`}
                  />
                </label>
                <label className="space-y-1">
                  <span className={fieldLabelClass}>ESCALATION COUNCIL / COMMA SEPARATED</span>
                  <input
                    value={form.councilAddresses}
                    onChange={(event) => updateForm("councilAddresses", event.target.value)}
                    placeholder={address ?? "0x..."}
                    className={`${fieldClass} font-mono text-[11px]`}
                  />
                </label>
              </div>
              <label
                className={`flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-secondary)] ${!advancedGovernanceOpen ? "hidden" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={form.requireAllowlist}
                  onChange={(event) => updateForm("requireAllowlist", event.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--wl-signal)]"
                />
                REQUIRE VENDOR ALLOWLIST / ALL CATEGORIES ENABLED
              </label>
              {predictedWallet || txHash || createdWallet ? (
                <div className="space-y-2 border border-[var(--wl-line)] bg-[var(--wl-bg-soft)] p-3 font-mono text-[10px] uppercase tracking-[.12em]">
                  {predictedWallet ? (
                    <ResultLine label="PREDICTED WALLET" value={predictedWallet} />
                  ) : null}
                  {txHash ? (
                    <ResultLine label="TX HASH" value={txHash} href={txArcscanUrl ?? undefined} />
                  ) : null}
                  {createdWallet ? (
                    <ResultLine
                      label="GUARDEDWALLET"
                      value={createdWallet}
                      href={createdWalletArcscanUrl ?? undefined}
                    />
                  ) : null}
                  {status === "success" ? (
                    <div className="pt-1 text-[var(--wl-green)]">
                      CREATED ON ARC TESTNET / INDEXER OR READ MODEL STATE MAY LAG
                    </div>
                  ) : null}
                </div>
              ) : null}
              {error ? (
                <div className="border border-[var(--wl-signal)] bg-[var(--wl-bg-soft)] px-3 py-2 text-[11px] text-[var(--wl-signal)]">
                  {error}
                </div>
              ) : null}
              <button
                type="button"
                disabled={primaryDisabled}
                onClick={handleCreateWallet}
                title={
                  !deployment.ready
                    ? "Configure deployed contract addresses before deploying a governed wallet."
                    : !isConnected
                      ? "Connect wallet first."
                      : chainId !== arcTestnet.id
                        ? "Switch wallet network to Arc Testnet."
                        : "Create a GuardedWallet on Arc Testnet."
                }
                className={`flex h-9 w-full items-center justify-center border font-mono text-[11px] uppercase tracking-[.12em] ${
                  primaryDisabled
                    ? "cursor-not-allowed border-[var(--wl-line)] text-[var(--wl-mute)] opacity-70"
                    : "border-[var(--wl-line-bold)] text-[var(--wl-ink)] hover:border-[var(--wl-signal)] hover:text-[var(--wl-signal)]"
                }`}
              >
                {primaryLabel}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-full items-center justify-center border border-[var(--wl-line-bold)] font-mono text-[11px] uppercase tracking-[.12em] text-[var(--wl-body)] hover:border-[var(--wl-signal)] hover:text-[var(--wl-signal)]"
              >
                ACKNOWLEDGE
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

export default DeployWalletModal;
