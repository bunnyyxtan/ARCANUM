"use client";

import { ARC_NETWORK_BADGE, ARC_NETWORK_NAME, arcChain } from "@arcanum/shared";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { toast } from "sonner";
import type { Address, Hash } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";

import { getArcscanTxUrl } from "@/lib/arcscan";
import { guardedWalletControlAbi } from "@/lib/contracts";
import { isEvmAddress, isSameAddress, isZeroAddress, shortAddress } from "@/lib/format/address";
import { formatUsd, formatUsdCompact } from "@/lib/format/money";
import { useLiveAgents, useLiveLedgerByWallet } from "@/lib/live-data";
import { trpc } from "@/lib/trpc";
import type { LedgerEntry, LedgerStatus } from "@/lib/types";

function resolveGovernedWalletAddress(value: string | string[] | undefined): Address | null {
  const raw = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  if (!raw) {
    return null;
  }
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  return isEvmAddress(decoded) ? (decoded as Address) : null;
}

function errorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "shortMessage" in error) {
    return String((error as { shortMessage?: unknown }).shortMessage);
  }
  return error instanceof Error ? error.message : "Transaction failed. Please retry.";
}

function allowTrustedMutation(action: string, event: ReactMouseEvent<HTMLElement>) {
  if (event.nativeEvent.isTrusted) {
    return true;
  }
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[Arcanum] Blocked ${action}: mutations require an explicit trusted click.`);
  }
  return false;
}

function ledgerStatusLabel(status: LedgerStatus): "APPROVED" | "REJECTED" | "ESCALATED" | "FROZEN" {
  if (status === "rejected") {
    return "REJECTED";
  }
  if (status === "escalated") {
    return "ESCALATED";
  }
  if (status === "frozen") {
    return "FROZEN";
  }
  return "APPROVED";
}

function StatusPill({
  status,
}: { status: "ACTIVE" | "FROZEN" | "APPROVED" | "REJECTED" | "ESCALATED" }) {
  const styles = {
    ACTIVE: "bg-[var(--wl-green-tint)] text-[var(--wl-green)]",
    FROZEN: "bg-[var(--wl-ink)] text-[var(--wl-bg)]",
    APPROVED: "bg-[var(--wl-green-tint)] text-[var(--wl-green)]",
    REJECTED: "bg-[var(--wl-signal)] text-[var(--wl-bg)]",
    ESCALATED: "border border-[var(--wl-signal)] text-[var(--wl-signal)]",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.12em] ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function Arrow() {
  return (
    <span
      aria-hidden="true"
      className="ml-1 transition-transform duration-[220ms] group-hover:translate-x-1"
    >
      →
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Agent signer panel: addSigner / removeSigner with on-chain readback  */
/* ------------------------------------------------------------------ */

function AgentSignerPanel({ governedWalletAddress }: { governedWalletAddress: Address | null }) {
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcChain.id });
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();
  const { writeContractAsync, isPending: writePending } = useWriteContract();
  const utils = trpc.useUtils();
  const syncSignerState = trpc.agents.syncSignerState.useMutation();
  const submittingRef = useRef(false);

  const [signerInput, setSignerInput] = useState("");
  const [walletOwner, setWalletOwner] = useState<Address | null>(null);
  const [signerAuthorized, setSignerAuthorized] = useState<boolean | null>(null);
  const [readStatus, setReadStatus] = useState<"idle" | "loading" | "verified" | "error">("idle");
  const [readError, setReadError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<
    "idle" | "wallet" | "confirming" | "syncing" | "synced" | "sync_failed" | "error"
  >("idle");
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const trimmedSigner = signerInput.trim();
  const signerAddress = isEvmAddress(trimmedSigner) ? (trimmedSigner as Address) : null;
  const usableSignerAddress = signerAddress && !isZeroAddress(signerAddress) ? signerAddress : null;
  const signerValidation =
    trimmedSigner.length === 0
      ? "Enter an agent signer public address."
      : !signerAddress
        ? "Enter a valid EVM address."
        : isZeroAddress(signerAddress)
          ? "Zero address cannot be an agent signer."
          : null;

  const ownerMatchesConnectedWallet = Boolean(
    walletOwner && address && isSameAddress(walletOwner, address),
  );

  const isBusy =
    submittingRef.current ||
    switchPending ||
    writePending ||
    syncSignerState.isPending ||
    txStatus === "wallet" ||
    txStatus === "confirming" ||
    txStatus === "syncing";

  const readOwner = useCallback(async () => {
    if (!publicClient || !governedWalletAddress) {
      return;
    }
    setReadStatus("loading");
    setReadError(null);
    try {
      const bytecode = await publicClient.getBytecode({ address: governedWalletAddress });
      if (!bytecode || bytecode === "0x") {
        setWalletOwner(null);
        setReadStatus("error");
        setReadError(`No contract found at this governed wallet address on ${ARC_NETWORK_NAME}.`);
        return;
      }
      const owner = (await publicClient.readContract({
        address: governedWalletAddress,
        abi: guardedWalletControlAbi,
        functionName: "owner",
      })) as Address;
      setWalletOwner(owner);
      setReadStatus("verified");
    } catch (caught) {
      setWalletOwner(null);
      setReadStatus("error");
      setReadError(errorMessage(caught));
    }
  }, [governedWalletAddress, publicClient]);

  useEffect(() => {
    setSignerInput("");
    setSignerAuthorized(null);
    setTxStatus("idle");
    setTxHash(null);
    setTxError(null);
    void readOwner();
  }, [readOwner]);

  const verifySigner = useCallback(async () => {
    if (!publicClient || !governedWalletAddress || !usableSignerAddress) {
      setSignerAuthorized(null);
      return;
    }
    try {
      const authorized = (await publicClient.readContract({
        address: governedWalletAddress,
        abi: guardedWalletControlAbi,
        functionName: "agentSigners",
        args: [usableSignerAddress],
      })) as boolean;
      setSignerAuthorized(authorized);
    } catch {
      setSignerAuthorized(null);
    }
  }, [governedWalletAddress, publicClient, usableSignerAddress]);

  useEffect(() => {
    void verifySigner();
  }, [verifySigner]);

  const managementDisabledReason = !governedWalletAddress
    ? "Open a valid governed wallet route."
    : !isConnected
      ? "Connect wallet first."
      : readStatus === "loading"
        ? "Checking governed wallet owner."
        : readStatus === "error"
          ? (readError ?? `Unable to read governed wallet on ${ARC_NETWORK_NAME}.`)
          : !ownerMatchesConnectedWallet
            ? "Only the governed wallet owner can manage the agent signer."
            : chainId !== arcChain.id
              ? `Switch to ${ARC_NETWORK_NAME}.`
              : null;
  const signerWriteDisabledReason = managementDisabledReason ?? signerValidation;
  const canAuthorize = !signerWriteDisabledReason && signerAuthorized === false && !isBusy;
  const canRevoke = !signerWriteDisabledReason && signerAuthorized === true && !isBusy;
  const txArcscanUrl = getArcscanTxUrl(txHash);

  const submitSignerWrite = async (
    action: "authorize" | "revoke",
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    if (!allowTrustedMutation(`agentSigner.${action}`, event)) {
      return;
    }
    const targetSigner = usableSignerAddress;
    if (
      submittingRef.current ||
      !governedWalletAddress ||
      !targetSigner ||
      !publicClient ||
      !ownerMatchesConnectedWallet
    ) {
      return;
    }

    submittingRef.current = true;
    setTxError(null);
    setTxHash(null);
    setTxStatus("wallet");
    let contractConfirmed = false;

    try {
      if (chainId !== arcChain.id) {
        await switchChainAsync({ chainId: arcChain.id });
      }

      const hash = await writeContractAsync({
        address: governedWalletAddress,
        abi: guardedWalletControlAbi,
        functionName: action === "authorize" ? "addSigner" : "removeSigner",
        args: [targetSigner],
        chainId: arcChain.id,
      });
      setTxHash(hash);
      setTxStatus("confirming");

      const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
      if (receipt.status !== "success") {
        throw new Error("Signer transaction reverted.");
      }

      contractConfirmed = true;
      const nextState = action === "authorize";
      const refreshed = (await publicClient.readContract({
        address: governedWalletAddress,
        abi: guardedWalletControlAbi,
        functionName: "agentSigners",
        args: [targetSigner],
      })) as boolean;
      if (refreshed !== nextState) {
        throw new Error("Contract readback did not confirm the signer state.");
      }

      setSignerAuthorized(nextState);
      setTxStatus("syncing");
      await syncSignerState.mutateAsync({
        action,
        signerAddress: targetSigner,
        walletAddress: governedWalletAddress,
      });
      await utils.agents.list.invalidate();
      if (action === "revoke") {
        setSignerInput("");
      }
      setTxStatus("synced");
      toast.success(action === "authorize" ? "AGENT SIGNER AUTHORIZED" : "AGENT SIGNER REVOKED", {
        description: "Contract confirmed and signer record synced.",
      });
    } catch (caught) {
      setTxStatus(contractConfirmed ? "sync_failed" : "error");
      setTxError(errorMessage(caught));
    } finally {
      submittingRef.current = false;
    }
  };

  const switchToArcTestnet = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!allowTrustedMutation("agentSigner.switchChain", event)) {
      return;
    }
    try {
      setTxError(null);
      await switchChainAsync({ chainId: arcChain.id });
    } catch (caught) {
      setTxError(errorMessage(caught));
    }
  };

  const txStatusLabel =
    txStatus === "wallet"
      ? "CONFIRM IN WALLET"
      : txStatus === "confirming"
        ? "WAITING FOR RECEIPT"
        : txStatus === "syncing"
          ? "SYNCING RECORD"
          : txStatus === "synced"
            ? "SIGNER STATE SYNCED"
            : txStatus === "sync_failed"
              ? "CONTRACT CONFIRMED · RECORD SYNC FAILED"
              : null;

  return (
    <div className="border-t border-[var(--wl-line)] py-6">
      <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
        AGENT SIGNER
      </p>
      <p className="mt-3 text-[12px] leading-[1.5] text-[var(--wl-body)]">
        The agent signer is the public wallet address controlled by your agent backend. Never paste
        a private key. The signer can request payments, but policy rules still control spend.
      </p>
      <label className="mt-4 block">
        <span className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
          SIGNER ADDRESS
        </span>
        <input
          value={signerInput}
          onChange={(event) => setSignerInput(event.target.value)}
          placeholder={address ?? "0x..."}
          className="mt-2 w-full border-b border-[var(--wl-faint)] bg-transparent py-2 font-mono text-[12px] outline-none focus:border-[var(--wl-signal)]"
        />
      </label>
      {usableSignerAddress ? (
        <p className="mt-2 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
          {signerAuthorized === true
            ? "AUTHORIZED ON CONTRACT"
            : signerAuthorized === false
              ? "NOT AUTHORIZED ON CONTRACT"
              : "VERIFYING"}
        </p>
      ) : null}
      {managementDisabledReason ? (
        <p className="mt-2 font-mono text-[9px] leading-[1.5] text-[var(--wl-amber)]">
          {managementDisabledReason}
        </p>
      ) : null}
      {txStatusLabel ? (
        <p className="mt-2 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
          {txStatusLabel}
          {txArcscanUrl ? (
            <a
              href={txArcscanUrl}
              target="_blank"
              rel="noreferrer"
              className="ml-2 text-[var(--wl-signal)] underline underline-offset-2"
            >
              tx ↗
            </a>
          ) : null}
        </p>
      ) : null}
      {txError ? (
        <p className="mt-2 font-mono text-[9px] leading-[1.5] text-[var(--wl-signal)]">{txError}</p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {isConnected && chainId !== arcChain.id ? (
          <button
            type="button"
            onClick={switchToArcTestnet}
            className="warm-pill warm-pill-ghost rounded-full border border-[var(--wl-line)] px-3.5 py-2.5 text-[10px] font-semibold"
          >
            Switch to {ARC_NETWORK_NAME}
          </button>
        ) : (
          <>
            <button
              type="button"
              disabled={!canAuthorize}
              onClick={(event) => void submitSignerWrite("authorize", event)}
              className="warm-pill rounded-full bg-[var(--wl-signal)] px-3.5 py-2.5 text-[10px] font-semibold text-white disabled:opacity-40"
            >
              Authorize signer
            </button>
            <button
              type="button"
              disabled={!canRevoke}
              onClick={(event) => void submitSignerWrite("revoke", event)}
              className="warm-pill warm-pill-ghost rounded-full border border-[var(--wl-line)] px-3.5 py-2.5 text-[10px] font-semibold disabled:opacity-40"
            >
              Revoke signer
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function AgentDetailPage() {
  const params = useParams();
  const governedWalletAddress = resolveGovernedWalletAddress(params.walletId);
  const walletValue = governedWalletAddress ?? params.walletId?.toString() ?? "";

  const agentsQuery = useLiveAgents();
  const ledgerQuery = useLiveLedgerByWallet(walletValue || null);

  const agent = useMemo(
    () =>
      agentsQuery.data.find(
        (item) => isSameAddress(item.wallet, walletValue) || item.id === walletValue,
      ) ?? null,
    [agentsQuery.data, walletValue],
  );

  const decisions: LedgerEntry[] = ledgerQuery.data;

  const frozen = agent?.status === "frozen";
  const agentName =
    agent?.name ??
    (governedWalletAddress
      ? `Governed Wallet ${shortAddress(governedWalletAddress)}`
      : "Invalid wallet");

  const approvedCount = decisions.filter((d) => d.status === "approved").length;
  const rejectedCount = decisions.filter((d) => d.status === "rejected").length;
  const dailySpend = agent?.dailySpend ?? 0;
  const dailyLimit = agent?.dailyLimit ?? 0;
  const capWidth = dailyLimit > 0 ? Math.min(1, dailySpend / dailyLimit) : 0;

  // Derived behavior stats — computed from the live indexed decision record.
  const behaviorTotal = decisions.reduce((sum, d) => sum + d.amount, 0);
  const behaviorAvg = decisions.length > 0 ? behaviorTotal / decisions.length : 0;
  const behaviorPeak = decisions.reduce((max, d) => Math.max(max, d.amount), 0);
  const restraints = decisions.filter(
    (d) => d.status === "rejected" || d.status === "escalated" || d.status === "frozen",
  ).length;
  const authorizedVendors = Array.from(
    new Set(
      decisions
        .filter((d) => d.status === "approved")
        .map((d) => d.counterparty)
        .filter(Boolean),
    ),
  ).slice(0, 6);
  const behaviorBars = decisions.slice(0, 20).reverse();

  return (
    <main className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]">
      <style>{`
        .detail-in{animation:detailIn 420ms cubic-bezier(.16,1,.3,1) calc(var(--i,0)*75ms) both}@keyframes detailIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        .decision-row{transition:transform 220ms cubic-bezier(.16,1,.3,1),background-color 220ms ease}.decision-row:hover{transform:translateX(3px);background:var(--wl-bg-soft)}
        .bar{height:5px;background:var(--wl-line-soft)}.bar span{display:block;height:100%;background:var(--wl-ink);transform-origin:left;animation:barIn 700ms cubic-bezier(.16,1,.3,1) both}@keyframes barIn{from{transform:scaleX(0)}to{transform:scaleX(1)}}
        @media(prefers-reduced-motion:reduce){.detail-in,.bar span{animation:none}.decision-row{transition:none}.behavior-bar{transition:none!important;transform:none!important}}
      `}</style>
      <div className="mx-auto max-w-[1400px] px-5 py-9 md:px-8 md:py-10">
        <div
          className="detail-in flex flex-col justify-between gap-7 border-b border-[var(--wl-line)] pb-9 md:flex-row md:items-end"
          style={{ "--i": 0 } as CSSProperties}
        >
          <div>
            <Link
              href="/agents"
              className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-secondary)] transition-colors hover:text-[var(--wl-signal)]"
            >
              ← Agent register
            </Link>
            <p className="mt-6 font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
              DOSSIER / GOVERNED WALLET
            </p>
            <h1 className="font-display mt-4 text-[clamp(2.8rem,6vw,5.3rem)] font-semibold leading-[.86] tracking-[-.015em]">
              {agentName}
            </h1>
            <p className="mt-5 max-w-[510px] text-[14px] leading-[1.45] text-[var(--wl-secondary2)]">
              {agent?.mandate
                ? `${agent.mandate}. Observable limits, no unreviewed drift.`
                : "A governed wallet with observable limits and a legible policy trail."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {frozen ? (
              <span
                title="This wallet is frozen on-chain. Restraint changes are submitted on-chain by the governed wallet owner; this console reflects the on-chain record."
                className="cursor-help rounded-full bg-[var(--wl-ink)] px-4 py-2.5 font-mono text-[10px] uppercase tracking-[.1em] text-[var(--wl-bg)]"
              >
                FROZEN · ON-CHAIN RESTRAINT
              </span>
            ) : null}
            <Link
              href={governedWalletAddress ? `/agents/${governedWalletAddress}/policy` : "/agents"}
              className="warm-pill group rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[11px] font-semibold text-white"
            >
              Edit policy
              <Arrow />
            </Link>
          </div>
        </div>

        <section className="grid border-b border-[var(--wl-line)] md:grid-cols-4">
          {(
            [
              [
                "POSTURE",
                `${agent?.posture ?? 0} / 100`,
                agent ? ARC_NETWORK_BADGE.toLowerCase() : "invalid route",
              ],
              ["TODAY'S SPEND", formatUsd(dailySpend), `of ${formatUsd(dailyLimit)} cap`],
              [
                "DECISIONS",
                decisions.length.toString(),
                `${approvedCount} approved · ${rejectedCount} rejected`,
              ],
              [
                "GOVERNANCE",
                frozen ? "FROZEN" : "ACTIVE",
                frozen
                  ? "operator restraint"
                  : (agent?.doctrineVersion ?? ARC_NETWORK_BADGE.toLowerCase()),
              ],
            ] as const
          ).map(([label, value, note], i) => (
            <div
              key={label}
              className={`detail-in min-h-[130px] border-b border-[var(--wl-line)] py-6 md:border-b-0 ${i ? "md:border-l md:pl-6" : "md:pr-6"}`}
              style={{ "--i": i + 1 } as CSSProperties}
            >
              <p className="font-mono text-[9px] uppercase tracking-[.15em] text-[var(--wl-secondary)]">
                {label}
              </p>
              <p
                className={`font-display mt-5 text-[27px] font-semibold tracking-[-.015em] tabular-nums ${label === "GOVERNANCE" && frozen ? "text-[var(--wl-signal)]" : ""}`}
              >
                {value}
              </p>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-[.1em] text-[var(--wl-mute)]">
                {note}
              </p>
            </div>
          ))}
        </section>

        <section className="grid gap-10 pt-10 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,.8fr)]">
          <div className="detail-in" style={{ "--i": 3 } as CSSProperties}>
            <div className="flex items-end justify-between border-b border-[var(--wl-line)] pb-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.17em] text-[var(--wl-signal)]">
                  BEHAVIOR / ON RECORD
                </p>
                <h2 className="font-display mt-2 text-[22px] font-medium tracking-[-.015em]">
                  Spending behavior
                </h2>
              </div>
              <span className="font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-mute)]">
                USD · UTC
              </span>
            </div>
            <div className="grid grid-cols-2 border-b border-[var(--wl-line)] py-6 sm:grid-cols-4">
              {(
                [
                  ["RECORDED TOTAL", formatUsd(behaviorTotal)],
                  ["AVG. TX", formatUsd(behaviorAvg)],
                  ["PEAK TX", formatUsd(behaviorPeak)],
                  ["RESTRAINTS", restraints.toString().padStart(2, "0")],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="mb-4 sm:mb-0">
                  <p className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
                    {label}
                  </p>
                  <p className="mt-2 font-mono text-[14px] tabular-nums">{value}</p>
                </div>
              ))}
            </div>
            {behaviorBars.length > 0 ? (
              <>
                <div className="flex h-[180px] items-end gap-2 border-b border-[var(--wl-line)] px-2 py-6">
                  {behaviorBars.map((row) => {
                    const ratio = behaviorPeak > 0 ? row.amount / behaviorPeak : 0;
                    const restrained =
                      row.status === "rejected" ||
                      row.status === "escalated" ||
                      row.status === "frozen";
                    return (
                      <div
                        key={row.id}
                        // biome-ignore lint/a11y/noNoninteractiveTabindex: focus reveals the bar's value tooltip for keyboard users
                        tabIndex={0}
                        aria-label={`${formatUsd(row.amount)} · ${row.status} · ${row.timestamp}`}
                        className="group relative flex h-full flex-1 flex-col items-center justify-end outline-none"
                      >
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap border border-[var(--wl-line)] bg-[var(--wl-bg-raised)] px-2.5 py-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 max-md:opacity-100 max-sm:left-auto max-sm:right-0 max-sm:translate-x-0">
                          <p className="font-mono text-[11px] tabular-nums text-[var(--wl-ink)]">
                            {formatUsd(row.amount)}
                          </p>
                          <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[.1em] text-[var(--wl-mute)]">
                            {row.status} · {row.timestamp}
                          </p>
                        </div>
                        <span className="mb-1.5 hidden font-mono text-[8px] tabular-nums text-[var(--wl-mute)] transition-colors group-hover:text-[var(--wl-ink)] sm:block">
                          {formatUsdCompact(row.amount)}
                        </span>
                        <span
                          className={`behavior-bar w-full origin-bottom transition-transform duration-[420ms] group-hover:scale-y-105 ${restrained ? "bg-[var(--wl-signal)]" : "bg-[var(--wl-ink)]"}`}
                          style={{ height: `${Math.max(4, ratio * 82)}%` }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between pt-3 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
                  <span>{behaviorBars[0]?.timestamp ?? "-"}</span>
                  <span className="hidden items-center gap-4 sm:flex">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 bg-[var(--wl-ink)]" />
                      settled
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 bg-[var(--wl-signal)]" />
                      restrained
                    </span>
                  </span>
                  <span>{behaviorBars[behaviorBars.length - 1]?.timestamp ?? "-"}</span>
                </div>
              </>
            ) : (
              <div className="border-b border-[var(--wl-line)] py-10 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
                  No spend recorded yet
                </p>
                <p className="mx-auto mt-3 max-w-[360px] text-[12px] leading-[1.5] text-[var(--wl-body)]">
                  Behavior charts populate once this governed wallet settles payments on Arc
                  Testnet.
                </p>
              </div>
            )}

            <div className="mt-10 flex items-end justify-between border-b border-[var(--wl-line)] pb-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.17em] text-[var(--wl-signal)]">
                  DECISIONS / RECENT
                </p>
                <h2 className="font-display mt-2 text-[22px] font-medium tracking-[-.015em]">
                  Decision record
                </h2>
              </div>
              <Link
                href="/ledger"
                className="group font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-body)] hover:text-[var(--wl-signal)]"
              >
                Open ledger
                <Arrow />
              </Link>
            </div>

            {ledgerQuery.isLoading ? (
              <div>
                {[0, 1, 2, 3].map((index) => (
                  <div
                    key={index}
                    className="grid animate-pulse gap-2 border-b border-[var(--wl-line-soft)] px-3 py-4 md:grid-cols-[.8fr_1.2fr_1.1fr_.8fr_90px] md:items-center"
                  >
                    <div className="h-4 w-16 rounded bg-[var(--wl-line-soft)]" />
                    <div className="h-4 w-28 rounded bg-[var(--wl-line-soft)]" />
                    <div className="h-4 w-24 rounded bg-[var(--wl-line-soft)]" />
                    <div className="h-4 w-16 rounded bg-[var(--wl-line-soft)]" />
                    <div className="h-4 w-16 rounded-full bg-[var(--wl-line-soft)]" />
                  </div>
                ))}
              </div>
            ) : ledgerQuery.isError ? (
              <div className="border-b border-[var(--wl-line)] py-14 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
                  Ledger read failed
                </p>
                <button
                  type="button"
                  onClick={() => void ledgerQuery.refetch()}
                  className="mt-4 text-[12px] text-[var(--wl-signal)] underline underline-offset-4"
                >
                  Retry
                </button>
              </div>
            ) : decisions.length === 0 ? (
              <div className="border-b border-[var(--wl-line)] py-14 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
                  No activity recorded yet
                </p>
                <p className="mx-auto mt-3 max-w-[360px] text-[12px] leading-[1.5] text-[var(--wl-body)]">
                  Payment intents, policy decisions, and transfers will appear here after this
                  governed wallet is used.
                </p>
              </div>
            ) : (
              <div>
                {decisions.map((row) => (
                  <div
                    key={row.id}
                    className="decision-row grid gap-2 border-b border-[var(--wl-line-soft)] px-3 py-4 max-md:grid-cols-1 md:grid-cols-[.8fr_1.2fr_1.1fr_.8fr_90px] md:items-center"
                  >
                    <span className="font-mono text-[10px] text-[var(--wl-secondary)]">
                      <span className="mr-2 text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)] md:hidden">
                        Time
                      </span>
                      {row.timestamp}
                    </span>
                    <span className="text-[12px] font-medium">
                      <span className="mr-2 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)] md:hidden">
                        Action
                      </span>
                      {row.action}
                    </span>
                    <span className="text-[12px] text-[var(--wl-body)]">
                      <span className="mr-2 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)] md:hidden">
                        Counterparty
                      </span>
                      {row.counterparty}
                    </span>
                    <span className="font-mono text-[11px]">
                      <span className="mr-2 text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)] md:hidden">
                        Amount
                      </span>
                      {formatUsd(row.amount)}
                    </span>
                    <StatusPill status={ledgerStatusLabel(row.status)} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <aside
            className="detail-in bg-[var(--wl-bg-soft)] p-6 md:p-7"
            style={{ "--i": 4 } as CSSProperties}
          >
            <div className="flex items-start justify-between border-b border-[var(--wl-line)] pb-5">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.17em] text-[var(--wl-signal)]">
                  IDENTITY / CONTROL
                </p>
                <h2 className="font-display mt-2 text-[22px] font-medium tracking-[-.015em]">
                  Wallet file
                </h2>
              </div>
              <StatusPill status={frozen ? "FROZEN" : "ACTIVE"} />
            </div>
            <dl className="divide-y divide-[var(--wl-line)] font-mono text-[10px]">
              {(
                [
                  [
                    "WALLET",
                    governedWalletAddress ? shortAddress(governedWalletAddress) : "invalid",
                  ],
                  ["NETWORK", ARC_NETWORK_BADGE],
                  ["ASSET", "USDC"],
                  ["POLICY", agent?.doctrineVersion ?? "-"],
                  ["MANDATE", agent?.mandate ?? "-"],
                  ["OWNER", agent?.owner ?? "-"],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="grid grid-cols-[.9fr_1.1fr] gap-3 py-3 max-sm:grid-cols-1 max-sm:gap-1"
                >
                  <dt className="text-[var(--wl-mute)]">{label}</dt>
                  <dd
                    className="min-w-0 break-all text-right text-[var(--wl-body)] max-sm:text-left"
                    title={value}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="border-b border-[var(--wl-line)] py-6">
              <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
                CAPACITY USED
              </p>
              <div className="mt-4 flex justify-between font-mono text-[11px]">
                <span>{formatUsd(dailySpend)}</span>
                <span className="text-[var(--wl-mute)]">{formatUsd(dailyLimit)}</span>
              </div>
              <div className="bar mt-3">
                <span style={{ transform: `scaleX(${capWidth})` }} />
              </div>
            </div>

            <div className="border-b border-[var(--wl-line)] py-6">
              <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
                AUTHORIZED VENDORS
              </p>
              {authorizedVendors.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {authorizedVendors.map((vendor) => (
                    <span
                      key={vendor}
                      className="rounded-full border border-[var(--wl-line-bold)] px-2.5 py-1.5 font-mono text-[9px] text-[var(--wl-body)]"
                    >
                      {vendor}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 font-mono text-[9px] text-[var(--wl-mute)]">
                  No settled counterparties recorded yet.
                </p>
              )}
            </div>

            <AgentSignerPanel governedWalletAddress={governedWalletAddress} />

            <div className="flex flex-wrap gap-2">
              <Link
                href={governedWalletAddress ? `/badge/${governedWalletAddress}` : "#"}
                className="warm-pill warm-pill-ghost rounded-full border border-[var(--wl-line)] px-3.5 py-2.5 text-[10px] font-semibold"
              >
                Public badge
              </Link>
              <Link
                href={governedWalletAddress ? `/explorer/${governedWalletAddress}` : "#"}
                className="warm-pill warm-pill-ghost rounded-full border border-[var(--wl-line)] px-3.5 py-2.5 text-[10px] font-semibold"
              >
                Public explorer ↗
              </Link>
            </div>
          </aside>
        </section>

        <footer className="mt-14 flex flex-col justify-between gap-2 border-t border-[var(--wl-line)] pt-5 font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-mute)] sm:flex-row">
          <span>
            {agent?.doctrineVersion ?? ARC_NETWORK_BADGE.toLowerCase()} · caps{" "}
            {formatUsd(dailyLimit)} / day
          </span>
          <span>{governedWalletAddress ? "SYNCED" : "INVALID ROUTE"}</span>
        </footer>
      </div>
    </main>
  );
}
