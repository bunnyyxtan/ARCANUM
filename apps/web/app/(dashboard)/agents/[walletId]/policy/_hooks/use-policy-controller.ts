"use client";

import { ARC_NETWORK_NAME, arcChain } from "@arcanum/shared";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { toast } from "sonner";
import type { Address, Hash } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";

import { useWorkspaceMode } from "@/lib/auth-session";
import { describeChainError, errorText } from "@/lib/chain-errors";
import {
  type DoctrineCategoryValue,
  type PolicyDraftState,
  guardedWalletControlAbi,
  initialPolicyDraft,
} from "@/lib/contracts";
import { isEvmAddress, isSameAddress } from "@/lib/format/address";
import { trpc } from "@/lib/trpc";

import {
  allowTrustedMutation,
  buildPolicyEnvelope,
  draftCategoryNames,
  policyDiffRows,
  policyDraftFromServerRead,
} from "../_lib/policy-helpers";

function usePolicyDraftStateInternal() {
  const [policyDraft, setPolicyDraft] = useState<PolicyDraftState>(initialPolicyDraft);
  const [activePolicyDraft, setActivePolicyDraft] = useState<PolicyDraftState>(initialPolicyDraft);
  const [selectedPolicyWalletAddress, setSelectedPolicyWalletAddress] = useState("");
  const [policyError, setPolicyError] = useState<string | null>(null);
  return {
    activePolicyDraft,
    policyDraft,
    policyError,
    selectedPolicyWalletAddress,
    setActivePolicyDraft,
    setPolicyDraft,
    setPolicyError,
    setSelectedPolicyWalletAddress,
  };
}

type PolicyDraftController = ReturnType<typeof usePolicyDraftStateInternal>;

function usePolicyDraftState(): PolicyDraftController {
  return usePolicyDraftStateInternal();
}

function usePolicyDeploymentStateInternal() {
  const [policyWalletOwner, setPolicyWalletOwner] = useState<Address | null>(null);
  const [policyReadStatus, setPolicyReadStatus] = useState<"idle" | "checking" | "ready" | "error">(
    "idle",
  );
  const [policySaving, setPolicySaving] = useState(false);
  const [policyTxHash, setPolicyTxHash] = useState<Hash | null>(null);
  const [policyPendingIndexer, setPolicyPendingIndexer] = useState(false);
  return {
    policyPendingIndexer,
    policyReadStatus,
    policySaving,
    policyTxHash,
    policyWalletOwner,
    setPolicyPendingIndexer,
    setPolicyReadStatus,
    setPolicySaving,
    setPolicyTxHash,
    setPolicyWalletOwner,
  };
}

type PolicyDeploymentController = ReturnType<typeof usePolicyDeploymentStateInternal>;

function usePolicyDeploymentState(): PolicyDeploymentController {
  return usePolicyDeploymentStateInternal();
}

function usePolicyControllerInternal(routeWalletId: string) {
  const workspace = useWorkspaceMode();
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcChain.id });
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();
  const { writeContractAsync, isPending: writePending } = useWriteContract();
  const utils = trpc.useUtils();
  const recordDeployedPolicy = trpc.policies.recordDeployed.useMutation();
  const draft = usePolicyDraftState();
  const deployment = usePolicyDeploymentState();
  const policySubmittingRef = useRef(false);

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
  const ownerMatchesConnectedWallet = Boolean(
    deployment.policyWalletOwner && address && isSameAddress(deployment.policyWalletOwner, address),
  );
  const policyDiffs = useMemo(
    () => policyDiffRows(draft.activePolicyDraft, draft.policyDraft),
    [draft.activePolicyDraft, draft.policyDraft],
  );
  const unsavedCount = policyDiffs.length;
  const selectedPolicyWalletLabel =
    policyWalletOptions.find((wallet) =>
      isSameAddress(wallet.address, draft.selectedPolicyWalletAddress),
    )?.label ?? "Governed wallet";

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
    // Fall back to the raw route wallet id if it is a valid address (fresh deploy not yet indexed).
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

  // Policy state is read server-side (Next.js backend calls the Arc Testnet RPC)
  // to avoid browser CORS failures against the public RPC endpoint.
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
      // The re-read failed, so stop claiming a sync is in flight.
      deployment.setPolicyPendingIndexer(false);
      return;
    }
    if (onChainPolicyQuery.data) {
      const nextDraft = policyDraftFromServerRead(onChainPolicyQuery.data.policy);
      deployment.setPolicyWalletOwner(onChainPolicyQuery.data.owner as Address);
      draft.setActivePolicyDraft(nextDraft);
      draft.setPolicyDraft(nextDraft);
      deployment.setPolicyPendingIndexer(false);
      deployment.setPolicyReadStatus("ready");
    }
  }, [
    selectedGovernedWalletAddress,
    onChainPolicyQuery.data,
    onChainPolicyQuery.isLoading,
    onChainPolicyQuery.isFetching,
    onChainPolicyQuery.isError,
    onChainPolicyQuery.error,
    deployment.setPolicyPendingIndexer,
    deployment.setPolicyReadStatus,
    deployment.setPolicyWalletOwner,
    draft.setActivePolicyDraft,
    draft.setPolicyDraft,
    draft.setPolicyError,
  ]);

  // Safety net: "PENDING INDEXER SYNC" must never become a permanent state.
  // If no onchain re-read confirms the update within 90s, stop waiting.
  useEffect(() => {
    if (!deployment.policyPendingIndexer) return;
    const timer = setTimeout(() => deployment.setPolicyPendingIndexer(false), 90_000);
    return () => clearTimeout(timer);
  }, [deployment.policyPendingIndexer, deployment.setPolicyPendingIndexer]);

  const policyWriteDisabledReason = !selectedGovernedWalletAddress
    ? walletsQuery.isLoading
      ? "Loading governed wallets."
      : "Create or select a governed wallet first."
    : !isConnected
      ? "Connect wallet first."
      : !workspace.isAuthenticated
        ? "Sign in to manage policy."
        : deployment.policyReadStatus === "checking"
          ? `Reading active policy from ${ARC_NETWORK_NAME}.`
          : deployment.policyReadStatus === "error"
            ? `Unable to read governed wallet policy on ${ARC_NETWORK_NAME}.`
            : !ownerMatchesConnectedWallet
              ? "Only the governed wallet owner can update policy."
              : unsavedCount === 0
                ? "No policy changes to submit."
                : null;
  const policyNetworkNotice =
    isConnected && chainId !== arcChain.id
      ? `Wallet will be asked to switch to ${ARC_NETWORK_NAME}.`
      : null;

  const toggleCategory = (category: DoctrineCategoryValue) => {
    draft.setPolicyDraft((current) => {
      const next = new Set(current.enabledCategories);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return { ...current, enabledCategories: next };
    });
    draft.setPolicyError(null);
    deployment.setPolicyPendingIndexer(false);
  };

  const updatePolicyDraft = (patch: Partial<PolicyDraftState>) => {
    draft.setPolicyDraft((current) => ({ ...current, ...patch }));
    draft.setPolicyError(null);
    deployment.setPolicyPendingIndexer(false);
  };

  const ensurePolicyWriteReady = async () => {
    if (policyWriteDisabledReason) throw new Error(policyWriteDisabledReason);
    if (!selectedGovernedWalletAddress || !publicClient) {
      throw new Error(`${ARC_NETWORK_NAME} RPC is unavailable.`);
    }
    if (chainId !== arcChain.id) await switchChainAsync({ chainId: arcChain.id });
    return selectedGovernedWalletAddress;
  };

  const savePolicyOnChain = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!allowTrustedMutation("policies.update", event) || policySubmittingRef.current) return;
    policySubmittingRef.current = true;
    deployment.setPolicySaving(true);
    draft.setPolicyError(null);
    deployment.setPolicyTxHash(null);
    try {
      const nextPolicy = buildPolicyEnvelope(draft.policyDraft);
      const governedWallet = await ensurePolicyWriteReady();
      const hash = await writeContractAsync({
        address: governedWallet,
        abi: guardedWalletControlAbi,
        functionName: "setPolicy",
        args: [nextPolicy],
        chainId: arcChain.id,
      });
      deployment.setPolicyTxHash(hash);
      // A missing receipt must never strand the button on "Waiting for
      // receipt": bound the wait and tell the owner where the tx stands.
      const receipt = await publicClient
        ?.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 120_000 })
        .catch(() => {
          throw new Error(
            "The policy transaction was sent but its confirmation did not arrive within 2 minutes. It may still confirm. Check the wallet's activity before retrying.",
          );
        });
      if (receipt?.status !== "success") throw new Error("Policy transaction reverted.");

      draft.setActivePolicyDraft(draft.policyDraft);
      deployment.setPolicyPendingIndexer(true);
      // Mirror the confirmed revision into the read model, otherwise the
      // dossier keeps advertising the caps the wallet no longer enforces.
      let syncFailed: string | null = null;
      let syncTimer: ReturnType<typeof setTimeout> | undefined;
      let syncTimedOut = false;
      const refreshPolicyQueries = () =>
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
      try {
        // The mirror write must not be able to hang the button either: the
        // policy is already live onchain, so cap the dashboard sync wait.
        const syncPromise = recordDeployedPolicy.mutateAsync({
          walletAddress: governedWallet,
          txHash: hash,
          perTxCap: Number(nextPolicy.perTxCap) / 1e6,
          dailyCap: Number(nextPolicy.daily24hCap) / 1e6,
          monthlyCap: Number(nextPolicy.monthlyRollingCap) / 1e6,
          escalationThreshold: Number(nextPolicy.escalationThreshold) / 1e6,
          allowedCategories: draftCategoryNames(draft.policyDraft),
          requireAllowlist: nextPolicy.requireAllowlist,
        });
        // If the mutation outlives the 20s wait but then succeeds, reconcile
        // the UI instead of leaving the earlier "not synced" warning standing.
        // A late failure must not surface as an unhandled rejection either.
        syncPromise
          .then(() => {
            if (!syncTimedOut) return;
            void refreshPolicyQueries();
            toast.success("DASHBOARD SYNC CAUGHT UP", {
              description: "The delayed dashboard update completed after all.",
            });
          })
          .catch(() => undefined);
        await Promise.race([
          syncPromise,
          new Promise<never>((_, reject) => {
            syncTimer = setTimeout(() => {
              syncTimedOut = true;
              reject(
                new Error(
                  "The dashboard sync timed out. The ledger catches up from the chain on its own.",
                ),
              );
            }, 20_000);
          }),
        ]);
      } catch (caught) {
        syncFailed = errorText(caught);
      } finally {
        clearTimeout(syncTimer);
      }
      // Fire-and-forget: a hanging refetch must never keep the button busy.
      void refreshPolicyQueries();
      if (syncFailed) {
        toast.warning("POLICY LIVE ONCHAIN · DASHBOARD NOT SYNCED", {
          description: `The wallet now enforces the new policy, but the dashboard could not be updated: ${syncFailed}`,
        });
      } else {
        toast.success("POLICY TX CONFIRMED", {
          description: "Policy update is confirmed onchain and reflected across the dashboard.",
        });
      }
    } catch (caught) {
      const message = describeChainError(caught);
      draft.setPolicyError(message);
      toast.error("POLICY UPDATE FAILED", { description: message });
    } finally {
      deployment.setPolicySaving(false);
      policySubmittingRef.current = false;
    }
  };

  const resetDraft = () => {
    draft.setPolicyDraft(draft.activePolicyDraft);
    draft.setPolicyError(null);
    deployment.setPolicyPendingIndexer(false);
  };
  const policyBusy = deployment.policySaving || switchPending || writePending;
  const deployStatusLabel = deployment.policyPendingIndexer
    ? "DEPLOYED"
    : unsavedCount > 0
      ? "PENDING"
      : "ACTIVE";

  return {
    address,
    deployStatusLabel,
    policyBusy,
    policyDiffs,
    policyDraft: draft.policyDraft,
    policyError: draft.policyError,
    policyNetworkNotice,
    policyPendingIndexer: deployment.policyPendingIndexer,
    policyReadStatus: deployment.policyReadStatus,
    policyTxHash: deployment.policyTxHash,
    policyWalletOptions,
    policyWalletOwner: deployment.policyWalletOwner,
    policyWriteDisabledReason,
    resetDraft,
    savePolicyOnChain,
    selectedGovernedWalletAddress,
    selectedPolicyWalletAddress: draft.selectedPolicyWalletAddress,
    selectedPolicyWalletLabel,
    setSelectedPolicyWalletAddress: draft.setSelectedPolicyWalletAddress,
    toggleCategory,
    unsavedCount,
    updatePolicyDraft,
    walletsLoading: walletsQuery.isLoading,
  };
}

export type PolicyController = ReturnType<typeof usePolicyControllerInternal>;

export function usePolicyController(routeWalletId: string): PolicyController {
  return usePolicyControllerInternal(routeWalletId);
}
