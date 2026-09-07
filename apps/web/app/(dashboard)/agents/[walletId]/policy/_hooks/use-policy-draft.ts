"use client";

import { useMemo, useState } from "react";

import {
  type DoctrineCategoryValue,
  type PolicyDraftState,
  initialPolicyDraft,
} from "@/lib/contracts";

import { policyDiffRows } from "../_lib/policy-helpers";

export function usePolicyDraft(stopPendingIndexer: () => void) {
  const [policyDraft, setPolicyDraft] = useState<PolicyDraftState>(initialPolicyDraft);
  const [activePolicyDraft, setActivePolicyDraft] = useState<PolicyDraftState>(initialPolicyDraft);
  const [selectedPolicyWalletAddress, setSelectedPolicyWalletAddress] = useState("");
  const [policyError, setPolicyError] = useState<string | null>(null);
  const policyDiffs = useMemo(
    () => policyDiffRows(activePolicyDraft, policyDraft),
    [activePolicyDraft, policyDraft],
  );

  const toggleCategory = (category: DoctrineCategoryValue) => {
    setPolicyDraft((current) => {
      const next = new Set(current.enabledCategories);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return { ...current, enabledCategories: next };
    });
    setPolicyError(null);
    stopPendingIndexer();
  };
  const updatePolicyDraft = (patch: Partial<PolicyDraftState>) => {
    setPolicyDraft((current) => ({ ...current, ...patch }));
    setPolicyError(null);
    stopPendingIndexer();
  };
  const resetDraft = () => {
    setPolicyDraft(activePolicyDraft);
    setPolicyError(null);
    stopPendingIndexer();
  };

  return {
    activePolicyDraft,
    policyDiffs,
    policyDraft,
    policyError,
    resetDraft,
    selectedPolicyWalletAddress,
    setActivePolicyDraft,
    setPolicyDraft,
    setPolicyError,
    setSelectedPolicyWalletAddress,
    toggleCategory,
    unsavedCount: policyDiffs.length,
    updatePolicyDraft,
  };
}
