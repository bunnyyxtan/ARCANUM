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
  type PolicyWalletRouteOption,
  allowTrustedMutation,
  buildPolicyEnvelope,
  clonePolicyDraft,
  draftCategoryNames,
  policyRouteWriteError,
  policyWriteIntentMismatch,
  policyWriteIntentSnapshot,
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
  routeWalletId: string,
  policyWalletOptions: readonly PolicyWalletRouteOption[],
) {
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcChain.id });
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();
  const { writeContractAsync, isPending: writePending } = useWriteContract();
  const recordDeployedPolicy = trpc.policies.recordDeployed.useMutation();
  const policySubmittingRef = useRef(false);
  const routeWalletIdRef = useRef(routeWalletId);
  const policyWalletOptionsRef = useRef(policyWalletOptions);
  const selectedPolicyWalletAddressRef = useRef(draft.selectedPolicyWalletAddress);
  const selectedGovernedWalletAddressRef = useRef(selectedGovernedWalletAddress);
  const draftRef = useRef(draft.policyDraft);
  const signerAddressRef = useRef(address ?? null);
  const ownerAddressRef = useRef(deployment.policyWalletOwner ?? null);
  const authenticatedRef = useRef(isAuthenticated);
  const connectedRef = useRef(isConnected);
  const mountedRef = useRef(true);
  routeWalletIdRef.current = routeWalletId;
  policyWalletOptionsRef.current = policyWalletOptions;
  selectedPolicyWalletAddressRef.current = draft.selectedPolicyWalletAddress;
  selectedGovernedWalletAddressRef.current = selectedGovernedWalletAddress;
  draftRef.current = draft.policyDraft;
  signerAddressRef.current = address ?? null;
  ownerAddressRef.current = deployment.policyWalletOwner ?? null;
  authenticatedRef.current = isAuthenticated;
  connectedRef.current = isConnected;
  const ownerMatchesConnectedWallet = Boolean(
    deployment.policyWalletOwner && address && isSameAddress(deployment.policyWalletOwner, address),
  );
  const routeWriteError = policyRouteWriteError(
    routeWalletId,
    policyWalletOptions,
    draft.selectedPolicyWalletAddress,
  );
  const policyWriteDisabledReason = !selectedGovernedWalletAddress
    ? walletsLoading
      ? "Loading governed wallets."
      : "Create or select a governed wallet first."
    : !isConnected
      ? "Connect wallet first."
      : !isAuthenticated
        ? "Sign in to manage policy."
        : walletsLoading
          ? "Loading governed wallets."
          : routeWriteError
            ? routeWriteError
            : deployment.policyReadStatus === "checking"
              ? `Reading active policy from ${ARC_NETWORK_NAME}.`
              : deployment.policyReadStatus === "error"
                ? `Unable to read governed wallet policy on ${ARC_NETWORK_NAME}.`
                : !ownerMatchesConnectedWallet
                  ? "Only the governed wallet owner can update policy."
                  : draft.unsavedCount === 0
                    ? "No policy changes to submit."
                    : draft.validationError
                      ? draft.validationError
                      : null;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!state.policyPendingIndexer) return;
    const timer = setTimeout(state.stopPendingIndexer, 90_000);
    return () => clearTimeout(timer);
  }, [state.policyPendingIndexer, state.stopPendingIndexer]);

  const currentIntentSnapshot = () => {
    let envelope: ReturnType<typeof buildPolicyEnvelope> | null = null;
    try {
      envelope = buildPolicyEnvelope(draftRef.current);
    } catch {
      // The draft fingerprint still records invalid edits for the preflight.
    }
    return policyWriteIntentSnapshot({
      authenticated: authenticatedRef.current,
      connected: connectedRef.current,
      draft: draftRef.current,
      envelope,
      governedWalletAddress: selectedGovernedWalletAddressRef.current,
      options: policyWalletOptionsRef.current,
      ownerAddress: ownerAddressRef.current,
      routeWalletId: routeWalletIdRef.current,
      selectedPolicyWalletAddress: selectedPolicyWalletAddressRef.current,
      signerAddress: signerAddressRef.current,
    });
  };

  const ensurePolicyWriteReady = async (intent: ReturnType<typeof policyWriteIntentSnapshot>) => {
    if (policyWriteDisabledReason) throw new Error(policyWriteDisabledReason);
    const initialMismatch = policyWriteIntentMismatch(
      intent,
      currentIntentSnapshot(),
      mountedRef.current,
    );
    if (initialMismatch) throw new Error(initialMismatch);
    if (!intent.governedWalletAddress || !publicClient) {
      throw new Error(`${ARC_NETWORK_NAME} RPC is unavailable.`);
    }
    if (chainId !== arcChain.id) await switchChainAsync({ chainId: arcChain.id });
    const latestMismatch = policyWriteIntentMismatch(
      intent,
      currentIntentSnapshot(),
      mountedRef.current,
    );
    if (latestMismatch) throw new Error(latestMismatch);
    return intent.governedWalletAddress as Address;
  };
  const savePolicyOnChain = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!allowTrustedMutation("policies.update", event) || policySubmittingRef.current) return;
    policySubmittingRef.current = true;
    state.setPolicySaving(true);
    draft.setPolicyError(null);
    state.setPolicyTxHash(null);
    try {
      const capturedDraft = clonePolicyDraft(draft.policyDraft);
      const nextPolicy = buildPolicyEnvelope(capturedDraft);
      const intent = policyWriteIntentSnapshot({
        authenticated: isAuthenticated,
        connected: isConnected,
        draft: capturedDraft,
        envelope: nextPolicy,
        governedWalletAddress: selectedGovernedWalletAddress,
        options: policyWalletOptions,
        ownerAddress: deployment.policyWalletOwner ?? null,
        routeWalletId,
        selectedPolicyWalletAddress: draft.selectedPolicyWalletAddress,
        signerAddress: address ?? null,
      });
      const governedWallet = await ensurePolicyWriteReady(intent);
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
      draft.setActivePolicyDraft(capturedDraft);
      state.setPolicyPendingIndexer(true);
      let syncFailed: string | null = null;
      let syncTimer: ReturnType<typeof setTimeout> | undefined;
      let syncTimedOut = false;
      try {
        const syncPromise = recordDeployedPolicy.mutateAsync({
          walletAddress: governedWallet,
          txHash: hash,
          perTxCap: capturedDraft.perTxCap,
          dailyCap: capturedDraft.dailyCap,
          monthlyCap: capturedDraft.monthlyCap,
          escalationThreshold: capturedDraft.escalationThreshold,
          allowedCategories: draftCategoryNames(capturedDraft),
          requireAllowlist: nextPolicy.requireAllowlist,
          freezeOnBlockedVendor: nextPolicy.freezeOnBlockedVendor,
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
