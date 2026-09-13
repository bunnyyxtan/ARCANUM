"use client";

import { ARC_NETWORK_NAME, arcChain } from "@arcanum/shared";
import { type MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { type Address, type Hash, isAddress } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";

import { describeChainError, errorText } from "@/lib/chain-errors";
import { copyText } from "@/lib/clipboard";
import { escalationManagerAbi, guardedWalletControlAbi } from "@/lib/contracts";
import { contractAddresses } from "@/lib/deployment";
import {
  type EscalationChainTerms,
  cancellationTargetFromChain,
  compareEscalationTerms,
  escalationChainTermsFromDetail,
  escalationExpiryState,
  escalationStatusLabel,
  escalationVotePreflightError,
  formatBaseUnits,
  isEscalationTerminalStatus,
} from "@/lib/escalation-truth";
import { isConfiguredAddress, isSameAddress, isZeroAddress } from "@/lib/format/address";
import { trpc } from "@/lib/trpc";
import type { Escalation } from "@/lib/types";

import { allowTrustedMutation, isTxHashValue } from "../_lib/helpers";

type TxStage = "idle" | "checking" | "wallet" | "confirming" | "pending_indexer" | "error";
type ResolutionAction = "approve" | "reject" | "cancel" | "sweepExpired";
export type EscalationChainUpdate = {
  signaturesCount: number;
  status: Escalation["status"];
};

function useEscalationActionInternal(
  item: Escalation,
  onChainUpdate: (update: EscalationChainUpdate) => void,
) {
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcChain.id });
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();
  const { writeContractAsync, isPending: writePending } = useWriteContract();
  const utils = trpc.useUtils();
  const recordDecision = trpc.escalations.recordDecision.useMutation();
  const submittingRef = useRef(false);
  const [txStage, setTxStage] = useState<TxStage>("idle");
  const [actionError, setActionError] = useState<string | null>(null);
  const [contractTxHash, setContractTxHash] = useState<Hash | null>(null);
  const [chainOwner, setChainOwner] = useState<Address | null>(null);
  const [ownerReadState, setOwnerReadState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [chainTerms, setChainTerms] = useState<EscalationChainTerms | null>(null);
  const [chainReadState, setChainReadState] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [nowMs, setNowMs] = useState(0);
  const [settledStatus, setSettledStatus] = useState<Escalation["status"]>(item.status);

  const escalationManagerAddress = isConfiguredAddress(contractAddresses.escalationManager)
    ? (contractAddresses.escalationManager as Address)
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
        ? `${ARC_NETWORK_NAME} RPC is unavailable.`
        : !isConnected || !address
          ? "Connect the approver wallet first."
          : null;
  const actionsDisabled = Boolean(disabledReason) || isBusy || txStage === "pending_indexer";
  const sweepDisabledReason = !escalationId
    ? "Escalation id is missing."
    : !escalationManagerAddress
      ? "EscalationManager address is not configured."
      : !publicClient
        ? `${ARC_NETWORK_NAME} RPC is unavailable.`
        : !isConnected || !address
          ? "Connect any wallet to settle this expired request."
          : null;
  const sweepActionsDisabled =
    Boolean(sweepDisabledReason) || isBusy || txStage === "pending_indexer";
  const chainExpiry =
    chainTerms && nowMs > 0
      ? escalationExpiryState({
          status: chainTerms.status,
          expiresAt: chainTerms.expiresAt,
          nowSeconds: BigInt(Math.floor(nowMs / 1000)),
        })
      : null;
  const readModelExpiryReached =
    item.status === "PENDING" &&
    item.expiresAt !== null &&
    Number.isFinite(Date.parse(item.expiresAt)) &&
    Date.now() >= Date.parse(item.expiresAt);
  const expiredUnsettled = chainExpiry === "UNSWEPT";
  const expiryVerificationRequired =
    !expiredUnsettled && readModelExpiryReached && chainReadState !== "ready";
  const ownerCanCancel =
    Boolean(address && chainOwner && isSameAddress(address, chainOwner)) &&
    ownerReadState === "ready" &&
    item.status === "PENDING" &&
    !expiredUnsettled;
  const isResolved = isEscalationTerminalStatus(settledStatus);
  const statusLine =
    actionError ??
    (expiredUnsettled
      ? (sweepDisabledReason ?? "Expired request can be settled by any connected wallet.")
      : txStage === "pending_indexer"
        ? "Contract confirmed. Updating the record."
        : txStage === "checking"
          ? `Checking approver permission on ${ARC_NETWORK_NAME}.`
          : disabledReason);

  useEffect(() => {
    if (item.status !== "PENDING") {
      setSettledStatus(item.status);
    }
  }, [item.status]);

  useEffect(() => {
    setNowMs(Date.now());
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!publicClient || !escalationManagerAddress || !escalationId) {
      setChainTerms(null);
      setChainReadState("error");
      return () => {
        cancelled = true;
      };
    }
    setChainReadState("loading");
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
            walletAddress: item.walletAddress,
            counterpartyAddress: item.counterpartyAddress,
            amountBaseUnits: item.amountBaseUnits,
          },
          terms,
        );
        if (!binding.ok) {
          throw new Error(
            `Displayed escalation terms do not match the current chain request (${binding.reason}).`,
          );
        }
        setChainTerms(terms);
        setChainReadState("ready");
        if (terms.status !== "PENDING") setSettledStatus(terms.status);
      })
      .catch(() => {
        if (!cancelled) {
          setChainTerms(null);
          setChainReadState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    escalationId,
    escalationManagerAddress,
    item.amountBaseUnits,
    item.counterpartyAddress,
    item.walletAddress,
    publicClient,
  ]);

  useEffect(() => {
    let cancelled = false;
    const walletAddress = item.walletAddress;
    if (!publicClient || !isAddress(walletAddress)) {
      setChainOwner(null);
      setOwnerReadState("error");
      return () => {
        cancelled = true;
      };
    }
    setOwnerReadState("loading");
    void publicClient
      .readContract({
        address: walletAddress,
        abi: guardedWalletControlAbi,
        functionName: "owner",
      })
      .then((owner) => {
        if (!cancelled) {
          setChainOwner(owner as Address);
          setOwnerReadState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setChainOwner(null);
          setOwnerReadState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [item.walletAddress, publicClient]);

  const readEscalationPreflight = async (
    action: ResolutionAction,
  ): Promise<EscalationChainTerms & { cancellationTarget?: Address }> => {
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
    const binding = compareEscalationTerms(
      {
        walletAddress: item.walletAddress,
        counterpartyAddress: item.counterpartyAddress,
        amountBaseUnits: item.amountBaseUnits,
      },
      terms,
    );
    if (!binding.ok) {
      throw new Error(
        `Displayed escalation terms do not match the current chain request (${binding.reason}).`,
      );
    }
    if (terms.status !== "PENDING") {
      setSettledStatus(terms.status);
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
      throw new Error("Escalation is expired. Expired requests cannot be approved or rejected.");
    }
    if (action === "cancel") {
      const currentOwner = await publicClient.readContract({
        address: terms.walletAddress,
        abi: guardedWalletControlAbi,
        functionName: "owner",
      });
      const cancellationTarget = cancellationTargetFromChain({
        displayedWalletAddress: item.walletAddress,
        chainWalletAddress: terms.walletAddress,
        chainOwnerAddress: currentOwner,
        connectedAddress: address,
      });
      if (!cancellationTarget) {
        throw new Error("Only the governed wallet owner can cancel this escalation.");
      }
      return { ...terms, cancellationTarget };
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

  const submitResolution = async (
    action: ResolutionAction,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    if (!allowTrustedMutation(`escalations.${action}`, event)) return;
    const actionDisabled = action === "sweepExpired" ? sweepActionsDisabled : actionsDisabled;
    if (actionDisabled || submittingRef.current || !escalationManagerAddress || !escalationId) {
      return;
    }
    submittingRef.current = true;
    setActionError(null);
    setContractTxHash(null);
    setTxStage("checking");
    try {
      const preflight = await readEscalationPreflight(action);
      if (chainId !== arcChain.id) {
        setTxStage("wallet");
        await switchChainAsync({ chainId: arcChain.id });
      }
      setTxStage("wallet");
      const hash = await writeContractAsync({
        address:
          action === "cancel"
            ? (preflight.cancellationTarget ??
              (() => {
                throw new Error("Governed wallet cancellation target is unavailable.");
              })())
            : escalationManagerAddress,
        abi: action === "cancel" ? guardedWalletControlAbi : escalationManagerAbi,
        functionName: action === "cancel" ? "cancelEscalation" : action,
        args: [escalationId],
        chainId: arcChain.id,
      });
      setContractTxHash(hash);
      setTxStage("confirming");
      const receipt = await publicClient?.waitForTransactionReceipt({ hash, confirmations: 1 });
      if (receipt?.status !== "success") throw new Error("Escalation transaction reverted.");
      if (!publicClient) throw new Error(`${ARC_NETWORK_NAME} RPC is unavailable.`);
      const settledDetail = await publicClient.readContract({
        address: escalationManagerAddress,
        abi: escalationManagerAbi,
        functionName: "getEscalation",
        args: [escalationId],
      });
      const settled = escalationChainTermsFromDetail(settledDetail);
      const settledBinding = compareEscalationTerms(
        {
          walletAddress: item.walletAddress,
          counterpartyAddress: item.counterpartyAddress,
          amountBaseUnits: item.amountBaseUnits,
        },
        settled,
      );
      if (!settledBinding.ok) {
        throw new Error(
          `Settled chain terms no longer match the displayed request (${settledBinding.reason}).`,
        );
      }
      const settledStatus = settled.status;
      const settledCount = settled.signaturesCount;
      setChainTerms(settled);
      setSettledStatus(settledStatus);

      let syncFailed: string | null = null;
      const terminal = settledStatus !== "PENDING";
      if (terminal && action !== "sweepExpired") {
        try {
          await recordDecision.mutateAsync({ escalationKey: escalationId, txHash: hash });
        } catch (caught) {
          syncFailed = errorText(caught);
        }
      }
      try {
        await Promise.all([utils.escalations.list.invalidate(), utils.ledger.list.invalidate()]);
      } catch {
        // Cache refresh is best effort after the receipt and settled read.
      }
      setTxStage(terminal ? "pending_indexer" : "idle");
      onChainUpdate({ signaturesCount: settledCount, status: settledStatus });
      const amountLabel = formatBaseUnits(item.amountBaseUnits);
      if (syncFailed) {
        toast.warning("DECISION LIVE ONCHAIN · QUEUE NOT SYNCED", {
          description: `The decision is settled on ${ARC_NETWORK_NAME}, but the queue could not be updated: ${syncFailed}`,
        });
      } else if (settledStatus === "PENDING") {
        toast.success(`VOTE RECORDED / ${settledCount} OF ${preflight.threshold} QUORUM`, {
          description: `Vote for ${amountLabel} to ${item.counterparty} confirmed onchain.`,
        });
      } else if (settledStatus === "EXECUTED") {
        toast.success(escalationStatusLabel(settledStatus), {
          description: `Release for ${amountLabel} to ${item.counterparty} executed onchain.`,
        });
      } else if (settledStatus === "DENIED") {
        toast.warning(escalationStatusLabel(settledStatus), {
          description: `Policy re-evaluation denied release of ${amountLabel} to ${item.counterparty}.`,
        });
      } else if (settledStatus === "CANCELLED") {
        toast.success(escalationStatusLabel(settledStatus));
      } else if (settledStatus === "EXPIRED") {
        toast.success("ESCALATION EXPIRED · SETTLED", {
          description: `Expiry for ${amountLabel} to ${item.counterparty} is now finalized onchain.`,
        });
      } else {
        toast.warning(escalationStatusLabel(settledStatus), {
          description: `The chain settled this request as ${settledStatus}; no execution was inferred.`,
        });
      }
    } catch (caught) {
      setTxStage("error");
      const message = describeChainError(caught);
      setActionError(message);
      toast.error("ESCALATION ACTION FAILED", { description: message });
    } finally {
      submittingRef.current = false;
    }
  };

  const copyPortal = async () => {
    const link = `${window.location.origin}/approve/${item.id}`;
    const copied = await copyText(link);
    if (copied) {
      toast.success("Approver portal link copied.");
    } else {
      toast.error("APPROVER PORTAL LINK COPY FAILED", {
        description: "Clipboard unavailable. Copy the portal URL from the address bar.",
      });
    }
  };

  return {
    actionError,
    actionsDisabled,
    contractTxHash,
    copyPortal,
    expiredUnsettled,
    expiryVerificationRequired,
    ownerCanCancel,
    resolved: isResolved || txStage === "pending_indexer",
    resolvedStatus: isResolved || txStage === "pending_indexer" ? settledStatus : null,
    sweepActionsDisabled,
    sweepDisabledReason,
    statusLine,
    submitResolution,
  };
}

export type EscalationAction = ReturnType<typeof useEscalationActionInternal>;

export function useEscalationAction(
  item: Escalation,
  onChainUpdate: (update: EscalationChainUpdate) => void,
): EscalationAction {
  return useEscalationActionInternal(item, onChainUpdate);
}
