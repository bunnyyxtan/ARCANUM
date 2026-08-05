"use client";

import { EmberMark } from "@/components/warm/EmberMark";
import { ARC_TESTNET_EXPLORER_URL, arcTestnet } from "@arcanum/shared";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import Link from "next/link";

import { ThemeToggle } from "@/components/warm/ThemeToggle";
import { useEffect, useRef, useState } from "react";
import type { Address, Hash } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";

import { escalationManagerAbi, escalationStatusLabels } from "@/lib/contracts";
import { isConfiguredAddress, isZeroAddress, shortAddress } from "@/lib/format/address";
import { formatUsd } from "@/lib/format/money";
import { getCountdownState } from "@/lib/format/time";
import { trpc } from "@/lib/trpc";

function isTxHashValue(value: string | null | undefined): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{64}$/.test(value ?? "");
}

function errorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "shortMessage" in error) {
    return String((error as { shortMessage?: unknown }).shortMessage);
  }
  return error instanceof Error ? error.message : "Transaction failed. Please retry.";
}

type Stage = "idle" | "checking" | "wallet" | "confirming" | "pending_indexer" | "done" | "error";

export function ApprovePublicPage({ txHash }: Readonly<{ txHash: string }>) {
  const escalationId = isTxHashValue(txHash) ? txHash : null;
  const escalationManagerAddress = isConfiguredAddress(process.env.NEXT_PUBLIC_ESCALATION_MANAGER)
    ? (process.env.NEXT_PUBLIC_ESCALATION_MANAGER as Address)
    : null;

  const { address, chainId, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();
  const { writeContractAsync, isPending: writePending } = useWriteContract();
  const utils = trpc.useUtils();

  const submittingRef = useRef(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [lastAction, setLastAction] = useState<"approve" | "reject" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [contractTxHash, setContractTxHash] = useState<Hash | null>(null);
  const [now, setNow] = useState<number | undefined>(undefined);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const approvalQuery = trpc.escalations.byTxHash.useQuery(
    { txHash: (escalationId ?? "0x") as `0x${string}` },
    {
      enabled: Boolean(escalationId),
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  );
  const escalation = approvalQuery.data;

  const amount =
    escalation?.amount !== undefined && escalation?.amount !== null
      ? formatUsd(Number(escalation.amount) / 1_000_000)
      : "NO DATA";
  const counterparty = escalation?.toAddress
    ? shortAddress(escalation.toAddress)
    : "NO INDEXED ESCALATION";
  const walletLabel = escalation?.walletId ?? "UNKNOWN";
  const reason = escalation?.reason ?? "No indexed escalation was found for this id.";
  const quorum = escalation ? `${escalation.signaturesCount} / ${escalation.threshold}` : "N/A";
  const escalationStatus = escalation?.status ?? null;
  const stateLine = escalation
    ? `ESC / ${escalationStatus}`
    : approvalQuery.isLoading
      ? "ESC / LOADING"
      : "ESC / NOT INDEXED";
  const createdLabel = escalation?.createdAt
    ? `${new Date(escalation.createdAt).toISOString().replace("T", " · ").slice(0, 22)} UTC`
    : "N/A";
  const countdown = getCountdownState(escalation?.expiresAt ?? null, now);

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
        ? "Arc Testnet RPC is unavailable."
        : !escalation
          ? "No indexed escalation found for this id."
          : countdown.isExpired
            ? "Escalation is expired. Expired requests cannot be signed."
            : escalationStatus && escalationStatus !== "PENDING"
              ? `Escalation is already ${escalationStatus.toLowerCase()}.`
              : null;

  const actionsDisabled =
    Boolean(disabledReason) || isBusy || stage === "pending_indexer" || stage === "done";

  const statusLine =
    actionError ??
    (stage === "pending_indexer"
      ? "Contract confirmed. Waiting for indexer sync."
      : stage === "checking"
        ? "Checking approver permission on Arc Testnet."
        : disabledReason);

  const readPreflight = async () => {
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
      throw new Error("Escalation is expired. Expired requests cannot be signed.");
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

  const submit = async (action: "approve" | "reject") => {
    if (!isConnected || !address) {
      openConnectModal?.();
      return;
    }
    if (actionsDisabled || submittingRef.current || !escalationManagerAddress || !escalationId) {
      return;
    }

    submittingRef.current = true;
    setLastAction(action);
    setActionError(null);
    setContractTxHash(null);
    setStage("checking");

    try {
      const preflight = await readPreflight();

      if (chainId !== arcTestnet.id) {
        setStage("wallet");
        await switchChainAsync({ chainId: arcTestnet.id });
      }

      setStage("wallet");
      const hash = await writeContractAsync({
        address: escalationManagerAddress,
        abi: escalationManagerAbi,
        functionName: action,
        args: [escalationId],
        chainId: arcTestnet.id,
      });
      setContractTxHash(hash);
      setStage("confirming");

      const receipt = await publicClient?.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });
      if (receipt?.status !== "success") {
        throw new Error("Escalation transaction reverted.");
      }

      await utils.escalations.byTxHash.invalidate({ txHash: escalationId });
      setStage("done");

      const { toast } = await import("sonner");
      if (action === "approve") {
        const nextCount = preflight.signaturesCount + 1;
        toast.success(
          nextCount >= preflight.threshold
            ? "ESCALATION APPROVED / QUORUM REACHED"
            : `ESCALATION APPROVED / ${nextCount} OF ${preflight.threshold} QUORUM`,
          {
            description:
              nextCount >= preflight.threshold
                ? `Release for ${amount} to ${counterparty} executed. Pending indexer sync.`
                : `Vote for ${amount} to ${counterparty} confirmed on-chain. Pending indexer sync.`,
          },
        );
      } else {
        toast.success("ESCALATION REJECTED", {
          description: `Rejection for ${amount} to ${counterparty} confirmed on-chain. Pending indexer sync.`,
        });
      }
    } catch (caught) {
      setStage("error");
      const message = errorMessage(caught);
      setActionError(message);
      const { toast } = await import("sonner");
      toast.error("ESCALATION ACTION FAILED", { description: message });
    } finally {
      submittingRef.current = false;
    }
  };

  const decided = stage === "done";
  const contractTxUrl = contractTxHash
    ? `${process.env.NEXT_PUBLIC_ARCSCAN_URL ?? ARC_TESTNET_EXPLORER_URL}/tx/${contractTxHash}`
    : null;

  return (
    <main className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]">
      <style>
        {
          "@keyframes rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}.rise{animation:rise 500ms cubic-bezier(.16,1,.3,1) both}@media(prefers-reduced-motion:reduce){.rise{animation:none}.pa-action,.pa-action *{transition:none!important;transform:none!important;box-shadow:none!important}}"
        }
      </style>
      <nav className="flex items-center justify-between border-b border-[var(--wl-line)] px-5 py-5 md:px-9">
        <Link
          href="/"
          className="font-display flex items-center gap-2 text-[18px] font-bold tracking-[-.015em]"
        >
          <EmberMark size={24} />
          ARCANUM<span className="text-[var(--wl-signal)]">.</span>
        </Link>
        <div className="flex items-center gap-5">
          <span className="hidden font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-mute)] sm:inline">
            PUBLIC APPROVER PORTAL
          </span>
          <span className="rounded-full border border-[var(--wl-line)] px-3 py-1.5 font-mono text-[9px] tracking-[.12em] text-[var(--wl-body)]">
            ARC TESTNET
          </span>
          <ThemeToggle />
        </div>
      </nav>
      <div className="mx-auto max-w-[1080px] px-5 py-10 md:px-9 md:py-16">
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
          className="rise mt-10 grid border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] shadow-[12px_14px_0_var(--wl-bg-deep2)] md:grid-cols-[1.15fr_.85fr]"
          style={{ animationDelay: "100ms" }}
        >
          <div className="p-6 md:p-10">
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

          <aside className="border-t border-[var(--wl-line)] bg-[var(--wl-bg-soft)] p-6 md:border-l md:border-t-0 md:p-8">
            <p className="font-mono text-[9px] uppercase tracking-[.17em] text-[var(--wl-mute)]">
              YOUR SIGNATURE
            </p>

            {!decided && stage !== "checking" && stage !== "wallet" && stage !== "confirming" && (
              <>
                <h3 className="font-display mt-5 text-[22px] font-medium tracking-[-.015em]">
                  Bless or restrain
                  <br />
                  the request.
                </h3>
                <p className="mt-4 text-[13px] leading-[1.5] text-[var(--wl-body)]">
                  Your decision is signed on-chain and becomes part of the immutable decision
                  record. There is no silent approval.
                </p>
                <div className="mt-9 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void submit("approve")}
                    disabled={actionsDisabled}
                    className="pa-action group relative overflow-hidden rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[11px] font-semibold text-[var(--wl-bg)] transition duration-[220ms] hover:-translate-y-0.5 hover:shadow-[0_10px_26px_-9px_rgba(var(--wl-signal-rgb),.5)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  >
                    <span className="relative z-10">
                      {!isConnected ? "Connect to approve" : "Approve transaction"}{" "}
                      <span className="ml-2 inline-block transition-transform duration-[220ms] group-hover:translate-x-1 group-disabled:translate-x-0">
                        ↗
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void submit("reject")}
                    disabled={actionsDisabled}
                    className="pa-action group relative overflow-hidden rounded-full border border-[var(--wl-line)] px-5 py-3 text-[11px] font-semibold text-[var(--wl-ink)] transition duration-[220ms] hover:-translate-y-0.5 hover:border-[var(--wl-ink)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
                  >
                    <span className="relative z-10">
                      Reject{" "}
                      <span className="ml-2 inline-block transition-transform duration-[220ms] group-hover:translate-x-1 group-disabled:translate-x-0">
                        ↗
                      </span>
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

            {(stage === "checking" || stage === "wallet" || stage === "confirming") && (
              <div className="py-12">
                <p className="font-mono text-[10px] uppercase tracking-[.15em] text-[var(--wl-signal)]">
                  {stage === "checking"
                    ? "CHECKING PERMISSION"
                    : stage === "confirming"
                      ? "CONFIRMING ON-CHAIN"
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
                  DECISION RECORDED
                </p>
                <h3
                  className={`font-display mt-5 text-[25px] font-medium ${
                    lastAction === "approve" ? "text-[var(--wl-green)]" : "text-[var(--wl-signal)]"
                  }`}
                >
                  {lastAction === "approve" ? "Approved by operator." : "Rejected by operator."}
                </h3>
                <p className="mt-4 text-[13px] leading-[1.5] text-[var(--wl-body)]">
                  The signed record is now visible to the agent operator and the public ledger.
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
