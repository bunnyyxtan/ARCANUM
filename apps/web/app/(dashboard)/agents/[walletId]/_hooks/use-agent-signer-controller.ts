"use client";

import { ARC_NETWORK_NAME, arcChain } from "@arcanum/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { toast } from "sonner";
import type { Address, Hash } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";

import { getArcscanTxUrl } from "@/lib/arcscan";
import { describeChainError } from "@/lib/chain-errors";
import { guardedWalletControlAbi } from "@/lib/contracts";
import { isEvmAddress, isSameAddress, isZeroAddress } from "@/lib/format/address";
import { trpc } from "@/lib/trpc";

function allowTrustedMutation(action: string, event: ReactMouseEvent<HTMLElement>) {
  if (event.nativeEvent.isTrusted) {
    return true;
  }
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[Arcanum] Blocked ${action}: mutations require an explicit trusted click.`);
  }
  return false;
}

function useAgentSignerControllerInternal(governedWalletAddress: Address | null) {
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
      setReadError(describeChainError(caught));
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
    } catch (caught) {
      setSignerAuthorized(null);
      setTxError(describeChainError(caught));
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
      setTxError(describeChainError(caught));
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
      setTxError(describeChainError(caught));
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

  return {
    address,
    chainId,
    isConnected,
    signerInput,
    setSignerInput,
    usableSignerAddress,
    signerAuthorized,
    managementDisabledReason,
    txStatusLabel,
    txArcscanUrl,
    txError,
    canAuthorize,
    canRevoke,
    switchToArcTestnet,
    submitSignerWrite,
  };
}

export type AgentSignerController = ReturnType<typeof useAgentSignerControllerInternal>;

export function useAgentSignerController(
  governedWalletAddress: Address | null,
): AgentSignerController {
  return useAgentSignerControllerInternal(governedWalletAddress);
}
