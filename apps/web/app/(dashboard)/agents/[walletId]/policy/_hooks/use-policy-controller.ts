"use client";

import { useMemo } from "react";
import type { Address } from "viem";

import { useWorkspaceMode } from "@/lib/auth-session";
import { isEvmAddress, isSameAddress } from "@/lib/format/address";
import { trpc } from "@/lib/trpc";

import { usePolicyDeployment } from "./use-policy-deployment";
import { usePolicyDraft } from "./use-policy-draft";
import { usePolicySync } from "./use-policy-sync";
import { usePolicyWrite, usePolicyWriteState } from "./use-policy-write";

function usePolicyControllerInternal(routeWalletId: string) {
  const workspace = useWorkspaceMode();
  const writeState = usePolicyWriteState();
  const draft = usePolicyDraft(writeState.stopPendingIndexer);
  const deployment = usePolicyDeployment();
  const walletsQuery = trpc.wallets.list.useQuery(undefined, {
    enabled: workspace.isAuthenticated,
    retry: false,
    staleTime: 30_000,
  });
  const policyWalletOptions = useMemo(
    () =>
      (walletsQuery.data ?? []).map((wallet) => ({
        address: wallet.address,
        id: wallet.id,
        label: wallet.label,
      })),
    [walletsQuery.data],
  );
  const selectedGovernedWalletAddress = isEvmAddress(draft.selectedPolicyWalletAddress)
    ? (draft.selectedPolicyWalletAddress as Address)
    : null;
  const selectedPolicyWalletLabel =
    policyWalletOptions.find((wallet) =>
      isSameAddress(wallet.address, draft.selectedPolicyWalletAddress),
    )?.label ?? "Governed wallet";

  const refreshPolicyQueries = usePolicySync(
    routeWalletId,
    policyWalletOptions,
    selectedGovernedWalletAddress,
    draft,
    deployment,
    writeState.stopPendingIndexer,
  );
  const write = usePolicyWrite(
    workspace.isAuthenticated,
    walletsQuery.isLoading,
    selectedGovernedWalletAddress,
    draft,
    deployment,
    writeState,
    refreshPolicyQueries,
    routeWalletId,
    policyWalletOptions,
  );
  const deployStatusLabel = writeState.policyPendingIndexer
    ? "DEPLOYED"
    : draft.unsavedCount > 0
      ? "PENDING"
      : "ACTIVE";

  return {
    address: write.address,
    deployStatusLabel,
    policyBusy: write.policyBusy,
    policyDiffs: draft.policyDiffs,
    policyDraft: draft.policyDraft,
    policyError: draft.policyError,
    policyNetworkNotice: write.policyNetworkNotice,
    onChainPolicyChanged: draft.onChainPolicyChanged,
    policyPendingIndexer: writeState.policyPendingIndexer,
    policyReadStatus: deployment.policyReadStatus,
    policyTxHash: writeState.policyTxHash,
    policyWalletOptions,
    policyWalletOwner: deployment.policyWalletOwner,
    policyWriteDisabledReason: write.policyWriteDisabledReason,
    resetDraft: draft.resetDraft,
    reloadOnChainPolicy: draft.reloadOnChainPolicy,
    savePolicyOnChain: write.savePolicyOnChain,
    selectedGovernedWalletAddress,
    selectedPolicyWalletAddress: draft.selectedPolicyWalletAddress,
    selectedPolicyWalletLabel,
    setSelectedPolicyWalletAddress: draft.setSelectedPolicyWalletAddress,
    toggleCategory: draft.toggleCategory,
    unsavedCount: draft.unsavedCount,
    validationError: draft.validationError,
    updatePolicyDraft: draft.updatePolicyDraft,
    walletsLoading: walletsQuery.isLoading,
  };
}

export type PolicyController = ReturnType<typeof usePolicyControllerInternal>;

export function usePolicyController(routeWalletId: string): PolicyController {
  return usePolicyControllerInternal(routeWalletId);
}
