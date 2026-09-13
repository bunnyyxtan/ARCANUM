"use client";

import { EmberMark } from "@/components/warm/EmberMark";
import { ARC_EXPLORER_URL, ARC_NETWORK_BADGE, ARC_NETWORK_NAME, arcChain } from "@arcanum/shared";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import Link from "next/link";

import { Arrow } from "@/components/arcanum/arrow";
import { ThemeToggle } from "@/components/warm/ThemeToggle";
import { type MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from "react";
import type { Address, Hash } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";

import { describeChainError } from "@/lib/chain-errors";
import { escalationManagerAbi } from "@/lib/contracts";
import { contractAddresses } from "@/lib/deployment";
import {
  type EscalationChainTerms,
  compareEscalationTerms,
  escalationChainTermsFromDetail,
  escalationExpiryState,
  escalationStatusLabel,
  escalationVotePreflightError,
  formatBaseUnits,
} from "@/lib/escalation-truth";
import { isConfiguredAddress, isZeroAddress, shortAddress } from "@/lib/format/address";
import { getCountdownState } from "@/lib/format/time";
import { trpc } from "@/lib/trpc";

import { allowTrustedMutation } from "../../../(dashboard)/escalations/_lib/helpers";

function isTxHashValue(value: string | null | undefined): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{64}$/.test(value ?? "");
}

type Stage = "idle" | "checking" | "wallet" | "confirming" | "pending_indexer" | "done" | "error";

export function ApprovePublicPage({ txHash }: Readonly<{ txHash: string }>) {
  const escalationId = isTxHashValue(txHash) ? txHash : null;
  const escalationManagerAddress = isConfiguredAddress(contractAddresses.escalationManager)
    ? (contractAddresses.escalationManager as Address)
    : null;

  const { address, chainId, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const publicClient = usePublicClient({ chainId: arcChain.id });
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();
  const { writeContractAsync, isPending: writePending } = useWriteContract();
  const utils = trpc.useUtils();

  const submittingRef = useRef(false);
  const linkIdRef = useRef<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [contractTxHash, setContractTxHash] = useState<Hash | null>(null);
  const [chainRead, setChainRead] = useState<{
    state: "idle" | "loading" | "error";
    error?: string;
    terms?: EscalationChainTerms;
  }>({ state: "idle" });
  const [settledTerms, setSettledTerms] = useState<EscalationChainTerms | null>(null);
  const [now, setNow] = useState<number | undefined>(undefined);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const nextLinkId = escalationId ?? `invalid:${txHash}`;
    if (linkIdRef.current === nextLinkId) return;
    linkIdRef.current = nextLinkId;
    setSettledTerms(null);
    setStage("idle");
    setActionError(null);
    setContractTxHash(null);
  }, [escalationId, txHash]);

  const approvalQuery = trpc.escalations.publicByKey.useQuery(
    { escalationKey: escalationId ?? "0x" },
    {
      enabled: Boolean(escalationId),
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  );
  const escalation = approvalQuery.data;

  useEffect(() => {
    let cancelled = false;
    if (!escalation || !escalationManagerAddress || !escalationId || !publicClient) {
      setChainRead({ state: "idle" });
      return () => {
        cancelled = true;
      };
    }
    setChainRead({ state: "loading" });
    void publicClient
      .readContract({
        address: escalationManagerAddress,
        abi: escalationManagerAbi,
        functionName: "getEscalation",
        args: [escalationId],
      })
      .then((detail) => {
        if (cancelled) return;
        const terms = escalationChainTermsFromDetail(detail);
        if (isZeroAddress(terms.walletAddress)) {
          throw new Error(`Escalation was not found on ${ARC_NETWORK_NAME}.`);
        }
        const binding = compareEscalationTerms(
          {
            walletAddress: escalation.walletAddress,
            counterpartyAddress: escalation.counterpartyAddress,
            amountBaseUnits: escalation.amountBaseUnits,
          },
          terms,
        );
        if (!binding.ok) {
          throw new Error(
            `Displayed escalation terms do not match the current chain request (${binding.reason}).`,
          );
        }
        setChainRead({ state: "idle", terms });
      })
      .catch((caught) => {
        if (!cancelled) {
          setChainRead({
            state: "error",
            error: caught instanceof Error ? caught.message : "Chain request could not be read.",
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [escalation, escalationId, escalationManagerAddress, publicClient]);

  const chainTerms = settledTerms ?? chainRead.terms;
  const chainExpiryState =
    chainTerms && now !== undefined
      ? escalationExpiryState({
          status: chainTerms.status,
          expiresAt: chainTerms.expiresAt,
          nowSeconds: BigInt(Math.floor(now / 1000)),
        })
      : null;
  const displayBinding =
    escalation && chainTerms
      ? compareEscalationTerms(
          {
            walletAddress: escalation.walletAddress,
            counterpartyAddress: escalation.counterpartyAddress,
            amountBaseUnits: escalation.amountBaseUnits,
          },
          chainTerms,
        )
      : null;
  const canonicalTermsReady = Boolean(
    chainTerms &&
      !isZeroAddress(chainTerms.walletAddress) &&
      !isZeroAddress(chainTerms.counterpartyAddress) &&
      displayBinding?.ok,
  );
  const amount = canonicalTermsReady ? formatBaseUnits(chainTerms?.amountBaseUnits) : "UNVERIFIED";
  const counterparty = canonicalTermsReady
    ? shortAddress(chainTerms?.counterpartyAddress ?? "")
    : "TERMS UNVERIFIED";
  const walletLabel = canonicalTermsReady
    ? (chainTerms?.walletAddress ?? "UNKNOWN")
    : "TERMS UNVERIFIED";
  const reason = escalation
    ? `Held under policy version ${escalation.policyVersion}.`
    : "No escalation was found for this id.";
  const quorum = chainTerms
    ? `${chainTerms.signaturesCount} / ${chainTerms.threshold}`
    : escalation
      ? `${escalation.signatureCount} / ${escalation.threshold}`
      : "N/A";
  const escalationStatus = chainTerms?.status ?? null;
  const createdLabel = "WITHHELD FROM PUBLIC VIEW";
  const countdown = getCountdownState(escalation?.expiresAt ?? null, now);
  const chainExpirySeconds = chainTerms ? Number(chainTerms.expiresAt) : null;
  const chainExpiryMalformed =
    chainExpirySeconds !== null &&
    (!Number.isSafeInteger(chainExpirySeconds) || chainExpirySeconds < 0);
  const chainExpired = chainExpiryMalformed || chainExpiryState === "UNSWEPT";
  const expiredUnsettled = chainExpiryState === "UNSWEPT";
  const readModelExpiryReached = Boolean(escalation?.status === "PENDING" && countdown.isExpired);
  const expiryVerificationRequired =
    !expiredUnsettled && readModelExpiryReached && chainRead.state !== "idle";
  const stateLine = escalation
    ? escalationStatus
      ? `ESC / ${
          expiredUnsettled
            ? "EXPIRED · UNSWEPT"
            : expiryVerificationRequired
              ? "EXPIRY · VERIFYING"
              : escalationStatus
        }`
      : chainRead.state === "error"
        ? "ESC / ERROR"
        : "ESC / CHECKING CHAIN"
    : approvalQuery.isLoading || chainRead.state === "loading"
      ? "ESC / LOADING"
      : "ESC / NOT FOUND";

  const isBusy =
    submittingRef.current ||
    switchPending ||
    writePending ||
    stage === "checking" ||
    stage === "wallet" ||
    stage === "confirming";

  const disabledReason = !escalationId
    ? "Escalation id is missing or malformed."
    : !escalationManagerAddress
      ? "EscalationManager address is not configured."
      : !publicClient
        ? `${ARC_NETWORK_NAME} RPC is unavailable.`
        : !escalation
          ? "No escalation found for this id."
          : chainRead.state === "loading"
            ? "Reading the canonical request from Arc."
            : chainRead.state === "error"
              ? "Unable to read the canonical request from Arc."
              : !canonicalTermsReady
                ? `Displayed terms do not match the canonical request (${displayBinding?.reason ?? "unknown"}).`
                : chainTerms?.status !== "PENDING"
                  ? `Escalation is already ${chainTerms?.status.toLowerCase()}.`
                  : chainExpiryMalformed
                    ? "Canonical escalation expiry is malformed."
                    : chainExpired
                      ? "Escalation is expired. Expired requests cannot be signed."
                      : null;
  const sweepDisabledReason = !escalationId
    ? "Escalation id is missing or malformed."
    : !escalationManagerAddress
      ? "EscalationManager address is not configured."
      : !publicClient
        ? `${ARC_NETWORK_NAME} RPC is unavailable.`
        : chainRead.state === "loading"
          ? "Reading the canonical request from Arc."
          : chainRead.state === "error"
            ? "Unable to read the canonical request from Arc."
            : !canonicalTermsReady
              ? `Displayed terms do not match the canonical request (${displayBinding?.reason ?? "unknown"}).`
              : chainTerms?.status !== "PENDING"
                ? `Escalation is already ${chainTerms?.status.toLowerCase()}.`
                : chainExpiryMalformed
                  ? "Canonical escalation expiry is malformed."
                  : chainExpiryState !== "UNSWEPT"
                    ? "Escalation is not yet expired onchain."
                    : null;

  const actionsDisabled =
    Boolean(disabledReason) ||
    expiryVerificationRequired ||
    isBusy ||
    stage === "pending_indexer" ||
    stage === "done";
  const sweepActionsDisabled =
    Boolean(sweepDisabledReason) || isBusy || stage === "pending_indexer" || stage === "done";

  const statusLine =
    actionError ??
    (expiredUnsettled
      ? (sweepDisabledReason ?? "Expired request can be settled by any connected wallet.")
      : stage === "pending_indexer"
        ? "Contract confirmed. Updating the record."
        : stage === "checking"
          ? `Checking approver permission on ${ARC_NETWORK_NAME}.`
          : disabledReason);

  const readPreflight = async (action: "approve" | "reject" | "sweepExpired") => {
    if (!escalationManagerAddress || !escalationId || !publicClient || !address) {
      throw new Error(disabledReason ?? "Escalation action is unavailable.");
    }

    const detail = await publicClient.readContract({
      address: escalationManagerAddress,
      abi: escalationManagerAbi,
      functionName: "getEscalation",
      args: [escalationId],
    });
    const terms = escalationChainTermsFromDetail(detail);

    if (isZeroAddress(terms.walletAddress)) {
      throw new Error(`Escalation was not found on ${ARC_NETWORK_NAME}.`);
    }
    if (!escalation) {
      throw new Error("Escalation read model is unavailable.");
    }
    const binding = compareEscalationTerms(
      {
        walletAddress: escalation.walletAddress,
        counterpartyAddress: escalation.counterpartyAddress,
        amountBaseUnits: escalation.amountBaseUnits,
      },
      terms,
    );
    if (!binding.ok) {
      throw new Error(
        `Displayed escalation terms do not match the current chain request (${binding.reason}).`,
      );
    }
    if (terms.status !== "PENDING") {
      throw new Error(`Escalation is already ${terms.status.toLowerCase()}.`);
    }

    const expiresAtSeconds = Number(terms.expiresAt);
    if (!Number.isSafeInteger(expiresAtSeconds) || expiresAtSeconds < 0) {
      throw new Error("Escalation expiry returned by Arc is malformed.");
    }
    const expiresAtMs = expiresAtSeconds * 1000;
    const expired = Date.now() >= expiresAtMs;
    if (action === "sweepExpired") {
      if (!expired) {
        throw new Error("Escalation has not expired yet. It cannot be swept.");
      }
      return terms;
    }
    if (expired) {
      throw new Error("Escalation is expired. Expired requests cannot be signed.");
    }

    const [requiredSigner, alreadySigned] = await Promise.all([
      publicClient.readContract({
        address: escalationManagerAddress,
        abi: escalationManagerAbi,
        functionName: "isRequiredSigner",
        args: [terms.walletAddress, address],
      }),
      publicClient.readContract({
        address: escalationManagerAddress,
        abi: escalationManagerAbi,
        functionName: "signed",
        args: [escalationId, address],
      }),
    ]);

    if (!requiredSigner) {
      throw new Error("Connected wallet is not an authorized approver for this escalation.");
    }
    const voteError = escalationVotePreflightError({
      action,
      status: terms.status,
      alreadySigned,
    });
    if (voteError) throw new Error(voteError);

    return terms;
  };

  const submit = async (
    action: "approve" | "reject" | "sweepExpired",
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    if (!allowTrustedMutation(`public-escalations.${action}`, event)) return;
    if (!isConnected || !address) {
      openConnectModal?.();
      return;
    }
    const actionDisabled = action === "sweepExpired" ? sweepActionsDisabled : actionsDisabled;
    if (
      actionDisabled ||
      submittingRef.current ||
      !escalationManagerAddress ||
      !escalationId ||
      !publicClient
    ) {
      return;
    }
    const client = publicClient;

    submittingRef.current = true;
    setActionError(null);
    setContractTxHash(null);
    setStage("checking");

    try {
      await readPreflight(action);

      if (chainId !== arcChain.id) {
        setStage("wallet");
        await switchChainAsync({ chainId: arcChain.id });
      }

      setStage("wallet");
      const hash = await writeContractAsync({
        address: escalationManagerAddress,
        abi: escalationManagerAbi,
        functionName: action,
        args: [escalationId],
        chainId: arcChain.id,
      });
      setContractTxHash(hash);
      setStage("confirming");

      const receipt = await client.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });
      if (receipt.status !== "success") {
        throw new Error("Escalation transaction reverted.");
      }

      const settledDetail = await client.readContract({
        address: escalationManagerAddress,
        abi: escalationManagerAbi,
        functionName: "getEscalation",
        args: [escalationId],
      });
      const settled = escalationChainTermsFromDetail(settledDetail);
      const settledBinding = compareEscalationTerms(
        {
          walletAddress: escalation?.walletAddress,
          counterpartyAddress: escalation?.counterpartyAddress,
          amountBaseUnits: escalation?.amountBaseUnits,
        },
        settled,
      );
      if (!settledBinding.ok) {
        throw new Error(
          `Settled chain terms no longer match the displayed request (${settledBinding.reason}).`,
        );
      }
      setSettledTerms(settled);
      setChainRead({ state: "idle", terms: settled });
      setStage("pending_indexer");
      try {
        await Promise.all([
          utils.escalations.publicByKey.invalidate({ escalationKey: escalationId }),
          approvalQuery.refetch(),
        ]);
      } catch {
        // The receipt and settled chain read are authoritative; a cache
        // refresh failure must not replace that outcome with a false error.
      }
      setStage("done");

      const { toast } = await import("sonner");
      if (settled.status === "PENDING") {
        toast.success(`VOTE RECORDED / ${settled.signaturesCount} OF ${settled.threshold} QUORUM`, {
          description: `Vote for ${amount} to ${counterparty} confirmed onchain. Quorum remains pending.`,
        });
      } else if (settled.status === "EXECUTED") {
        toast.success(escalationStatusLabel(settled.status), {
          description: `Release for ${amount} to ${counterparty} executed onchain.`,
        });
      } else if (settled.status === "DENIED") {
        toast.warning(escalationStatusLabel(settled.status), {
          description: `Policy re-evaluation denied release for ${amount} to ${counterparty}.`,
        });
      } else if (settled.status === "EXPIRED") {
        toast.success("ESCALATION EXPIRED · SETTLED", {
          description: `Expiry for ${amount} to ${counterparty} is now finalized onchain.`,
        });
      } else {
        toast.warning(escalationStatusLabel(settled.status), {
          description: `The decision settled as ${settled.status}; no execution was inferred.`,
        });
      }
    } catch (caught) {
      setStage("error");
      const message = describeChainError(caught);
      setActionError(message);
      const { toast } = await import("sonner");
      toast.error("ESCALATION ACTION FAILED", { description: message });
    } finally {
      submittingRef.current = false;
    }
  };

  const outcomeTerms =
    settledTerms ?? (chainTerms && chainTerms.status !== "PENDING" ? chainTerms : null);
  const decided = stage === "done" || Boolean(outcomeTerms);
  const settledHeading =
    outcomeTerms?.status === "EXECUTED"
      ? "Release executed onchain."
      : outcomeTerms?.status === "PENDING"
        ? "Vote recorded; quorum remains pending."
        : outcomeTerms
          ? `${escalationStatusLabel(outcomeTerms.status)}.`
          : "Decision state is settled.";
  const contractTxUrl = contractTxHash
    ? `${process.env.NEXT_PUBLIC_ARCSCAN_URL ?? ARC_EXPLORER_URL}/tx/${contractTxHash}`
    : null;

  return (
    <main className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]">
      <style>
        {
          "@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}.rise{animation:rise 500ms cubic-bezier(.16,1,.3,1) both}@media(prefers-reduced-motion:reduce){.rise{animation:none}.pa-action,.pa-action *{transition:none!important;transform:none!important;box-shadow:none!important}}"
        }
      </style>
      <nav className="flex items-center justify-between border-b border-[var(--wl-line)] px-5 py-4 md:px-9 md:py-5">
        <Link
          href="/"
          className="font-display flex items-center gap-2 text-[18px] font-bold tracking-[-.015em]"
        >
          <EmberMark size={24} />
          ARCANUM
        </Link>
        <div className="flex items-center gap-3 md:gap-5">
          <span className="hidden font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-mute)] sm:inline">
            PUBLIC APPROVER PORTAL
          </span>
          <span className="rounded-full border border-[var(--wl-line)] px-3 py-2 font-mono text-[9px] tracking-[.12em] text-[var(--wl-body)]">
            {ARC_NETWORK_BADGE}
          </span>
          <ThemeToggle />
        </div>
      </nav>
      <div className="mx-auto max-w-[1080px] px-5 py-6 md:px-9 md:py-16">
        <header className="rise border-b border-[var(--wl-line)] pb-10">
          <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[var(--wl-signal)]">
            QUORUM / HUMAN SIGNATURE
          </p>
          <div className="mt-5 flex flex-col justify-between gap-8 md:flex-row md:items-end">
            <div>
              <h1 className="font-display text-[clamp(3rem,7vw,6rem)] font-semibold leading-[.84] tracking-[-.015em]">
                A decision
                <br />
                <span className="text-[var(--wl-dim)]">awaits you.</span>
              </h1>
              <p className="mt-6 max-w-[430px] text-[14px] leading-[1.5] text-[var(--wl-body)]">
                This request reached the edge of the agent&apos;s policy. Read the record, then sign
                your decision with an authorized approver wallet.
              </p>
            </div>
            <span className="w-fit border border-[var(--wl-signal)] px-3 py-2 font-mono text-[9px] tracking-[.16em] text-[var(--wl-signal)]">
              {stateLine}
            </span>
          </div>
        </header>

        <section
          className="rise mt-6 grid border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] shadow-[12px_14px_0_var(--wl-bg-deep2)] md:mt-10 md:grid-cols-[1.15fr_.85fr]"
          style={{ animationDelay: "100ms" }}
        >
          <div className="order-2 p-5 md:order-1 md:p-10">
            <div className="flex items-start justify-between border-b border-[var(--wl-line)] pb-6">
              <div>
                <p className="font-mono text-[9px] tracking-[.16em] text-[var(--wl-mute)]">
                  TRANSACTION REQUEST
                </p>
                <h2 className="font-display mt-3 text-[25px] font-medium tracking-[-.015em]">
                  Governed wallet <span className="text-[var(--wl-mute)]">→</span> {counterparty}
                </h2>
              </div>
              <span className="font-mono text-[22px] tabular-nums">{amount}</span>
            </div>
            <dl className="mt-8 grid gap-6 sm:grid-cols-2">
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-mute)]">
                  Wallet
                </dt>
                <dd className="mt-2 break-all font-mono text-[12px]">{walletLabel}</dd>
              </div>
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-mute)]">
                  Created
                </dt>
                <dd className="mt-2 font-mono text-[12px]">{createdLabel}</dd>
              </div>
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-mute)]">
                  Quorum
                </dt>
                <dd className="mt-2 font-mono text-[12px]">{quorum}</dd>
              </div>
              <div>
                <dt className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-mute)]">
                  Request id
                </dt>
                <dd className="mt-2 break-all font-mono text-[12px]">
                  {escalationId ? shortAddress(escalationId, { tail: 6 }) : "INVALID"}
                </dd>
              </div>
            </dl>
            <div className="mt-9 border-l-2 border-[var(--wl-signal)] bg-[var(--wl-bg-soft)] p-5">
              <p className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-signal)]">
                WHY THIS ESCALATED
              </p>
              <p className="mt-3 text-[15px] leading-[1.45]">{reason}</p>
              <div className="mt-4 flex items-center justify-between">
                <p className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
                  human override permitted
                </p>
                <p className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
                  EXPIRES · {countdown.label}
                </p>
              </div>
            </div>
          </div>

          <aside className="order-1 border-t border-[var(--wl-line)] bg-[var(--wl-bg-soft)] p-5 md:order-2 md:border-l md:border-t-0 md:p-8">
            <p className="font-mono text-[9px] uppercase tracking-[.17em] text-[var(--wl-mute)]">
              YOUR SIGNATURE
            </p>

            {!decided &&
              !expiredUnsettled &&
              !expiryVerificationRequired &&
              stage !== "checking" &&
              stage !== "wallet" &&
              stage !== "confirming" && (
                <>
                  <h3 className="font-display mt-5 text-[22px] font-medium tracking-[-.015em]">
                    Bless or restrain
                    <br />
                    the request.
                  </h3>
                  <p className="mt-4 text-[13px] leading-[1.5] text-[var(--wl-body)]">
                    Your decision is signed onchain and becomes part of the immutable decision
                    record. There is no silent approval.
                  </p>
                  <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 md:flex">
                    <button
                      type="button"
                      onClick={(event) => void submit("approve", event)}
                      disabled={actionsDisabled}
                      className="pa-action group relative min-h-12 md:min-h-0 overflow-hidden rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[11px] font-semibold text-[var(--wl-bg)] transition duration-[220ms] hover:-translate-y-0.5 hover:shadow-[0_10px_26px_-9px_rgba(var(--wl-signal-rgb),.5)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                    >
                      <span className="relative z-10">
                        {!isConnected ? "Connect to approve" : "Approve transaction"}{" "}
                        <Arrow
                          glyph="↗"
                          className="ml-2 inline-block group-disabled:translate-x-0"
                        />
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => void submit("reject", event)}
                      disabled={actionsDisabled}
                      className="pa-action group relative min-h-12 md:min-h-0 overflow-hidden rounded-full border border-[var(--wl-line)] px-5 py-3 text-[11px] font-semibold text-[var(--wl-ink)] transition duration-[220ms] hover:-translate-y-0.5 hover:border-[var(--wl-ink)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                    >
                      <span className="relative z-10">
                        Reject{" "}
                        <Arrow
                          glyph="↗"
                          className="ml-2 inline-block group-disabled:translate-x-0"
                        />
                      </span>
                    </button>
                  </div>
                  {statusLine && (
                    <p className="mt-5 font-mono text-[10px] leading-[1.5] text-[var(--wl-secondary)]">
                      {statusLine}
                    </p>
                  )}
                </>
              )}

            {!decided &&
              expiredUnsettled &&
              stage !== "checking" &&
              stage !== "wallet" &&
              stage !== "confirming" && (
                <div className="py-8">
                  <p className="font-mono text-[10px] uppercase tracking-[.15em] text-[var(--wl-amber)]">
                    EXPIRED · UNSWEPT
                  </p>
                  <h3 className="font-display mt-5 text-[25px] font-medium tracking-[-.015em]">
                    Settlement is still pending.
                  </h3>
                  <p className="mt-4 text-[13px] leading-[1.5] text-[var(--wl-body)]">
                    This request passed its expiry while still pending. Approve and reject are
                    disabled; any connected wallet may settle the expiry onchain.
                  </p>
                  <button
                    type="button"
                    onClick={(event) => void submit("sweepExpired", event)}
                    disabled={sweepActionsDisabled}
                    className="pa-action group relative mt-7 min-h-12 overflow-hidden rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[11px] font-semibold text-[var(--wl-bg)] transition duration-[220ms] hover:-translate-y-0.5 hover:shadow-[0_10px_26px_-9px_rgba(var(--wl-signal-rgb),.5)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none md:min-h-0"
                  >
                    <span className="relative z-10">
                      {!isConnected ? "Connect wallet to settle" : "Settle expired request"}{" "}
                      <Arrow glyph="↗" className="ml-2 inline-block group-disabled:translate-x-0" />
                    </span>
                  </button>
                  {statusLine && (
                    <p className="mt-5 font-mono text-[10px] leading-[1.5] text-[var(--wl-secondary)]">
                      {statusLine}
                    </p>
                  )}
                </div>
              )}

            {!decided &&
              expiryVerificationRequired &&
              stage !== "checking" &&
              stage !== "wallet" &&
              stage !== "confirming" && (
                <div className="py-8">
                  <p className="font-mono text-[10px] uppercase tracking-[.15em] text-[var(--wl-amber)]">
                    EXPIRY · VERIFYING ONCHAIN
                  </p>
                  <p className="mt-4 text-[13px] leading-[1.5] text-[var(--wl-body)]">
                    The read model has reached expiry. Decisions stay disabled until the canonical
                    EscalationManager state is confirmed.
                  </p>
                  {statusLine && (
                    <p className="mt-5 font-mono text-[10px] leading-[1.5] text-[var(--wl-secondary)]">
                      {statusLine}
                    </p>
                  )}
                </div>
              )}

            {(stage === "checking" || stage === "wallet" || stage === "confirming") && (
              <div className="py-12">
                <p className="font-mono text-[10px] uppercase tracking-[.15em] text-[var(--wl-signal)]">
                  {stage === "checking"
                    ? "CHECKING PERMISSION"
                    : stage === "confirming"
                      ? "CONFIRMING ONCHAIN"
                      : "WAITING FOR SIGNATURE"}
                </p>
                <p className="mt-4 text-[14px] text-[var(--wl-body)]">
                  Recording your decision against{" "}
                  {escalationId ? shortAddress(escalationId, { tail: 6 }) : "the request"}.
                </p>
              </div>
            )}

            {decided && (
              <div className="py-8">
                <p className="font-mono text-[10px] uppercase tracking-[.15em] text-[var(--wl-green)]">
                  {stage === "pending_indexer"
                    ? "ONCHAIN SETTLED · REFRESHING READ MODEL"
                    : "DECISION RECORDED"}
                </p>
                <h3
                  className={`font-display mt-5 text-[25px] font-medium ${
                    outcomeTerms?.status === "EXECUTED"
                      ? "text-[var(--wl-green)]"
                      : "text-[var(--wl-signal)]"
                  }`}
                >
                  {settledHeading}
                </h3>
                <p className="mt-4 text-[13px] leading-[1.5] text-[var(--wl-body)]">
                  The settled chain status and signature count above are authoritative; no action
                  intent was used to infer execution.
                </p>
                {contractTxUrl && (
                  <a
                    href={contractTxUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-8 inline-block font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-ink)] underline underline-offset-4"
                  >
                    View on Arcscan ↗
                  </a>
                )}
              </div>
            )}
          </aside>
        </section>

        <footer className="mt-10 flex flex-wrap justify-between gap-4 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
          <Link href="/escalations" className="warm-link">
            ← ARCANUM GOVERNANCE
          </Link>
          <span>Expires in {countdown.label} · signed decisions are final</span>
        </footer>
      </div>
    </main>
  );
}
