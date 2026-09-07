"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import type { Address } from "viem";

import { errorText } from "@/lib/chain-errors";
import { isEvmAddress, isSameAddress } from "@/lib/format/address";
import { trpc } from "@/lib/trpc";

import { policyDraftFromServerRead } from "../_lib/policy-helpers";
import type { usePolicyDeployment } from "./use-policy-deployment";
import type { usePolicyDraft } from "./use-policy-draft";

type Deployment = ReturnType<typeof usePolicyDeployment>;
type Draft = ReturnType<typeof usePolicyDraft>;
type WalletOption = { address: string; id: string; label: string };

export function usePolicySync(
  routeWalletId: string,
  policyWalletOptions: readonly WalletOption[],
  selectedGovernedWalletAddress: Address | null,
  draft: Draft,
  deployment: Deployment,
  stopPendingIndexer: () => void,
) {
  const utils = trpc.useUtils();
  useEffect(() => {
    if (
      draft.selectedPolicyWalletAddress &&
      policyWalletOptions.some((wallet) =>
        isSameAddress(wallet.address, draft.selectedPolicyWalletAddress),
      )
    ) {
      return;
    }
    const normalizedRouteWalletId = routeWalletId.toLowerCase();
    const routeMatch = policyWalletOptions.find(
      (wallet) =>
        wallet.id.toLowerCase() === normalizedRouteWalletId ||
        isSameAddress(wallet.address, routeWalletId) ||
        wallet.label.toLowerCase() === normalizedRouteWalletId,
    );
    const routeAddress = isEvmAddress(routeWalletId) ? routeWalletId : "";
    draft.setSelectedPolicyWalletAddress(
      routeMatch?.address ?? policyWalletOptions[0]?.address ?? routeAddress,
    );
  }, [
    draft.selectedPolicyWalletAddress,
    draft.setSelectedPolicyWalletAddress,
    policyWalletOptions,
    routeWalletId,
  ]);

  const onChainPolicyQuery = trpc.policies.readOnChain.useQuery(
    { walletAddress: selectedGovernedWalletAddress ?? "" },
    {
      enabled: Boolean(selectedGovernedWalletAddress),
      retry: 1,
      staleTime: 15_000,
    },
  );

  useEffect(() => {
    if (!selectedGovernedWalletAddress) {
      deployment.setPolicyWalletOwner(null);
      deployment.setPolicyReadStatus("idle");
      return;
    }
    if (onChainPolicyQuery.isLoading || onChainPolicyQuery.isFetching) {
      deployment.setPolicyReadStatus("checking");
      draft.setPolicyError(null);
      return;
    }
    if (onChainPolicyQuery.isError) {
      deployment.setPolicyWalletOwner(null);
      deployment.setPolicyReadStatus("error");
      draft.setPolicyError(onChainPolicyQuery.error.message);
      stopPendingIndexer();
      return;
    }
    if (onChainPolicyQuery.data) {
      const nextDraft = policyDraftFromServerRead(onChainPolicyQuery.data.policy);
      deployment.setPolicyWalletOwner(onChainPolicyQuery.data.owner as Address);
      draft.setActivePolicyDraft(nextDraft);
      draft.setPolicyDraft(nextDraft);
      stopPendingIndexer();
      deployment.setPolicyReadStatus("ready");
    }
  }, [
    selectedGovernedWalletAddress,
    onChainPolicyQuery.data,
    onChainPolicyQuery.isLoading,
    onChainPolicyQuery.isFetching,
    onChainPolicyQuery.isError,
    onChainPolicyQuery.error,
    deployment.setPolicyReadStatus,
    deployment.setPolicyWalletOwner,
    draft.setActivePolicyDraft,
    draft.setPolicyDraft,
    draft.setPolicyError,
    stopPendingIndexer,
  ]);

  return () =>
    Promise.all([
      utils.policies.get.invalidate(),
      utils.policies.readOnChain.invalidate(),
      utils.wallets.listPolicies.invalidate(),
      utils.agents.list.invalidate(),
    ]).catch((caught) => {
      toast.warning("POLICY LIVE ONCHAIN · DASHBOARD REFRESH FAILED", {
        description: errorText(caught),
      });
    });
}
