import { formatUnits, parseUnits } from "viem";

import {
  type DoctrineCategoryValue,
  type PolicyDraftState,
  type PolicyEnvelopeValue,
  allPolicyCategoriesMask,
  doctrineCategoryOptions,
} from "@/lib/contracts";

function parseUsdcInput(value: string, label: string): bigint {
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

function parseMonthlyCap(value: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error("Monthly cap must be a USDC amount with up to 6 decimals.");
  }
  return parseUnits(trimmed, 6);
}

function usdcInputValue(value: bigint): string {
  const formatted = formatUnits(value, 6);
  return formatted.includes(".") ? formatted.replace(/\.?0+$/, "") : formatted;
}

function doctrineCategoryBit(category: DoctrineCategoryValue): bigint {
  if (category === "API") return 1n << 0n;
  if (category === "COMPUTE") return 1n << 1n;
  if (category === "DATA") return 1n << 2n;
  if (category === "SUBCONTRACTING") return 1n << 3n;
  return 1n << 4n;
}

function categoryMaskFromDraft(categories: ReadonlySet<DoctrineCategoryValue>): bigint {
  let mask = 0n;
  for (const category of categories) {
    mask |= doctrineCategoryBit(category);
  }
  return mask;
}

/** Doctrine category names as the read model stores them (lowercase). */
export function draftCategoryNames(draft: PolicyDraftState): string[] {
  return doctrineCategoryOptions
    .filter((category) => draft.enabledCategories.has(category.value))
    .map((category) => category.value.toLowerCase());
}

function normalizePolicyDraft(draft: PolicyDraftState): PolicyDraftState {
  return {
    ...draft,
    dailyCap: draft.dailyCap.trim(),
    escalationThreshold: draft.escalationThreshold.trim(),
    monthlyCap: draft.monthlyCap.trim(),
    perTxCap: draft.perTxCap.trim(),
  };
}

export function buildPolicyEnvelope(draft: PolicyDraftState): PolicyEnvelopeValue {
  const normalized = normalizePolicyDraft(draft);
  const perTxCap = parseUsdcInput(normalized.perTxCap, "Per transaction cap");
  const daily24hCap = parseUsdcInput(normalized.dailyCap, "Daily cap");
  const monthlyCap = parseMonthlyCap(normalized.monthlyCap);
  const escalationThreshold = parseUsdcInput(
    normalized.escalationThreshold,
    "Escalation threshold",
  );
  const allowedCategories = categoryMaskFromDraft(normalized.enabledCategories);

  if (perTxCap > daily24hCap) {
    throw new Error("Per transaction cap must be less than or equal to the daily cap.");
  }
  if (monthlyCap !== 0n && daily24hCap > monthlyCap) {
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
    monthlyCap,
    perTxCap,
    requireAllowlist: normalized.requireAllowlist,
    freezeOnBlockedVendor: normalized.freezeOnBlockedVendor,
  };
}

export function policyValidationError(draft: PolicyDraftState): string | null {
  try {
    buildPolicyEnvelope(draft);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Policy values are invalid.";
  }
}

export function reconcilePolicyDraft(
  currentDraft: PolicyDraftState,
  nextOnChainDraft: PolicyDraftState,
  walletChanged: boolean,
) {
  return {
    draft: walletChanged ? nextOnChainDraft : currentDraft,
    onChainChanged: !walletChanged && policyDiffRows(nextOnChainDraft, currentDraft).length > 0,
  };
}

function safeBigInt(value: string | undefined, fallback: bigint): bigint {
  if (value === undefined) return fallback;
  try {
    return BigInt(value);
  } catch {
    return fallback;
  }
}

export function policyDraftFromServerRead(policy: {
  perTxCap: string;
  daily24hCap: string;
  monthlyCap: string;
  allowedCategories: string;
  escalationThreshold: string;
  requireAllowlist: boolean;
  freezeOnBlockedVendor: boolean;
}): PolicyDraftState {
  const allowedCategories = safeBigInt(policy.allowedCategories, allPolicyCategoriesMask);
  return {
    dailyCap: usdcInputValue(safeBigInt(policy.daily24hCap, 0n)),
    enabledCategories: new Set(
      doctrineCategoryOptions
        .filter((category) => (allowedCategories & doctrineCategoryBit(category.value)) !== 0n)
        .map((category) => category.value),
    ),
    escalationThreshold: usdcInputValue(safeBigInt(policy.escalationThreshold, 0n)),
    monthlyCap: usdcInputValue(safeBigInt(policy.monthlyCap, 0n)),
    perTxCap: usdcInputValue(safeBigInt(policy.perTxCap, 0n)),
    requireAllowlist: policy.requireAllowlist,
    freezeOnBlockedVendor: policy.freezeOnBlockedVendor,
  };
}

export type PolicyDiff = readonly [string, string, string];

export function policyDiffRows(active: PolicyDraftState, draft: PolicyDraftState): PolicyDiff[] {
  const rows: PolicyDiff[] = [];
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
  if (normalizedActive.freezeOnBlockedVendor !== normalizedDraft.freezeOnBlockedVendor) {
    rows.push([
      "BLOCKED VENDOR RESPONSE",
      normalizedActive.freezeOnBlockedVendor ? "freeze wallet" : "deny transfer",
      normalizedDraft.freezeOnBlockedVendor ? "freeze wallet" : "deny transfer",
    ]);
  }
  return rows;
}

export function allowTrustedMutation(
  action: string,
  event: React.MouseEvent<HTMLElement>,
): boolean {
  if (event.nativeEvent.isTrusted) return true;
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[Arcanum] Blocked ${action}: mutations require an explicit trusted click.`);
  }
  return false;
}
