"use client";

import { ARC_NETWORK_NAME, arcChain } from "@arcanum/shared";
import { type MouseEvent as ReactMouseEvent, useRef } from "react";
import { toast } from "sonner";
import type { Address } from "viem";
import { useAccount, useSwitchChain, useWriteContract } from "wagmi";

import { getArcscanTxUrl } from "@/lib/arcscan";
import { describeChainError } from "@/lib/chain-errors";
import { guardedWalletControlAbi } from "@/lib/contracts";
import { trpc } from "@/lib/trpc";

import type { useAgentSignerState } from "./use-agent-signer-state";

type SignerState = ReturnType<typeof useAgentSignerState>;

function allowTrustedMutation(action: string, event: ReactMouseEvent<HTMLElement>) {
  if (event.nativeEvent.isTrusted) return true;
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[Arcanum] Blocked ${action}: mutations require an explicit trusted click.`);
  }
  return false;
}

export function useAgentSignerWrite(governedWalletAddress: Address | null, state: SignerState) {
  const { chainId } = useAccount();
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();
  const { writeContractAsync, isPending: writePending } = useWriteContract();
  const utils = trpc.useUtils();
  const syncSignerState = trpc.agents.syncSignerState.useMutation();
  const submittingRef = useRef(false);
  const isBusy =
    submittingRef.current ||
    switchPending ||
    writePending ||
    syncSignerState.isPending ||
    state.txStatus === "wallet" ||
    state.txStatus === "confirming" ||
    state.txStatus === "syncing";
  const managementDisabledReason = !governedWalletAddress
    ? "Open a valid governed wallet route."
    : !state.isConnected
      ? "Connect wallet first."
      : state.readStatus === "loading"
        ? "Checking governed wallet owner."
        : state.readStatus === "error"
          ? (state.readError ?? `Unable to read governed wallet on ${ARC_NETWORK_NAME}.`)
          : !state.ownerMatchesConnectedWallet
            ? "Only the governed wallet owner can manage the agent signer."
            : chainId !== arcChain.id
              ? `Switch to ${ARC_NETWORK_NAME}.`
              : null;
  const signerWriteDisabledReason = managementDisabledReason ?? state.signerValidation;
  const submitSignerWrite = async (
    action: "authorize" | "revoke",
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => {
    if (!allowTrustedMutation(`agentSigner.${action}`, event)) return;
    const targetSigner = state.usableSignerAddress;
    if (
      submittingRef.current ||
      !governedWalletAddress ||
      !targetSigner ||
      !state.publicClient ||
      !state.ownerMatchesConnectedWallet
    ) {
      return;
    }
    submittingRef.current = true;
    state.setTxError(null);
    state.setTxHash(null);
    state.setTxStatus("wallet");
    let contractConfirmed = false;
    try {
      if (chainId !== arcChain.id) await switchChainAsync({ chainId: arcChain.id });
      const hash = await writeContractAsync({
        address: governedWalletAddress,
        abi: guardedWalletControlAbi,
        functionName: action === "authorize" ? "addSigner" : "removeSigner",
        args: [targetSigner],
        chainId: arcChain.id,
      });
      state.setTxHash(hash);
      state.setTxStatus("confirming");
      const receipt = await state.publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
      });
      if (receipt.status !== "success") throw new Error("Signer transaction reverted.");
      contractConfirmed = true;
      const nextState = action === "authorize";
      const refreshed = (await state.publicClient.readContract({
        address: governedWalletAddress,
        abi: guardedWalletControlAbi,
        functionName: "agentSigners",
        args: [targetSigner],
      })) as boolean;
      if (refreshed !== nextState) {
        throw new Error("Contract readback did not confirm the signer state.");
      }
      state.setSignerAuthorized(nextState);
      state.setTxStatus("syncing");
      await syncSignerState.mutateAsync({
        action,
        signerAddress: targetSigner,
        walletAddress: governedWalletAddress,
      });
      await utils.agents.list.invalidate();
      if (action === "revoke") state.setSignerInput("");
      state.setTxStatus("synced");
      toast.success(action === "authorize" ? "AGENT SIGNER AUTHORIZED" : "AGENT SIGNER REVOKED", {
        description: "Contract confirmed and signer record synced.",
      });
    } catch (caught) {
      state.setTxStatus(contractConfirmed ? "sync_failed" : "error");
      state.setTxError(describeChainError(caught));
    } finally {
      submittingRef.current = false;
    }
  };
  const switchToArcTestnet = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!allowTrustedMutation("agentSigner.switchChain", event)) return;
    try {
      state.setTxError(null);
      await switchChainAsync({ chainId: arcChain.id });
    } catch (caught) {
      state.setTxError(describeChainError(caught));
    }
  };
  return {
    canAuthorize: !signerWriteDisabledReason && state.signerAuthorized === false && !isBusy,
    canRevoke: !signerWriteDisabledReason && state.signerAuthorized === true && !isBusy,
    chainId,
    managementDisabledReason,
    submitSignerWrite,
    switchToArcTestnet,
    txArcscanUrl: getArcscanTxUrl(state.txHash),
  };
}
