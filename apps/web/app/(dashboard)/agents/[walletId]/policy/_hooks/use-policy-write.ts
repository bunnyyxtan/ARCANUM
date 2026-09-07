"use client";

import { ARC_NETWORK_NAME, arcChain } from "@arcanum/shared";
import {
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type { Address, Hash } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";

import { describeChainError, errorText } from "@/lib/chain-errors";
import { guardedWalletControlAbi } from "@/lib/contracts";
import { isSameAddress } from "@/lib/format/address";
import { trpc } from "@/lib/trpc";

import {
  allowTrustedMutation,
  buildPolicyEnvelope,
  draftCategoryNames,
} from "../_lib/policy-helpers";
import type { usePolicyDeployment } from "./use-policy-deployment";
import type { usePolicyDraft } from "./use-policy-draft";

type Deployment = ReturnType<typeof usePolicyDeployment>;
type Draft = ReturnType<typeof usePolicyDraft>;

export function usePolicyWriteState() {
  const [policySaving, setPolicySaving] = useState(false);
  const [policyTxHash, setPolicyTxHash] = useState<Hash | null>(null);
  const [policyPendingIndexer, setPolicyPendingIndexer] = useState(false);
  const stopPendingIndexer = useCallback(() => setPolicyPendingIndexer(false), []);
  return {
    policyPendingIndexer,
    policySaving,
    policyTxHash,
    setPolicyPendingIndexer,
    setPolicySaving,
    setPolicyTxHash,
    stopPendingIndexer,
  };
}

export function usePolicyWrite(
  isAuthenticated: boolean,
  walletsLoading: boolean,
  selectedGovernedWalletAddress: Address | null,
  draft: Draft,
  deployment: Deployment,
  state: ReturnType<typeof usePolicyWriteState>,
  refreshPolicyQueries: () => Promise<unknown>,
) {
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcChain.id });
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();
  const { writeContractAsync, isPending: writePending } = useWriteContract();
  const recordDeployedPolicy = trpc.policies.recordDeployed.useMutation();
  const policySubmittingRef = useRef(false);
  const ownerMatchesConnectedWallet = Boolean(
    deployment.policyWalletOwner && address && isSameAddress(deployment.policyWalletOwner, address),
  );
  const policyWriteDisabledReason = !selectedGovernedWalletAddress
    ? walletsLoading
      ? "Loading governed wallets."
      : "Create or select a governed wallet first."
    : !isConnected
      ? "Connect wallet first."
      : !isAuthenticated
        ? "Sign in to manage policy."
        : deployment.policyReadStatus === "checking"
          ? `Reading active policy from ${ARC_NETWORK_NAME}.`
          : deployment.policyReadStatus === "error"
            ? `Unable to read governed wallet policy on ${ARC_NETWORK_NAME}.`
            : !ownerMatchesConnectedWallet
              ? "Only the governed wallet owner can update policy."
              : draft.unsavedCount === 0
                ? "No policy changes to submit."
                : null;

  useEffect(() => {
    if (!state.policyPendingIndexer) return;
    const timer = setTimeout(state.stopPendingIndexer, 90_000);
    return () => clearTimeout(timer);
  }, [state.policyPendingIndexer, state.stopPendingIndexer]);

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
    state.setPolicySaving(true);
    draft.setPolicyError(null);
    state.setPolicyTxHash(null);
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
      state.setPolicyTxHash(hash);
      const receipt = await publicClient
        ?.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 120_000 })
        .catch(() => {
          throw new Error(
            "The policy transaction was sent but its confirmation did not arrive within 2 minutes. It may still confirm. Check the wallet's activity before retrying.",
          );
        });
      if (receipt?.status !== "success") throw new Error("Policy transaction reverted.");
      draft.setActivePolicyDraft(draft.policyDraft);
      state.setPolicyPendingIndexer(true);
      let syncFailed: string | null = null;
      let syncTimer: ReturnType<typeof setTimeout> | undefined;
      let syncTimedOut = false;
      try {
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
        syncPromise
          .then(() => {
            if (!syncTimedOut) return;
            void refreshPolicyQueries();
            toast.success("DASHBOARD SYNC CAUGHT UP", {
              description: "The delayed dashboard update completed after all.",
            });
          })
          .catch((caught) => {
            const message = errorText(caught);
            draft.setPolicyError(message);
            toast.error("POLICY UPDATE FAILED", { description: message });
          });
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
      state.setPolicySaving(false);
      policySubmittingRef.current = false;
    }
  };

  return {
    address,
    policyBusy: state.policySaving || switchPending || writePending,
    policyNetworkNotice:
      isConnected && chainId !== arcChain.id
        ? `Wallet will be asked to switch to ${ARC_NETWORK_NAME}.`
        : null,
    policyWriteDisabledReason,
    savePolicyOnChain,
  };
}
