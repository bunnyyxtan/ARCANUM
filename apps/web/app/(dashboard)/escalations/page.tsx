"use client";

import { arcTestnet } from "@arcanum/shared";
import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type { Address, Hash } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";

import { ConnectCta } from "@/components/warm/ConnectCta";
import { getArcscanTxUrl } from "@/lib/arcscan";
import { useWorkspaceMode } from "@/lib/auth-session";
import { escalationManagerAbi, escalationStatusLabels } from "@/lib/contracts";
import { isConfiguredAddress, isZeroAddress, shortAddress } from "@/lib/format/address";
import { formatUsd } from "@/lib/format/money";
import { useLiveEscalations } from "@/lib/live-data";
import { trpc } from "@/lib/trpc";
import type { Escalation } from "@/lib/types";

function isTxHashValue(value: string | null | undefined): value is `0x${string}` {
  return Boolean(value && /^0x[a-fA-F0-9]{64}$/.test(value));
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

function formatFooterTimestamp(value: string | null) {
  if (!value) {
    return "N/A";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "N/A";
  }
  const day = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(date);
  return `${day} · ${time} UTC`;
}

type TxStage = "idle" | "checking" | "wallet" | "confirming" | "pending_indexer" | "error";

function EscalationCard({
  item,
  index,
  cardId,
  onResolved,
}: Readonly<{ item: Escalation; index: number; cardId: string; onResolved: () => void }>) {
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();
  const { writeContractAsync, isPending: writePending } = useWriteContract();
  const utils = trpc.useUtils();
  const recordDecision = trpc.escalations.recordDecision.useMutation();
  const submittingRef = useRef(false);

  const [txStage, setTxStage] = useState<TxStage>("idle");
  const [lastAction, setLastAction] = useState<"approve" | "reject" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [contractTxHash, setContractTxHash] = useState<Hash | null>(null);

  const escalationManagerAddress = isConfiguredAddress(process.env.NEXT_PUBLIC_ESCALATION_MANAGER)
    ? (process.env.NEXT_PUBLIC_ESCALATION_MANAGER as Address)
    : null;
  const escalationId = isTxHashValue(item.id) ? item.id : null;

  const isBusy =
    submittingRef.current ||
    switchPending ||
    writePending ||
    txStage === "checking" ||
    txStage === "wallet" ||
    txStage === "confirming";

  const disabledReason = !escalationId
    ? "Escalation id is missing."
    : !escalationManagerAddress
      ? "EscalationManager address is not configured."
      : !publicClient
        ? "Arc Testnet RPC is unavailable."
        : !isConnected || !address
          ? "Connect the approver wallet first."
          : null;

  const actionsDisabled = Boolean(disabledReason) || isBusy || txStage === "pending_indexer";
  const statusLine =
    actionError ??
    (txStage === "pending_indexer"
      ? "Contract confirmed. Updating the record."
      : txStage === "checking"
        ? "Checking approver permission on Arc Testnet."
        : disabledReason);

  const amountLabel = formatUsd(item.amount);
  const isNear = item.expiryPercent < 10;
  const resolved = txStage === "pending_indexer";

  const readEscalationPreflight = async () => {
    if (!escalationManagerAddress || !escalationId || !publicClient || !address) {
      throw new Error(disabledReason ?? "Escalation action is unavailable.");
    }

    const detail = await publicClient.readContract({
      address: escalationManagerAddress,
      abi: escalationManagerAbi,
      functionName: "getEscalation",
      args: [escalationId],
    });
    const wallet = detail[0] as Address;
    const status = escalationStatusLabels[Number(detail[8])] ?? "EXPIRED";

    if (isZeroAddress(wallet)) {
      throw new Error("Escalation was not found on Arc Testnet.");
    }
    if (status !== "PENDING") {
      throw new Error(`Escalation is already ${status.toLowerCase()}.`);
    }

    const expiresAtMs = Number(detail[5]) * 1000;
    if (Number.isFinite(expiresAtMs) && Date.now() >= expiresAtMs) {
      throw new Error("Escalation is expired. Expired requests cannot be approved or rejected.");
    }

    const [requiredSigner, alreadySigned] = await Promise.all([
      publicClient.readContract({
        address: escalationManagerAddress,
        abi: escalationManagerAbi,
        functionName: "isRequiredSigner",
        args: [wallet, address],
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
    if (alreadySigned) {
      throw new Error("This approver has already voted on this escalation.");
    }

    return { signaturesCount: Number(detail[7]), threshold: Number(detail[6]) };
  };

  const submitResolution = async (
    action: "approve" | "reject",
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    if (!allowTrustedMutation(`escalations.${action}`, event)) {
      return;
    }
    if (actionsDisabled || submittingRef.current || !escalationManagerAddress || !escalationId) {
      return;
    }

    submittingRef.current = true;
    setLastAction(action);
    setActionError(null);
    setContractTxHash(null);
    setTxStage("checking");

    try {
      const preflight = await readEscalationPreflight();

      if (chainId !== arcTestnet.id) {
        setTxStage("wallet");
        await switchChainAsync({ chainId: arcTestnet.id });
      }

      setTxStage("wallet");
      const hash = await writeContractAsync({
        address: escalationManagerAddress,
        abi: escalationManagerAbi,
        functionName: action,
        args: [escalationId],
        chainId: arcTestnet.id,
      });
      setContractTxHash(hash);
      setTxStage("confirming");

      const receipt = await publicClient?.waitForTransactionReceipt({ hash, confirmations: 1 });
      if (receipt?.status !== "success") {
        throw new Error("Escalation transaction reverted.");
      }

      // The chain is settled; mirror it into the read model so the queue does
      // not keep showing a decision the owner already made.
      let syncFailed: string | null = null;
      try {
        await recordDecision.mutateAsync({ escalationKey: escalationId, txHash: hash });
      } catch (caught) {
        syncFailed = errorMessage(caught);
      }

      await Promise.all([utils.escalations.list.invalidate(), utils.ledger.list.invalidate()]);
      setTxStage("pending_indexer");
      onResolved();

      if (syncFailed) {
        toast.warning("DECISION LIVE ON-CHAIN · QUEUE NOT SYNCED", {
          description: `The decision is settled on Arc Testnet, but the queue could not be updated: ${syncFailed}`,
        });
      } else if (action === "approve") {
        const nextCount = preflight.signaturesCount + 1;
        toast.success(
          nextCount >= preflight.threshold
            ? "ESCALATION APPROVED / QUORUM REACHED"
            : `ESCALATION APPROVED / ${nextCount} OF ${preflight.threshold} QUORUM`,
          {
            description:
              nextCount >= preflight.threshold
                ? `Release for ${amountLabel} to ${item.counterparty} executed in the approval transaction.`
                : `Vote for ${amountLabel} to ${item.counterparty} confirmed on-chain.`,
          },
        );
      } else {
        toast.success("ESCALATION REJECTED", {
          description: `Rejection for ${amountLabel} to ${item.counterparty} confirmed on-chain.`,
        });
      }
    } catch (caught) {
      setTxStage("error");
      const message = errorMessage(caught);
      setActionError(message);
      toast.error("ESCALATION ACTION FAILED", { description: message });
    } finally {
      submittingRef.current = false;
    }
  };

  const copyPortal = () => {
    const link = `${window.location.origin}/approve/${item.id}`;
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(link);
    }
    toast.success("Approver portal link copied.");
  };

  return (
    <article
      id={cardId}
      style={{ "--card-i": index } as CSSProperties}
      className={`arc-card relative border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] p-5 md:p-7 ${
        isNear ? "arc-card-near" : ""
      } ${resolved ? "arc-card-resolved" : ""}`}
    >
      <div className="flex items-start justify-between gap-4 border-b border-[var(--wl-line)] pb-5">
        <div>
          <p className="font-mono text-[9px] tracking-[.16em] text-[var(--wl-signal)]">
            {shortAddress(item.id, { head: 8, tail: 4 })} · HUMAN REVIEW
          </p>
          <h2 className="mt-3 text-[21px] font-medium tracking-[-.045em]">{item.agentName}</h2>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.12em] ${
              resolved
                ? "bg-[var(--wl-green-tint)] text-[var(--wl-green)]"
                : "border border-[var(--wl-signal)] text-[var(--wl-signal)]"
            }`}
          >
            {resolved ? (lastAction === "approve" ? "APPROVED" : "REJECTED") : "PENDING"}
          </span>
          {resolved && (
            <span className="arc-stamp px-2 py-1 font-mono text-[8px] tracking-[.12em]">
              RECORDED
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-7 py-6 md:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-mute)]">
            REQUEST
          </p>
          <p className="mt-3 text-[27px] font-medium tracking-[-.05em]">
            {amountLabel} <span className="text-[var(--wl-mute)]">→</span> {item.counterparty}
          </p>
          <p className="mt-4 text-[13px] text-[var(--wl-body)]">
            Reason: <span className="font-medium text-[var(--wl-ink)]">{item.reason}</span>
          </p>
        </div>
        <div className="border-l border-[var(--wl-line)] pl-5 md:pl-7">
          <p className="font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-mute)]">
            QUORUM / {item.quorumRequired} SIGNATURES
          </p>
          <div className="mt-4 flex gap-2">
            <div className="flex min-h-[62px] flex-1 flex-col justify-between border border-[var(--wl-faint)] bg-[var(--wl-bg-soft)] p-3">
              <span className="font-mono text-[9px] text-[var(--wl-green)]">SIGNED</span>
              <span className="text-[11px] font-medium">{item.quorumCurrent}</span>
              <span className="font-mono text-[8px] text-[var(--wl-mute)]">
                of {item.quorumRequired}
              </span>
            </div>
            <div className="flex min-h-[62px] flex-1 flex-col justify-between border border-dashed border-[var(--wl-signal)] p-3">
              <span className="font-mono text-[9px] text-[var(--wl-mute)]">AWAITING</span>
              <span className="text-[11px] text-[var(--wl-secondary2)]">operator signature</span>
              <span className="font-mono text-[8px] text-[var(--wl-mute)]">-</span>
            </div>
          </div>
          <div className="mt-5 flex items-baseline justify-between border-t border-[var(--wl-line)] pt-4">
            <span className="font-mono text-[9px] tracking-[.12em] text-[var(--wl-mute)]">
              EXPIRY
            </span>
            <span
              className={`font-mono text-[12px] tabular-nums ${
                isNear ? "text-[var(--wl-signal)]" : "text-[var(--wl-body)]"
              }`}
            >
              {item.expiresIn}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--wl-line)] pt-5">
        {!resolved ? (
          <>
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={(event) => void submitResolution("approve", event)}
              className="arc-pill min-h-11 md:min-h-0 rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[10px] font-semibold text-[var(--wl-bg)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={actionsDisabled}
              onClick={(event) => void submitResolution("reject", event)}
              className="arc-pill arc-ghost min-h-11 md:min-h-0 rounded-full border border-[var(--wl-line)] px-5 py-3 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-55"
            >
              Reject
            </button>
          </>
        ) : (
          <span className="font-mono text-[9px] tracking-[.12em] text-[var(--wl-green)]">
            FINAL DECISION COMMITTED TO LEDGER
          </span>
        )}
        <button
          type="button"
          onClick={copyPortal}
          className="ml-auto min-h-11 md:min-h-0 rounded-full border border-[var(--wl-line)] px-4 py-3 font-mono text-[9px] tracking-[.08em] text-[var(--wl-secondary2)] transition-colors duration-[220ms] hover:border-[var(--wl-ink)] hover:text-[var(--wl-ink)]"
        >
          Copy approver portal link
        </button>
      </div>

      {statusLine ? (
        <div
          className={`mt-4 font-mono text-[9px] tracking-[.12em] ${
            actionError ? "text-[var(--wl-red)]" : "text-[var(--wl-mute)]"
          }`}
        >
          {statusLine}
        </div>
      ) : null}
      {contractTxHash && getArcscanTxUrl(contractTxHash) ? (
        <a
          href={getArcscanTxUrl(contractTxHash) ?? undefined}
          target="_blank"
          rel="noreferrer"
          className="mt-2 block font-mono text-[9px] tracking-[.12em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
        >
          OPEN VOTE TX ↗
        </a>
      ) : null}
      <div className="mt-5 font-mono text-[9px] text-[var(--wl-mute)]">
        CREATED {formatFooterTimestamp(item.createdAt)}{" "}
        <span className="mx-2 text-[var(--wl-line)]">·</span> EXPIRES{" "}
        {formatFooterTimestamp(item.expiresAt)}
      </div>
    </article>
  );
}

export default function EscalationsPage() {
  const { dataMode, isResolving } = useWorkspaceMode();
  const readOnly = dataMode === "disconnected" && !isResolving;
  const liveEscalations = useLiveEscalations();
  const [resolvedIds, setResolvedIds] = useState<ReadonlySet<string>>(new Set());
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<number | null>(null);
  const showNotice = (message: string) => {
    setNotice(message);
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2600);
  };
  useEffect(() => {
    return () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    };
  }, []);

  const allEscalations = liveEscalations.data;
  const queue = useMemo(
    () => allEscalations.filter((item) => item.status === "PENDING"),
    [allEscalations],
  );
  const resolvedHistory = useMemo(() => {
    const decidedTime = (item: Escalation) => {
      const created = item.createdAt ? Date.parse(item.createdAt) : Number.NaN;
      if (!Number.isNaN(created)) return created;
      const expires = item.expiresAt ? Date.parse(item.expiresAt) : Number.NaN;
      return Number.isNaN(expires) ? 0 : expires;
    };
    return allEscalations
      .filter((item) => item.status !== "PENDING")
      .sort((a, b) => decidedTime(b) - decidedTime(a) || a.id.localeCompare(b.id));
  }, [allEscalations]);
  const pending = useMemo(
    () => queue.filter((item) => !resolvedIds.has(item.id)),
    [queue, resolvedIds],
  );
  const pendingCount = pending.length;
  const resolvedCount =
    resolvedHistory.length + queue.filter((item) => resolvedIds.has(item.id)).length;

  const reviewNext = () => {
    const next = pending[0];
    if (!next) {
      showNotice("The queue is clear.");
      return;
    }
    showNotice(
      `Reviewing ${shortAddress(next.id, { head: 8, tail: 4 })}, the oldest open request.`,
    );
    document.getElementById(`escalation-${next.id}`)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  };

  const loading = liveEscalations.isLoading && queue.length === 0;
  const errored = liveEscalations.isError && queue.length === 0;

  return (
    <div className="mx-auto max-w-[1400px] px-5 py-8 md:px-8 md:py-10">
      <style>{`
        .arc-pill{position:relative;isolation:isolate;overflow:hidden;transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 320ms cubic-bezier(.16,1,.3,1),color 220ms ease,border-color 220ms ease}
        .arc-pill:before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:var(--wl-signal-deep);transform:translateY(102%);transition:transform 320ms cubic-bezier(.16,1,.3,1)}
        .arc-pill:hover{transform:translateY(-2px);box-shadow:0 10px 28px -8px rgba(var(--wl-signal-rgb),.42),0 2px 6px rgba(var(--wl-ink-rgb),.08)}.arc-pill:hover:before{transform:translateY(0)}
        .arc-ghost:before{background:var(--wl-ink)}.arc-ghost:hover{color:var(--wl-bg);border-color:var(--wl-ink);box-shadow:0 10px 28px -10px rgba(var(--wl-ink-rgb),.35)}
        .arc-card{animation:cardIn 420ms cubic-bezier(.16,1,.3,1) calc(var(--card-i) * 110ms) both;transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 220ms ease}.arc-card:hover{transform:translateY(-3px);box-shadow:10px 14px 0 var(--wl-bg-deep2)}
        .arc-card-near{border-left:2px solid var(--wl-signal)}.arc-card-resolved{opacity:.76}.arc-stamp{transform:rotate(-7deg);border:1px solid var(--wl-green);color:var(--wl-green)}
        @keyframes cardIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}@media (prefers-reduced-motion:reduce){.arc-pill,.arc-card{animation:none!important;transition:none!important}.arc-card:hover,.arc-pill:hover{transform:none}}
      `}</style>

      <div className="flex flex-col justify-between gap-7 border-b border-[var(--wl-line)] pb-9 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
            QUORUM / HUMAN CONTROL
          </p>
          <h1 className="font-display mt-4 text-[clamp(2.7rem,5vw,4.8rem)] font-semibold leading-[.9] tracking-[-.015em]">
            Escalations
          </h1>
          <p className="mt-4 max-w-[560px] text-[14px] leading-[1.45] text-[var(--wl-secondary2)]">
            When an agent reaches the edge of its doctrine, a human gets the final word.
          </p>
        </div>
        <button
          type="button"
          onClick={reviewNext}
          className="arc-pill group w-fit rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[11px] font-semibold text-[var(--wl-bg)]"
        >
          Review next{" "}
          <span className="ml-2 transition-transform duration-[220ms] group-hover:translate-x-1">
            ↗
          </span>
        </button>
      </div>

      <div role="status" aria-live="polite">
        {notice && (
          <div className="fixed bottom-[calc(20px+env(safe-area-inset-bottom))] left-1/2 z-20 max-w-[calc(100vw-32px)] -translate-x-1/2 border border-[var(--wl-ink)] bg-[var(--wl-ink)] px-4 py-3 font-mono text-[10px] text-[var(--wl-bg)] shadow-[0_12px_28px_rgba(var(--wl-ink-rgb),.18)] md:bottom-5">
            {notice}
          </div>
        )}
      </div>

      <section className="grid grid-cols-3 border-b border-[var(--wl-line)]">
        <div className="py-6">
          <p className="font-mono text-[9px] tracking-[.15em] text-[var(--wl-mute)]">PENDING</p>
          <p className="font-display mt-3 text-[34px] font-medium tracking-[-.015em] text-[var(--wl-signal)]">
            {pendingCount}
          </p>
        </div>
        <div className="border-l border-[var(--wl-line)] py-6 pl-5 md:pl-7">
          <p className="font-mono text-[9px] tracking-[.15em] text-[var(--wl-mute)]">IN QUEUE</p>
          <p className="font-display mt-3 text-[34px] font-medium tracking-[-.015em]">
            {queue.length}
          </p>
        </div>
        <div className="border-l border-[var(--wl-line)] py-6 pl-5 md:pl-7">
          <p className="font-mono text-[9px] tracking-[.15em] text-[var(--wl-mute)]">RESOLVED</p>
          <p className="font-display mt-3 text-[34px] font-medium tracking-[-.015em]">
            {resolvedCount}
          </p>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {readOnly ? (
          <ConnectCta className="lg:col-span-2 border border-dashed border-[var(--wl-line)] p-12 text-center" />
        ) : loading ? (
          [0, 1].map((card) => (
            <div
              key={card}
              className="border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] p-5 md:p-7"
            >
              <div className="h-4 w-40 animate-pulse rounded bg-[var(--wl-line-soft)]" />
              <div className="mt-6 h-8 w-3/4 animate-pulse rounded bg-[var(--wl-line-soft)]" />
              <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-[var(--wl-line-soft)]" />
              <div className="mt-8 h-10 w-full animate-pulse rounded bg-[var(--wl-line-soft)]" />
            </div>
          ))
        ) : errored ? (
          <div className="lg:col-span-2 border border-dashed border-[var(--wl-line)] p-12 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
              ESCALATION QUERY FAILED
            </p>
            <button
              type="button"
              onClick={() => void liveEscalations.refetch()}
              className="mt-3 font-mono text-[10px] tracking-[.12em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
            >
              RETRY
            </button>
          </div>
        ) : queue.length === 0 ? (
          <div className="lg:col-span-2 border border-dashed border-[var(--wl-line)] p-12 text-center font-mono text-[10px] tracking-[.14em] text-[var(--wl-secondary)]">
            QUEUE CLEAR · NO PENDING ESCALATIONS
          </div>
        ) : (
          queue.map((item, index) => (
            <EscalationCard
              key={item.id}
              item={item}
              index={index}
              cardId={`escalation-${item.id}`}
              onResolved={() =>
                setResolvedIds((current) => {
                  const next = new Set(current);
                  next.add(item.id);
                  return next;
                })
              }
            />
          ))
        )}
      </div>

      {resolvedHistory.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline justify-between border-b border-[var(--wl-line)] pb-4">
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-mute)]">
              RESOLVED / THE FINAL WORD
            </p>
            <p className="font-mono text-[10px] tracking-[.12em] text-[var(--wl-mute)]">
              {resolvedHistory.length} DECIDED
            </p>
          </div>
          <ul>
            {resolvedHistory.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 border-b border-[var(--wl-line-soft)] py-4 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex min-w-0 items-center gap-4">
                  <span
                    className={`inline-block w-[86px] shrink-0 border px-2 py-1 text-center font-mono text-[9px] tracking-[.12em] ${
                      item.status === "EXECUTED"
                        ? "border-[var(--wl-green)] text-[var(--wl-green)]"
                        : item.status === "REJECTED"
                          ? "border-[var(--wl-signal)] text-[var(--wl-signal)]"
                          : "border-[var(--wl-line-bold)] text-[var(--wl-mute)]"
                    }`}
                  >
                    {item.status === "EXECUTED"
                      ? "APPROVED"
                      : item.status === "REJECTED"
                        ? "REJECTED"
                        : "EXPIRED"}
                  </span>
                  <span className="truncate text-[13px]">
                    {formatUsd(item.amount)} <span className="text-[var(--wl-mute)]">→</span>{" "}
                    {item.counterparty}
                  </span>
                </div>
                <div className="flex items-baseline gap-5 pl-[102px] md:pl-0">
                  <span className="line-clamp-2 max-w-[360px] text-[11px] leading-[1.4] text-[var(--wl-secondary2)] lg:truncate">
                    {item.reason}
                  </span>
                  <span className="shrink-0 font-mono text-[9px] tracking-[.12em] text-[var(--wl-mute)]">
                    {formatFooterTimestamp(item.createdAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
