"use client";

import { ARC_NETWORK_NAME, arcChain, escalationStatusFromIndex } from "@arcanum/shared";
import { type MouseEvent as ReactMouseEvent, useRef, useState } from "react";
import { toast } from "sonner";
import type { Address, Hash } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";

import { describeChainError, errorText } from "@/lib/chain-errors";
import { escalationManagerAbi, guardedWalletControlAbi } from "@/lib/contracts";
import { contractAddresses } from "@/lib/deployment";
import { isConfiguredAddress, isSameAddress, isZeroAddress } from "@/lib/format/address";
import { formatUsd } from "@/lib/format/money";
import { trpc } from "@/lib/trpc";
import type { Escalation } from "@/lib/types";

import { allowTrustedMutation, isTxHashValue } from "../_lib/helpers";

type TxStage = "idle" | "checking" | "wallet" | "confirming" | "pending_indexer" | "error";
type ResolutionAction = "approve" | "reject" | "cancel";
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
  const [lastAction, setLastAction] = useState<ResolutionAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [contractTxHash, setContractTxHash] = useState<Hash | null>(null);

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
  const ownerCanCancel = Boolean(address && isSameAddress(address, item.wallet));
  const statusLine =
    actionError ??
    (txStage === "pending_indexer"
      ? "Contract confirmed. Updating the record."
      : txStage === "checking"
        ? `Checking approver permission on ${ARC_NETWORK_NAME}.`
        : disabledReason);

  const readEscalationPreflight = async (action: ResolutionAction) => {
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
    const status = escalationStatusFromIndex(Number(detail[8])) ?? "INVALIDATED";
    if (isZeroAddress(wallet)) throw new Error(`Escalation was not found on ${ARC_NETWORK_NAME}.`);
    if (status !== "PENDING") throw new Error(`Escalation is already ${status.toLowerCase()}.`);
    const expiresAtMs = Number(detail[5]) * 1000;
    if (Number.isFinite(expiresAtMs) && Date.now() >= expiresAtMs) {
      throw new Error("Escalation is expired. Expired requests cannot be approved or rejected.");
    }
    if (action === "cancel") {
      if (!isSameAddress(wallet, item.wallet) || !ownerCanCancel) {
        throw new Error("Only the governed wallet owner can cancel this escalation.");
      }
      return { signaturesCount: Number(detail[7]), threshold: Number(detail[6]) };
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
    if (alreadySigned) throw new Error("This approver has already voted on this escalation.");
    return { signaturesCount: Number(detail[7]), threshold: Number(detail[6]) };
  };

  const submitResolution = async (
    action: ResolutionAction,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    if (!allowTrustedMutation(`escalations.${action}`, event)) return;
    if (actionsDisabled || submittingRef.current || !escalationManagerAddress || !escalationId) {
      return;
    }
    submittingRef.current = true;
    setLastAction(action);
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
        address: action === "cancel" ? (item.wallet as Address) : escalationManagerAddress,
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
      const settledStatus = escalationStatusFromIndex(Number(settledDetail[8])) ?? "INVALIDATED";
      const settledCount = Number(settledDetail[7]);

      let syncFailed: string | null = null;
      const terminal = settledStatus !== "PENDING";
      if (terminal) {
        try {
          await recordDecision.mutateAsync({ escalationKey: escalationId, txHash: hash });
        } catch (caught) {
          syncFailed = errorText(caught);
        }
      }
      await Promise.all([utils.escalations.list.invalidate(), utils.ledger.list.invalidate()]);
      setTxStage(terminal ? "pending_indexer" : "idle");
      onChainUpdate({ signaturesCount: settledCount, status: settledStatus });
      const amountLabel = formatUsd(item.amount);
      if (syncFailed) {
        toast.warning("DECISION LIVE ONCHAIN · QUEUE NOT SYNCED", {
          description: `The decision is settled on ${ARC_NETWORK_NAME}, but the queue could not be updated: ${syncFailed}`,
        });
      } else if (action === "approve") {
        if (settledStatus === "PENDING") {
          toast.success(`VOTE RECORDED / ${settledCount} OF ${preflight.threshold} QUORUM`, {
            description: `Vote for ${amountLabel} to ${item.counterparty} confirmed onchain.`,
          });
        } else if (settledStatus === "EXECUTED") {
          toast.success("ESCALATION EXECUTED / QUORUM REACHED", {
            description: `Release for ${amountLabel} to ${item.counterparty} executed in the approval transaction.`,
          });
        } else if (settledStatus === "DENIED") {
          toast.warning("RELEASE DENIED BY CURRENT POLICY", {
            description: `The council reached quorum, but policy re-evaluation denied release of ${amountLabel} to ${item.counterparty}.`,
          });
        } else {
          toast.warning(`ESCALATION ${settledStatus}`, {
            description:
              "The vote transaction settled the escalation without executing the transfer.",
          });
        }
      } else if (action === "cancel") {
        toast.success("ESCALATION CANCELLED ONCHAIN");
      } else {
        toast.success("ESCALATION REJECTED", {
          description: `Rejection for ${amountLabel} to ${item.counterparty} confirmed onchain.`,
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
    try {
      if (navigator.clipboard) await navigator.clipboard.writeText(link);
      toast.success("Approver portal link copied.");
    } catch (caught) {
      toast.error("APPROVER PORTAL LINK COPY FAILED", { description: errorText(caught) });
    }
  };

  return {
    actionError,
    actionsDisabled,
    contractTxHash,
    copyPortal,
    lastAction,
    ownerCanCancel,
    resolved: txStage === "pending_indexer",
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
