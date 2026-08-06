"use client";

import { arcTestnet } from "@arcanum/shared";
import Link from "next/link";
import { useParams } from "next/navigation";
import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { toast } from "sonner";
import { formatUnits, parseUnits } from "viem";
import type { Address, Hash } from "viem";
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from "wagmi";

import { useWorkspaceMode } from "@/lib/auth-session";
import {
  type DoctrineCategoryValue,
  type PolicyDraftState,
  type PolicyEnvelopeValue,
  allPolicyCategoriesMask,
  doctrineCategoryOptions,
  guardedWalletControlAbi,
  initialPolicyDraft,
} from "@/lib/contracts";
import { isEvmAddress, isSameAddress, shortAddress } from "@/lib/format/address";
import { trpc } from "@/lib/trpc";

/* ------------------------------------------------------------------ */
/* Policy math + validation preserved from the old PolicyEditor          */
/* ------------------------------------------------------------------ */

function errorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "shortMessage" in error) {
    return String((error as { shortMessage?: unknown }).shortMessage);
  }
  return error instanceof Error ? error.message : "Transaction failed. Please retry.";
}

function allowTrustedMutation(action: string, event: ReactMouseEvent<HTMLElement>) {
  if (event.nativeEvent.isTrusted) {
    return true;
  }
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[Arcanum] Blocked ${action}: mutations require an explicit trusted click.`);
  }
  return false;
}

function parseUsdcInput(value: string, label: string) {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error(`${label} must be a positive USDC amount with up to 6 decimals.`);
  }
  const parsed = parseUnits(trimmed, 6);
  if (parsed <= 0n) {
    throw new Error(`${label} must be greater than zero.`);
  }
  return parsed;
}

function usdcInputValue(value: bigint) {
  const formatted = formatUnits(value, 6);
  return formatted.includes(".") ? formatted.replace(/\.?0+$/, "") : formatted;
}

function doctrineCategoryBit(category: DoctrineCategoryValue) {
  if (category === "API") return 1n << 0n;
  if (category === "COMPUTE") return 1n << 1n;
  if (category === "DATA") return 1n << 2n;
  if (category === "SUBCONTRACTING") return 1n << 3n;
  return 1n << 4n;
}

function categoryMaskFromDraft(categories: ReadonlySet<DoctrineCategoryValue>) {
  let mask = 0n;
  for (const category of categories) {
    mask |= doctrineCategoryBit(category);
  }
  return mask;
}

/** Doctrine category names as the read model stores them (lowercase). */
function draftCategoryNames(draft: PolicyDraftState) {
  return doctrineCategoryOptions
    .filter((category) => draft.enabledCategories.has(category.value))
    .map((category) => category.value.toLowerCase());
}

function categoriesFromMask(mask: bigint) {
  return new Set(
    doctrineCategoryOptions
      .filter((category) => (mask & doctrineCategoryBit(category.value)) !== 0n)
      .map((category) => category.value),
  );
}

function normalizePolicyDraft(draft: PolicyDraftState) {
  return {
    ...draft,
    dailyCap: draft.dailyCap.trim(),
    escalationThreshold: draft.escalationThreshold.trim(),
    monthlyCap: draft.monthlyCap.trim(),
    perTxCap: draft.perTxCap.trim(),
  };
}

function buildPolicyEnvelope(draft: PolicyDraftState): PolicyEnvelopeValue {
  const normalized = normalizePolicyDraft(draft);
  const perTxCap = parseUsdcInput(normalized.perTxCap, "Per transaction cap");
  const daily24hCap = parseUsdcInput(normalized.dailyCap, "Daily cap");
  const monthlyRollingCap = parseUsdcInput(normalized.monthlyCap, "Monthly cap");
  const escalationThreshold = parseUsdcInput(
    normalized.escalationThreshold,
    "Escalation threshold",
  );
  const allowedCategories = categoryMaskFromDraft(normalized.enabledCategories);

  if (perTxCap > daily24hCap) {
    throw new Error("Per transaction cap must be less than or equal to the daily cap.");
  }
  if (daily24hCap > monthlyRollingCap) {
    throw new Error("Daily cap must be less than or equal to the monthly cap.");
  }
  if (escalationThreshold > perTxCap) {
    throw new Error("Escalation threshold must be less than or equal to the per transaction cap.");
  }
  if (allowedCategories === 0n) {
    throw new Error("Select at least one allowed category.");
  }

  return {
    allowedCategories,
    daily24hCap,
    escalationThreshold,
    monthlyRollingCap,
    perTxCap,
    requireAllowlist: normalized.requireAllowlist,
  };
}

function safeBigInt(value: string | undefined, fallback: bigint) {
  if (value === undefined) return fallback;
  try {
    return BigInt(value);
  } catch {
    return fallback;
  }
}

function policyDraftFromServerRead(policy: {
  perTxCap: string;
  daily24hCap: string;
  monthlyRollingCap: string;
  allowedCategories: string;
  escalationThreshold: string;
  requireAllowlist: boolean;
}): PolicyDraftState {
  const perTxCap = safeBigInt(policy.perTxCap, 0n);
  const daily24hCap = safeBigInt(policy.daily24hCap, 0n);
  const monthlyRollingCap = safeBigInt(policy.monthlyRollingCap, 0n);
  const allowedCategories = safeBigInt(policy.allowedCategories, allPolicyCategoriesMask);
  const escalationThreshold = safeBigInt(policy.escalationThreshold, 0n);
  const requireAllowlist = policy.requireAllowlist;

  return {
    dailyCap: usdcInputValue(daily24hCap),
    enabledCategories: categoriesFromMask(allowedCategories),
    escalationThreshold: usdcInputValue(escalationThreshold),
    monthlyCap: usdcInputValue(monthlyRollingCap),
    perTxCap: usdcInputValue(perTxCap),
    requireAllowlist,
  };
}

function policyDiffRows(active: PolicyDraftState, draft: PolicyDraftState) {
  const rows: Array<readonly [string, string, string]> = [];
  const normalizedActive = normalizePolicyDraft(active);
  const normalizedDraft = normalizePolicyDraft(draft);
  const categoryLabelList = (categories: ReadonlySet<DoctrineCategoryValue>) =>
    doctrineCategoryOptions
      .filter((category) => categories.has(category.value))
      .map((category) => category.label)
      .join(", ");

  if (normalizedActive.perTxCap !== normalizedDraft.perTxCap) {
    rows.push(["PER-TX CAP", `$${normalizedActive.perTxCap}`, `$${normalizedDraft.perTxCap}`]);
  }
  if (normalizedActive.dailyCap !== normalizedDraft.dailyCap) {
    rows.push(["DAILY CAP", `$${normalizedActive.dailyCap}`, `$${normalizedDraft.dailyCap}`]);
  }
  if (normalizedActive.monthlyCap !== normalizedDraft.monthlyCap) {
    rows.push(["MONTHLY CAP", `$${normalizedActive.monthlyCap}`, `$${normalizedDraft.monthlyCap}`]);
  }
  if (normalizedActive.escalationThreshold !== normalizedDraft.escalationThreshold) {
    rows.push([
      "ESCALATION THRESHOLD",
      `$${normalizedActive.escalationThreshold}`,
      `$${normalizedDraft.escalationThreshold}`,
    ]);
  }
  if (
    categoryMaskFromDraft(normalizedActive.enabledCategories) !==
    categoryMaskFromDraft(normalizedDraft.enabledCategories)
  ) {
    rows.push([
      "ALLOWED CATEGORIES",
      categoryLabelList(normalizedActive.enabledCategories) || "none",
      categoryLabelList(normalizedDraft.enabledCategories) || "none",
    ]);
  }
  if (normalizedActive.requireAllowlist !== normalizedDraft.requireAllowlist) {
    rows.push([
      "VENDOR ALLOWLIST",
      normalizedActive.requireAllowlist ? "required" : "optional",
      normalizedDraft.requireAllowlist ? "required" : "optional",
    ]);
  }

  return rows;
}

/* ------------------------------------------------------------------ */

const policyInputClass =
  "mt-1 w-full border-b border-[var(--wl-faint)] bg-transparent py-2.5 font-mono text-[13px] outline-none transition-colors focus:border-[var(--wl-signal)]";

export default function PolicyEditorPage() {
  const workspace = useWorkspaceMode();
  const params = useParams();
  const routeWalletId =
    typeof params.walletId === "string"
      ? params.walletId
      : Array.isArray(params.walletId)
        ? (params.walletId[0] ?? "")
        : "";

  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: arcTestnet.id });
  const { switchChainAsync, isPending: switchPending } = useSwitchChain();
  const { writeContractAsync, isPending: writePending } = useWriteContract();
  const utils = trpc.useUtils();
  const recordDeployedPolicy = trpc.policies.recordDeployed.useMutation();

  const [policyDraft, setPolicyDraft] = useState<PolicyDraftState>(initialPolicyDraft);
  const [activePolicyDraft, setActivePolicyDraft] = useState<PolicyDraftState>(initialPolicyDraft);
  const [selectedPolicyWalletAddress, setSelectedPolicyWalletAddress] = useState("");
  const [policyWalletOwner, setPolicyWalletOwner] = useState<Address | null>(null);
  const [policyReadStatus, setPolicyReadStatus] = useState<"idle" | "checking" | "ready" | "error">(
    "idle",
  );
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [policySaving, setPolicySaving] = useState(false);
  const [policyTxHash, setPolicyTxHash] = useState<Hash | null>(null);
  const [policyPendingIndexer, setPolicyPendingIndexer] = useState(false);
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
  const selectedGovernedWalletAddress = isEvmAddress(selectedPolicyWalletAddress)
    ? (selectedPolicyWalletAddress as Address)
    : null;
  const ownerMatchesConnectedWallet = Boolean(
    policyWalletOwner && address && isSameAddress(policyWalletOwner, address),
  );
  const policyDiffs = useMemo(
    () => policyDiffRows(activePolicyDraft, policyDraft),
    [activePolicyDraft, policyDraft],
  );
  const unsavedCount = policyDiffs.length;
  const selectedPolicyWalletLabel =
    policyWalletOptions.find((wallet) => isSameAddress(wallet.address, selectedPolicyWalletAddress))
      ?.label ?? "Governed wallet";

  useEffect(() => {
    if (
      selectedPolicyWalletAddress &&
      policyWalletOptions.some((wallet) =>
        isSameAddress(wallet.address, selectedPolicyWalletAddress),
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
    setSelectedPolicyWalletAddress(
      routeMatch?.address ?? policyWalletOptions[0]?.address ?? routeAddress,
    );
  }, [policyWalletOptions, routeWalletId, selectedPolicyWalletAddress]);

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
      setPolicyWalletOwner(null);
      setPolicyReadStatus("idle");
      return;
    }
    if (onChainPolicyQuery.isLoading || onChainPolicyQuery.isFetching) {
      setPolicyReadStatus("checking");
      setPolicyError(null);
      return;
    }
    if (onChainPolicyQuery.isError) {
      setPolicyWalletOwner(null);
      setPolicyReadStatus("error");
      setPolicyError(onChainPolicyQuery.error.message);
      // The re-read failed, so stop claiming a sync is in flight.
      setPolicyPendingIndexer(false);
      return;
    }
    if (onChainPolicyQuery.data) {
      const nextDraft = policyDraftFromServerRead(onChainPolicyQuery.data.policy);
      setPolicyWalletOwner(onChainPolicyQuery.data.owner as Address);
      setActivePolicyDraft(nextDraft);
      setPolicyDraft(nextDraft);
      setPolicyPendingIndexer(false);
      setPolicyReadStatus("ready");
    }
  }, [
    selectedGovernedWalletAddress,
    onChainPolicyQuery.data,
    onChainPolicyQuery.isLoading,
    onChainPolicyQuery.isFetching,
    onChainPolicyQuery.isError,
    onChainPolicyQuery.error,
  ]);

  // Safety net: "PENDING INDEXER SYNC" must never become a permanent state.
  // If no on-chain re-read confirms the update within 90s, stop waiting.
  useEffect(() => {
    if (!policyPendingIndexer) {
      return;
    }
    const timer = setTimeout(() => setPolicyPendingIndexer(false), 90_000);
    return () => clearTimeout(timer);
  }, [policyPendingIndexer]);

  const policyWriteDisabledReason = !selectedGovernedWalletAddress
    ? walletsQuery.isLoading
      ? "Loading governed wallets."
      : "Create or select a governed wallet first."
    : !isConnected
      ? "Connect wallet first."
      : !workspace.isAuthenticated
        ? "Sign in to manage policy."
        : policyReadStatus === "checking"
          ? "Reading active policy from Arc Testnet."
          : policyReadStatus === "error"
            ? "Unable to read governed wallet policy on Arc Testnet."
            : !ownerMatchesConnectedWallet
              ? "Only the governed wallet owner can update policy."
              : unsavedCount === 0
                ? "No policy changes to submit."
                : null;
  const policyNetworkNotice =
    isConnected && chainId !== arcTestnet.id
      ? "Wallet will be asked to switch to Arc Testnet."
      : null;

  const toggleCategory = (category: DoctrineCategoryValue) => {
    setPolicyDraft((current) => {
      const next = new Set(current.enabledCategories);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return { ...current, enabledCategories: next };
    });
    setPolicyError(null);
    setPolicyPendingIndexer(false);
  };

  const updatePolicyDraft = (patch: Partial<PolicyDraftState>) => {
    setPolicyDraft((current) => ({ ...current, ...patch }));
    setPolicyError(null);
    setPolicyPendingIndexer(false);
  };

  const ensurePolicyWriteReady = async () => {
    if (policyWriteDisabledReason) {
      throw new Error(policyWriteDisabledReason);
    }
    if (!selectedGovernedWalletAddress || !publicClient) {
      throw new Error("Arc Testnet RPC is unavailable.");
    }
    if (chainId !== arcTestnet.id) {
      await switchChainAsync({ chainId: arcTestnet.id });
    }
    return selectedGovernedWalletAddress;
  };

  const savePolicyOnChain = async (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (!allowTrustedMutation("policies.update", event)) {
      return;
    }
    if (policySubmittingRef.current) {
      return;
    }
    policySubmittingRef.current = true;
    setPolicySaving(true);
    setPolicyError(null);
    setPolicyTxHash(null);
    try {
      const nextPolicy = buildPolicyEnvelope(policyDraft);
      const governedWallet = await ensurePolicyWriteReady();
      const hash = await writeContractAsync({
        address: governedWallet,
        abi: guardedWalletControlAbi,
        functionName: "setPolicy",
        args: [nextPolicy],
        chainId: arcTestnet.id,
      });
      setPolicyTxHash(hash);

      // A missing receipt must never strand the button on "Waiting for
      // receipt": bound the wait and tell the owner where the tx stands.
      const receipt = await publicClient
        ?.waitForTransactionReceipt({ hash, confirmations: 1, timeout: 120_000 })
        .catch(() => {
          throw new Error(
            "The policy transaction was sent but its confirmation did not arrive within 2 minutes. It may still confirm. Check the wallet's activity before retrying.",
          );
        });
      if (receipt?.status !== "success") {
        throw new Error("Policy transaction reverted.");
      }

      setActivePolicyDraft(policyDraft);
      setPolicyPendingIndexer(true);

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
        ]).catch(() => undefined);
      try {
        // The mirror write must not be able to hang the button either: the
        // policy is already live on-chain, so cap the dashboard sync wait.
        const syncPromise = recordDeployedPolicy.mutateAsync({
          walletAddress: governedWallet,
          txHash: hash,
          perTxCap: Number(nextPolicy.perTxCap) / 1e6,
          dailyCap: Number(nextPolicy.daily24hCap) / 1e6,
          monthlyCap: Number(nextPolicy.monthlyRollingCap) / 1e6,
          escalationThreshold: Number(nextPolicy.escalationThreshold) / 1e6,
          allowedCategories: draftCategoryNames(policyDraft),
          requireAllowlist: nextPolicy.requireAllowlist,
        });
        // If the mutation outlives the 20s wait but then succeeds, reconcile
        // the UI instead of leaving the earlier "not synced" warning standing.
        // A late failure must not surface as an unhandled rejection either.
        syncPromise
          .then(() => {
            if (!syncTimedOut) {
              return;
            }
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
        syncFailed = errorMessage(caught);
      } finally {
        clearTimeout(syncTimer);
      }

      // Fire-and-forget: a hanging refetch must never keep the button busy.
      void refreshPolicyQueries();

      if (syncFailed) {
        toast.warning("POLICY LIVE ON-CHAIN · DASHBOARD NOT SYNCED", {
          description: `The wallet now enforces the new policy, but the dashboard could not be updated: ${syncFailed}`,
        });
      } else {
        toast.success("POLICY TX CONFIRMED", {
          description: "Policy update is confirmed on-chain and reflected across the dashboard.",
        });
      }
    } catch (caught) {
      const message = errorMessage(caught);
      setPolicyError(message);
      toast.error("POLICY UPDATE FAILED", { description: message });
    } finally {
      setPolicySaving(false);
      policySubmittingRef.current = false;
    }
  };

  const resetDraft = () => {
    setPolicyDraft(activePolicyDraft);
    setPolicyError(null);
    setPolicyPendingIndexer(false);
  };

  const policyBusy = policySaving || switchPending || writePending;
  const deployStatusLabel = policyPendingIndexer
    ? "DEPLOYED"
    : unsavedCount > 0
      ? "PENDING"
      : "ACTIVE";

  return (
    <main className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]">
      <style>{`
        .policy-in{animation:policyIn 560ms cubic-bezier(.16,1,.3,1) calc(var(--i,0)*80ms) both}@keyframes policyIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        @media(prefers-reduced-motion:reduce){.policy-in{animation:none}}
      `}</style>
      <div className="mx-auto max-w-[1400px] px-5 py-9 md:px-8 md:py-10">
        <div
          className="policy-in flex flex-col justify-between gap-7 border-b border-[var(--wl-line)] pb-9 md:flex-row md:items-end"
          style={{ "--i": 0 } as CSSProperties}
        >
          <div>
            <Link
              href={isEvmAddress(routeWalletId) ? `/agents/${routeWalletId}` : "/agents"}
              className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-secondary)] hover:text-[var(--wl-signal)]"
            >
              ← {selectedPolicyWalletLabel} dossier
            </Link>
            <p className="mt-6 font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
              GOVERNANCE / POLICY INSTRUMENT
            </p>
            <h1 className="font-display mt-4 text-[clamp(2.8rem,6vw,5.3rem)] font-semibold leading-[.86] tracking-[-.015em]">
              Policy editor
            </h1>
            <p className="mt-5 max-w-[520px] text-[14px] leading-[1.45] text-[var(--wl-secondary2)]">
              Revise the governing document. Changes remain inert until a wallet owner signs and
              deploys them on Arc Testnet.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-secondary)]">
              {policyReadStatus === "checking"
                ? "READING ON-CHAIN POLICY"
                : policyPendingIndexer
                  ? "FINALIZING"
                  : "ARC TESTNET POLICY"}
            </span>
            <button
              type="button"
              onClick={resetDraft}
              disabled={unsavedCount === 0 || policyBusy}
              className="warm-pill warm-pill-ghost rounded-full border border-[var(--wl-line)] px-4 py-2.5 text-[11px] font-semibold disabled:opacity-40"
            >
              Reset draft
            </button>
            <button
              type="button"
              onClick={savePolicyOnChain}
              disabled={Boolean(policyWriteDisabledReason) || policyBusy}
              title={policyWriteDisabledReason ?? "Sign and deploy this policy revision."}
              className="warm-pill rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[11px] font-semibold text-white disabled:opacity-40"
            >
              {policyBusy
                ? policyTxHash
                  ? "Waiting for receipt"
                  : "Confirm in wallet"
                : "Sign & deploy"}
            </button>
          </div>
        </div>

        {policyWalletOptions.length > 0 ? (
          <div
            className="policy-in flex flex-wrap items-center gap-3 border-b border-[var(--wl-line)] py-5"
            style={{ "--i": 1 } as CSSProperties}
          >
            <span className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
              GOVERNED WALLET
            </span>
            <select
              value={selectedPolicyWalletAddress}
              onChange={(event) => setSelectedPolicyWalletAddress(event.target.value)}
              className="border-b border-[var(--wl-faint)] bg-transparent py-2 font-mono text-[12px] outline-none focus:border-[var(--wl-signal)]"
            >
              {policyWalletOptions.map((wallet) => (
                <option key={wallet.id} value={wallet.address}>
                  {wallet.label} · {shortAddress(wallet.address)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="grid gap-10 pt-10 xl:grid-cols-[minmax(0,1.55fr)_360px]">
          <section
            className="policy-in border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] shadow-[14px_18px_0_var(--wl-bg-deep2)]"
            style={{ "--i": 2 } as CSSProperties}
          >
            <div className="border-b border-[var(--wl-line)] px-6 py-6 md:px-9">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
                    ARCANUM / GOVERNING DOCUMENT
                  </p>
                  <h2 className="font-display mt-3 text-[28px] font-semibold tracking-[-.015em]">
                    {selectedPolicyWalletLabel} doctrine
                  </h2>
                </div>
                <span className="border border-[var(--wl-line)] px-2 py-1 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
                  {unsavedCount > 0 ? `${unsavedCount} unsaved` : "active policy"}
                </span>
              </div>
              <p className="mt-4 max-w-[570px] text-[13px] leading-[1.5] text-[var(--wl-body)]">
                This instrument defines where capital may move, how much may move, and when a person
                must take the seat.
              </p>
            </div>

            {policyReadStatus === "checking" && selectedGovernedWalletAddress ? (
              <div className="px-6 py-10 md:px-9">
                <div className="space-y-4">
                  {[0, 1, 2].map((index) => (
                    <div
                      key={index}
                      className="h-10 animate-pulse rounded bg-[var(--wl-line-soft)]"
                    />
                  ))}
                </div>
              </div>
            ) : policyReadStatus === "error" && selectedGovernedWalletAddress ? (
              <div className="px-6 py-14 text-center md:px-9">
                <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
                  Policy read failed
                </p>
                <p className="mx-auto mt-3 max-w-[420px] font-mono text-[11px] leading-[1.6] text-[var(--wl-body)]">
                  {policyError ?? "Unable to read policy from Arc Testnet."}
                </p>
              </div>
            ) : !selectedGovernedWalletAddress ? (
              <div className="px-6 py-14 text-center md:px-9">
                <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
                  {walletsQuery.isLoading
                    ? "Loading governed wallets"
                    : "No governed wallet selected"}
                </p>
                <Link
                  href="/agents"
                  className="mt-4 inline-block text-[12px] text-[var(--wl-signal)] underline underline-offset-4"
                >
                  Deploy or select a governed wallet
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-[var(--wl-line-soft)] px-6 md:px-9">
                <div className="py-7">
                  <p className="font-mono text-[10px] uppercase tracking-[.15em] text-[var(--wl-signal)]">
                    01 / LIMITS
                  </p>
                  <h3 className="mt-2 text-[18px] font-medium">Capital envelope</h3>
                  <div className="mt-6 grid gap-7 sm:grid-cols-3">
                    <label>
                      <span className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
                        PER TRANSACTION · USDC
                      </span>
                      <input
                        className={policyInputClass}
                        value={policyDraft.perTxCap}
                        onChange={(event) => updatePolicyDraft({ perTxCap: event.target.value })}
                        inputMode="decimal"
                      />
                    </label>
                    <label>
                      <span className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
                        DAILY CAP · USDC
                      </span>
                      <input
                        className={policyInputClass}
                        value={policyDraft.dailyCap}
                        onChange={(event) => updatePolicyDraft({ dailyCap: event.target.value })}
                        inputMode="decimal"
                      />
                    </label>
                    <label>
                      <span className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
                        MONTHLY CAP · USDC
                      </span>
                      <input
                        className={policyInputClass}
                        value={policyDraft.monthlyCap}
                        onChange={(event) => updatePolicyDraft({ monthlyCap: event.target.value })}
                        inputMode="decimal"
                      />
                    </label>
                  </div>
                </div>

                <div className="py-7">
                  <p className="font-mono text-[10px] uppercase tracking-[.15em] text-[var(--wl-signal)]">
                    02 / COUNTERPARTIES
                  </p>
                  <h3 className="mt-2 text-[18px] font-medium">Allowed categories</h3>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {doctrineCategoryOptions.map((category) => {
                      const enabled = policyDraft.enabledCategories.has(category.value);
                      return (
                        <button
                          type="button"
                          key={category.value}
                          onClick={() => toggleCategory(category.value)}
                          className={`rounded-full border px-3.5 py-2 font-mono text-[9px] uppercase tracking-[.1em] transition-colors ${
                            enabled
                              ? "border-[var(--wl-ink)] bg-[var(--wl-ink)] text-[var(--wl-bg)]"
                              : "border-[var(--wl-line)] text-[var(--wl-secondary)] hover:border-[var(--wl-ink)]"
                          }`}
                        >
                          {enabled ? "✓ " : "+ "}
                          {category.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-4 font-mono text-[9px] text-[var(--wl-mute)]">
                    {policyDraft.enabledCategories.size} categor
                    {policyDraft.enabledCategories.size === 1 ? "y" : "ies"} permitted · all other
                    categories are blocked
                  </p>
                  <label className="mt-5 flex items-center gap-3 text-[12px] text-[var(--wl-body)]">
                    <input
                      type="checkbox"
                      checked={policyDraft.requireAllowlist}
                      onChange={(event) =>
                        updatePolicyDraft({ requireAllowlist: event.target.checked })
                      }
                      className="accent-[var(--wl-signal)]"
                    />
                    Require vendor allowlist (blocks unlisted counterparties)
                  </label>
                </div>

                <div className="py-7">
                  <p className="font-mono text-[10px] uppercase tracking-[.15em] text-[var(--wl-signal)]">
                    03 / HUMAN CONTROL
                  </p>
                  <h3 className="mt-2 text-[18px] font-medium">Escalation threshold</h3>
                  <div className="mt-6 grid gap-7 sm:grid-cols-2">
                    <label>
                      <span className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
                        ESCALATE ABOVE · USDC
                      </span>
                      <input
                        className={policyInputClass}
                        value={policyDraft.escalationThreshold}
                        onChange={(event) =>
                          updatePolicyDraft({ escalationThreshold: event.target.value })
                        }
                        inputMode="decimal"
                      />
                    </label>
                  </div>
                  <p className="mt-4 font-mono text-[9px] leading-[1.6] text-[var(--wl-mute)]">
                    Payments above this amount route to the escalation council before settling.
                  </p>
                </div>

                {policyError ? (
                  <div className="py-5">
                    <div className="border border-[var(--wl-signal)] bg-[var(--wl-bg-soft)] px-3 py-2 font-mono text-[11px] leading-[1.5] text-[var(--wl-signal)]">
                      {policyError}
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            <div className="flex flex-col justify-between gap-3 border-t border-[var(--wl-line)] bg-[var(--wl-bg-soft)] px-6 py-5 sm:flex-row sm:items-center md:px-9">
              <p className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
                {policyNetworkNotice ?? "Unsaved changes are local until signed"}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetDraft}
                  disabled={unsavedCount === 0}
                  className="rounded-full px-3 py-2 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)] disabled:opacity-40"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={savePolicyOnChain}
                  disabled={Boolean(policyWriteDisabledReason) || policyBusy}
                  title={policyWriteDisabledReason ?? "Sign and deploy this policy revision."}
                  className="warm-pill rounded-full bg-[var(--wl-signal)] px-4 py-2.5 text-[10px] font-semibold text-white disabled:opacity-40"
                >
                  Sign & deploy
                </button>
              </div>
            </div>
          </section>

          <aside
            className="policy-in bg-[var(--wl-bg-soft)] p-6 md:p-7"
            style={{ "--i": 3 } as CSSProperties}
          >
            <div className="flex items-start justify-between border-b border-[var(--wl-line)] pb-5">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.17em] text-[var(--wl-signal)]">
                  SIGNING / CONTROL
                </p>
                <h2 className="font-display mt-2 text-[22px] font-medium tracking-[-.015em]">
                  Deployment record
                </h2>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.12em] ${
                  deployStatusLabel === "DEPLOYED"
                    ? "bg-[var(--wl-green-tint)] text-[var(--wl-green)]"
                    : "border border-[var(--wl-signal)] text-[var(--wl-signal)]"
                }`}
              >
                {deployStatusLabel}
              </span>
            </div>
            <dl className="divide-y divide-[var(--wl-line)] py-3 font-mono text-[10px]">
              {(
                [
                  [
                    "WALLET",
                    selectedGovernedWalletAddress
                      ? shortAddress(selectedGovernedWalletAddress)
                      : "-",
                  ],
                  ["OWNER", policyWalletOwner ? shortAddress(policyWalletOwner) : "-"],
                  ["CONNECTED", address ? shortAddress(address) : "not connected"],
                  ["NETWORK", "ARC TESTNET"],
                  ["UNSAVED", unsavedCount.toString()],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="grid grid-cols-[.9fr_1.1fr] gap-3 py-3">
                  <dt className="text-[var(--wl-mute)]">{label}</dt>
                  <dd className="truncate text-right text-[var(--wl-body)]" title={value}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            {policyDiffs.length > 0 ? (
              <div className="border-t border-[var(--wl-line)] py-6">
                <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
                  PROPOSED CHANGES
                </p>
                <div className="mt-4 space-y-3">
                  {policyDiffs.map(([label, before, after]) => (
                    <div key={label} className="font-mono text-[10px]">
                      <p className="uppercase tracking-[.1em] text-[var(--wl-mute)]">{label}</p>
                      <p className="mt-1 text-[var(--wl-body)]">
                        <span className="text-[var(--wl-mute)] line-through">{before}</span>
                        <span className="mx-2">→</span>
                        <span className="text-[var(--wl-signal)]">{after}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="border-t border-[var(--wl-line)] py-6">
              <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
                EFFECT OF SIGNATURE
              </p>
              <p className="mt-3 text-[13px] leading-[1.5] text-[var(--wl-body)]">
                The new limits become authoritative on-chain for the next governed event. The
                dashboard may take a moment to reflect them.
              </p>
            </div>
            <div className="border-t border-[var(--wl-line)] pt-5">
              <Link
                href={isEvmAddress(routeWalletId) ? `/agents/${routeWalletId}` : "/agents"}
                className="group font-mono text-[10px] uppercase tracking-[.13em] text-[var(--wl-body)] hover:text-[var(--wl-signal)]"
              >
                Return to dossier
                <span className="ml-2 inline-block transition-transform group-hover:-translate-x-1">
                  ←
                </span>
              </Link>
            </div>
          </aside>
        </div>

        <footer className="mt-14 flex flex-col justify-between gap-3 border-t border-[var(--wl-line)] pt-5 font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-mute)] sm:flex-row">
          <span>Draft changes · no capital movement until signed</span>
          <span>
            {policyPendingIndexer ? "Revision deployed · record updating" : "Arc Testnet policy"}
          </span>
        </footer>
      </div>
    </main>
  );
}
