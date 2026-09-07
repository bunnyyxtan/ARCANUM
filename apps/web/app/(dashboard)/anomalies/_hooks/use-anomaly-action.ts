"use client";

import { useState } from "react";
import { toast } from "sonner";
import { stringToHex } from "viem";
import type { Address } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";

import { describeChainError } from "@/lib/chain-errors";
import { guardedWalletControlAbi } from "@/lib/contracts";
import { isEvmAddress, isSameAddress } from "@/lib/format/address";
import { trpc } from "@/lib/trpc";
import type { Anomaly } from "@/lib/types";
import { arcChain } from "@arcanum/shared";

import { allowTrustedMutation } from "../../escalations/_lib/helpers";

export type AnomalyRowState = "idle" | "frozen" | "dismissed";

export function useAnomalyAction(item: Anomaly, onNotice: (message: string) => void) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcChain.id });
  const { writeContractAsync } = useWriteContract();
  const walletAddress = isEvmAddress(item.wallet) ? (item.wallet as Address) : undefined;
  const ownerQuery = useReadContract({
    address: walletAddress,
    abi: guardedWalletControlAbi,
    functionName: "owner",
    chainId: arcChain.id,
    query: { enabled: Boolean(walletAddress) },
  });
  const frozenQuery = useReadContract({
    address: walletAddress,
    abi: guardedWalletControlAbi,
    functionName: "frozen",
    chainId: arcChain.id,
    query: { enabled: Boolean(walletAddress) },
  });
  const utils = trpc.useUtils();
  const acknowledge = trpc.anomalies.acknowledge.useMutation();
  const dismiss = trpc.anomalies.dismiss.useMutation();
  const [state, setState] = useState<AnomalyRowState>("idle");
  const owner = ownerQuery.data;
  const isOwner = Boolean(address && owner && isSameAddress(address, owner));
  const restrainDisabledReason = !isConnected
    ? "Connect wallet first."
    : !walletAddress
      ? "Governed wallet address is unavailable."
      : ownerQuery.isLoading
        ? "Checking governed wallet owner."
        : !isOwner
          ? "Only the governed wallet owner can freeze this wallet."
          : null;

  const settle = async (
    next: "frozen" | "dismissed",
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    const action = next === "dismissed" ? "anomalies.dismiss" : "GuardedWallet.freeze";
    if (!allowTrustedMutation(action, event) || !isConnected) {
      return;
    }
    if (!item.id) {
      toast.error("ANOMALY ID MISSING / REFRESH AND RETRY");
      return;
    }

    try {
      const anomalyId = item.id;
      if (next === "dismissed") {
        await dismiss.mutateAsync({ anomalyId });
      } else {
        if (restrainDisabledReason || !walletAddress || !publicClient) {
          throw new Error(restrainDisabledReason ?? "Arc RPC is unavailable.");
        }
        const reason = stringToHex(`anomaly:${anomalyId}`);
        await publicClient.simulateContract({
          account: address,
          address: walletAddress,
          abi: guardedWalletControlAbi,
          functionName: "freeze",
          args: [reason],
        });
        const hash = await writeContractAsync({
          account: address,
          address: walletAddress,
          abi: guardedWalletControlAbi,
          functionName: "freeze",
          args: [reason],
          chainId: arcChain.id,
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
        if (receipt.status !== "success") throw new Error("Wallet freeze transaction reverted.");
        const frozen = await publicClient.readContract({
          address: walletAddress,
          abi: guardedWalletControlAbi,
          functionName: "frozen",
        });
        if (!frozen) throw new Error("Wallet did not report a frozen state after confirmation.");
        setState("frozen");
        await frozenQuery.refetch();
        onNotice(`${item.agentName.toUpperCase()} WALLET FROZEN ONCHAIN`);
        try {
          await acknowledge.mutateAsync({ anomalyId });
        } catch (caught) {
          toast.warning("WALLET FROZEN ONCHAIN · ACKNOWLEDGEMENT FAILED", {
            description: describeChainError(caught),
          });
        }
      }
      setState(next);
      await utils.anomalies.list.invalidate();
      if (next === "dismissed") {
        onNotice(`${item.agentName.toUpperCase()} REMOVED FROM ACTIVE REGISTER`);
      }
      toast.success(
        next === "dismissed"
          ? `${item.agentName.toUpperCase()} DISMISSED / anomaly archived`
          : `${item.agentName.toUpperCase()} FROZEN ONCHAIN / acknowledgement requested`,
      );
    } catch (caught) {
      setState("idle");
      toast.error(`${item.agentName.toUpperCase()} ACTION FAILED`, {
        description: describeChainError(caught),
      });
    }
  };

  return {
    acknowledgePending: acknowledge.isPending,
    dismissPending: dismiss.isPending,
    frozen: state === "frozen" || frozenQuery.data === true,
    isConnected,
    isPending: acknowledge.isPending || dismiss.isPending,
    restrainDisabledReason,
    settle,
    state,
  };
}
