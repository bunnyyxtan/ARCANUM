"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Address } from "viem";

import { errorText } from "@/lib/chain-errors";
import { isSameAddress } from "@/lib/format/address";
import { trpc } from "@/lib/trpc";

import {
  type PolicyWalletRouteOption,
  policyDraftFromServerRead,
  policyWalletAddressForRoute,
  reconcilePolicyDraft,
} from "../_lib/policy-helpers";
import type { usePolicyDeployment } from "./use-policy-deployment";
import type { usePolicyDraft } from "./use-policy-draft";

type Deployment = ReturnType<typeof usePolicyDeployment>;
type Draft = ReturnType<typeof usePolicyDraft>;

export function usePolicySync(
  routeWalletId: string,
  policyWalletOptions: readonly PolicyWalletRouteOption[],
  selectedGovernedWalletAddress: Address | null,
  draft: Draft,
  deployment: Deployment,
  stopPendingIndexer: () => void,
) {
  const utils = trpc.useUtils();
  const hydratedWallet = useRef<string | null>(null);
  const hydratedPolicy = useRef<string | null>(null);
  useEffect(() => {
    const routeAddress = policyWalletAddressForRoute(routeWalletId, policyWalletOptions);
    if (!routeAddress) {
      if (draft.selectedPolicyWalletAddress) {
        draft.setSelectedPolicyWalletAddress("");
      }
      return;
    }
    if (isSameAddress(routeAddress, draft.selectedPolicyWalletAddress)) return;
    draft.setSelectedPolicyWalletAddress(routeAddress ?? "");
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
      const policyFingerprint = JSON.stringify(onChainPolicyQuery.data.policy);
      const walletChanged =
        hydratedWallet.current?.toLowerCase() !== selectedGovernedWalletAddress.toLowerCase();
      const chainPolicyChanged =
        hydratedPolicy.current !== null && hydratedPolicy.current !== policyFingerprint;
      deployment.setPolicyWalletOwner(onChainPolicyQuery.data.owner as Address);
      draft.setActivePolicyDraft(nextDraft);
      const reconciled = reconcilePolicyDraft(draft.policyDraft, nextDraft, walletChanged);
      if (walletChanged) {
        draft.setPolicyDraft(reconciled.draft);
        draft.setOnChainPolicyChanged(false);
      } else if (chainPolicyChanged && reconciled.onChainChanged) {
        draft.setOnChainPolicyChanged(true);
      }
      hydratedWallet.current = selectedGovernedWalletAddress;
      hydratedPolicy.current = policyFingerprint;
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
    draft.setOnChainPolicyChanged,
    draft.policyDraft,
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
