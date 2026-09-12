"use client";

import { useWorkspaceMode } from "@/lib/auth-session";
import { errorText } from "@/lib/chain-errors";
import { guardedWalletControlAbi } from "@/lib/contracts";
import { isEvmAddress, isSameAddress, shortAddress } from "@/lib/format/address";
import type { useLiveVendors } from "@/lib/live-data";
import { trpc } from "@/lib/trpc";
import { ARC_NETWORK_NAME, arcChain } from "@arcanum/shared";
import { useRef } from "react";
import { toast } from "sonner";
import type { Address } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";

type LiveVendors = ReturnType<typeof useLiveVendors>;

export function useVendorWrite(
  selectedWalletAddress: string,
  walletsLoading: boolean,
  liveVendors: LiveVendors,
) {
  const workspace = useWorkspaceMode();
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcChain.id });
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();
  const { writeContractAsync, isPending: writePending } = useWriteContract();
  const utils = trpc.useUtils();
  const recordVendorStateMutation = trpc.vendors.recordOnChainState.useMutation();
  const vendorSubmittingRef = useRef(false);
  const selectedGovernedWalletAddress = isEvmAddress(selectedWalletAddress)
    ? (selectedWalletAddress as Address)
    : null;
  const ownerQuery = useReadContract({
    abi: guardedWalletControlAbi,
    address: selectedGovernedWalletAddress ?? undefined,
    functionName: "owner",
    chainId: arcChain.id,
    query: { enabled: Boolean(selectedGovernedWalletAddress) },
  });
  const owner = typeof ownerQuery.data === "string" ? ownerQuery.data : null;
  const vendorWriteDisabledReason = !selectedGovernedWalletAddress
    ? walletsLoading
      ? "Loading governed wallets."
      : "Create or select a governed wallet first."
    : !isConnected
      ? "Connect wallet first."
      : !workspace.isAuthenticated
        ? "Sign in to manage VendorRegistry."
        : ownerQuery.isLoading
          ? "Verifying governed wallet owner."
          : !owner
            ? `Could not verify governed wallet owner on ${ARC_NETWORK_NAME}.`
            : !address || !isSameAddress(owner, address)
              ? `Only the governed wallet owner (${shortAddress(owner)}) can manage its VendorRegistry.`
              : null;
  const ensureVendorWriteReady = async () => {
    if (vendorWriteDisabledReason) throw new Error(vendorWriteDisabledReason);
    if (!selectedGovernedWalletAddress || !publicClient) {
      throw new Error(`${ARC_NETWORK_NAME} RPC is unavailable.`);
    }
    if (chainId !== arcChain.id) await switchChainAsync({ chainId: arcChain.id });
    return selectedGovernedWalletAddress;
  };
  const refreshVendors = async () => {
    await utils.vendors.list.invalidate();
    await liveVendors.refetch();
  };
  const recordVendorState = async (
    walletAddress: Address,
    vendorAddress: Address,
    details: {
      name: string;
      category: string;
      kycStatus: "public" | "arcanevm";
    },
  ) => {
    try {
      await recordVendorStateMutation.mutateAsync({ walletAddress, vendorAddress, ...details });
      return null;
    } catch (caught) {
      const message = errorText(caught);
      toast.warning("VENDOR WRITE LIVE ONCHAIN · REGISTRY NOT SYNCED", { description: message });
      return message;
    }
  };
  return {
    ensureVendorWriteReady,
    isConnected,
    publicClient,
    recordVendorState,
    refreshVendors,
    switchPending,
    vendorNetworkNotice:
      isConnected && chainId !== arcChain.id
        ? `Wallet will be asked to switch to ${ARC_NETWORK_NAME}.`
        : null,
    vendorSubmittingRef,
    vendorWriteDisabledReason,
    writeContractAsync,
    writePending,
  };
}
