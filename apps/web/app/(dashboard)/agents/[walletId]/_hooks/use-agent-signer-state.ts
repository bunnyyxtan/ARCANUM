"use client";

import { ARC_NETWORK_NAME, arcChain } from "@arcanum/shared";
import { useCallback, useEffect, useState } from "react";
import type { Address, Hash } from "viem";
import { useAccount, usePublicClient } from "wagmi";

import { describeChainError } from "@/lib/chain-errors";
import { guardedWalletControlAbi } from "@/lib/contracts";
import { isEvmAddress, isSameAddress, isZeroAddress } from "@/lib/format/address";

export type SignerTxStatus =
  | "idle"
  | "wallet"
  | "confirming"
  | "syncing"
  | "synced"
  | "sync_failed"
  | "error";

export function useAgentSignerState(governedWalletAddress: Address | null) {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcChain.id });
  const [signerInput, setSignerInput] = useState("");
  const [walletOwner, setWalletOwner] = useState<Address | null>(null);
  const [signerAuthorized, setSignerAuthorized] = useState<boolean | null>(null);
  const [readStatus, setReadStatus] = useState<"idle" | "loading" | "verified" | "error">("idle");
  const [readError, setReadError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<SignerTxStatus>("idle");
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
  const readOwner = useCallback(async () => {
    if (!publicClient || !governedWalletAddress) return;
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
  return {
    address,
    isConnected,
    ownerMatchesConnectedWallet,
    publicClient,
    readError,
    readStatus,
    setSignerAuthorized,
    setSignerInput,
    setTxError,
    setTxHash,
    setTxStatus,
    signerAuthorized,
    signerInput,
    signerValidation,
    txError,
    txHash,
    txStatus,
    usableSignerAddress,
  };
}
