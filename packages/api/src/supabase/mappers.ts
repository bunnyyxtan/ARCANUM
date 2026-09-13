import { createHash } from "node:crypto";
import { FALLBACK_TENANT_ID, defaultTenantId } from "@arcanum/db";
import type {
  Agent,
  Anomaly,
  Escalation,
  Policy,
  Transfer,
  Vendor,
  Wallet,
} from "@arcanum/db/schema";
import { computePostureScore } from "../posture";
import type { SupabaseRow } from "./client";
import {
  arrayField,
  booleanField,
  dateField,
  moneyBaseUnits,
  numberField,
  numberOrNull,
  stableHash,
  stableUuid,
  stringField,
} from "./fields";
import type { SupabasePublicWalletProfile } from "./health";
import { walletForRow } from "./scope";
import type { AgentWithDoctrine } from "./wallets";

export const DEFAULT_WORKSPACE_NAME = "Arcanum Workspace";

export function workspaceSlugForWallet(walletAddress: string) {
  return `arcanum-${walletAddress.slice(2, 10)}`;
}

export function shortAddress(value: string) {
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

export function walletFromGovernedWalletRow(row: SupabaseRow): Wallet {
  const walletAddress = stringField(row, ["wallet_address", "address"], zeroWallet());
  const label = stringField(row, ["label", "name"], shortAddress(walletAddress));
  const status = stringField(row, ["status", "indexer_status"], "active").toLowerCase();

  return {
    id: stringField(row, ["id"], stableUuid(`wallet:${walletAddress}`)),
    tenantId: defaultTenantId(),
    orgId: stringField(row, ["organization_id", "org_id"], ""),
    address: walletAddress.toLowerCase(),
    label,
    ownerAddress: stringField(row, ["owner_address"], "") || ownerScopeFromEnv(),
    createdBlock: numberField(row, ["created_block", "block_number"], 0),
    createdAt: dateField(row, ["created_at", "deployed_at"]),
    factoryAddress: stringField(row, ["wallet_factory_address"], zeroWallet()),
    frozen: status.includes("frozen") || status.includes("restraint"),
    policyVersion: numberField(row, ["policy_version", "doctrine_version"], 1),
  };
}

/**
 * Posture is computed from the doctrine that actually restrains the wallet,
 * never read from a stored constant, so every agent's score reflects its own
 * controls and reacts when the policy changes.
 */
export function postureFromDoctrineRow(row: SupabaseRow, frozen: boolean): number {
  return computePostureScore({
    requireVendorAllowlist: booleanField(row, ["require_vendor_allowlist"], false),
    quorum: numberField(row, ["quorum"], 0),
    councilSize: arrayField(row, ["escalation_council"]).length,
    perTxCapUsd: numberField(row, ["per_tx_cap_usdc"], 0),
    dailyCapUsd: numberField(row, ["daily_cap_usdc"], 0),
    monthlyCapUsd: numberField(row, ["monthly_cap_usdc"], 0),
    escalateAboveUsd: numberField(row, ["escalate_above_usdc"], 0),
    doctrineVersion: numberField(row, ["version", "policy_version"], 1),
    frozen,
  });
}

export function agentFromSigner(
  wallet: Wallet,
  signerAddress: string,
  doctrine: SupabaseRow,
  postureScore: number,
): AgentWithDoctrine {
  const label = wallet.label || shortAddress(wallet.address);
  return {
    id: stableUuid(`agent:${wallet.address}:${signerAddress}`),
    tenantId: wallet.tenantId,
    walletId: wallet.id,
    signerAddress,
    label,
    type: agentTypeFromLabel(label),
    createdAt: wallet.createdAt,
    lastSeenAt: wallet.createdAt,
    // An authorized signer on an unfrozen wallet can spend right now; a frozen
    // wallet blocks every signer regardless of authorization.
    status: wallet.frozen ? "frozen" : "active",
    walletAddress: wallet.address,
    // The caps the agent actually spends under, so the UI never has to guess.
    perTxCap: moneyBaseUnits(doctrine, ["per_tx_cap_usdc"]),
    daily24hCap: moneyBaseUnits(doctrine, ["daily_cap_usdc"]),
    monthlyCap: moneyBaseUnits(doctrine, ["monthly_cap_usdc"]),
    escalationThreshold: moneyBaseUnits(doctrine, ["escalate_above_usdc"]),
    policyVersion: numberField(doctrine, ["version", "policy_version"], wallet.policyVersion),
    postureScore,
  };
}

export function policyFromDoctrineRow(
  row: SupabaseRow,
  wallet: Wallet,
): Policy & { doctrineStatus: string; signers: string[] } {
  return {
    id: stableUuid(`policy:${wallet.address}:${stringField(row, ["version"], "1")}`),
    tenantId: wallet.tenantId,
    walletId: wallet.id,
    version: numberField(row, ["version", "policy_version"], wallet.policyVersion),
    perTxCap: moneyBaseUnits(row, ["per_tx_cap_usdc"]),
    daily24hCap: moneyBaseUnits(row, ["daily_cap_usdc"]),
    monthlyCap: moneyBaseUnits(row, ["monthly_cap_usdc"]),
    allowedCategories: allowedCategoryMask(row),
    escalationThreshold: moneyBaseUnits(row, ["escalate_above_usdc"]),
    requireAllowlist: booleanField(row, ["require_vendor_allowlist"], true),
    freezeOnBlockedVendor: booleanField(row, ["freeze_on_blocked_vendor"], false),
    updatedAt: dateField(row, ["updated_at"]),
    updatedBy: wallet.ownerAddress,
    doctrineStatus: stringField(row, ["status"], "active"),
    signers: arrayField(row, ["signers"]),
  };
}

export type SupabaseVendor = Omit<Vendor, "perVendorCap"> & {
  /** Null means the mirror predates the explicit cap column. */
  perVendorCap: string | null;
};

const UINT256_MAX = 115792089237316195423570985008687907853269984665640564039457584007913129639935n;

export function vendorFromRow(
  row: SupabaseRow,
  wallet?: Wallet | null,
): SupabaseVendor & {
  name: string;
  kycStatus: "public" | "arcanevm";
  walletAddress: string;
} {
  const vendorAddress = stringField(row, ["vendor_address"], zeroWallet());
  const walletAddress = requireWalletAddress(wallet);
  const walletId = wallet?.id ?? stableUuid(`wallet:${walletAddress}`);

  return {
    id: stringField(row, ["id"], stableUuid(`vendor:${walletAddress}:${vendorAddress}`)),
    tenantId: stringField(row, ["tenant_id"], FALLBACK_TENANT_ID),
    walletId,
    address: vendorAddress.toLowerCase(),
    category: stringField(row, ["category"], "other"),
    status: vendorStatusFromString(stringField(row, ["status"], "allowed")),
    // Supabase stores this explicitly as USDC base units. A nullable column is
    // deliberate: rows created before the cap mirror was installed must not be
    // presented as an uncapped vendor.
    perVendorCap: vendorCapBaseUnitsFromRow(row),
    metadataHash: stringField(row, ["metadata_hash"], stableHash(`vendor:${vendorAddress}`)),
    addedAt: dateField(row, ["created_at"]),
    addedBy: wallet?.ownerAddress ?? ownerScopeFromEnv(),
    name: stringField(row, ["name", "label"], shortAddress(vendorAddress)),
    kycStatus: booleanField(row, ["confidential"], false) ? "arcanevm" : "public",
    walletAddress,
  };
}

/**
 * Read the cap mirror without guessing the unit of an older/foreign column.
 * `per_vendor_cap_base_units` is the explicitly defined Supabase storage
 * column; its numeric(78,0) value matches the canonical Drizzle schema and the
 * six-decimal USDC value returned by VendorRegistry.
 */
export function vendorCapBaseUnitsFromRow(row: SupabaseRow | undefined): string | null {
  const value = row?.per_vendor_cap_base_units;
  if (typeof value === "bigint") {
    return value >= 0n && value <= UINT256_MAX ? value.toString() : null;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    const normalized = value.trim().replace(/^0+(?=\d)/, "");
    return BigInt(normalized) <= UINT256_MAX ? normalized : null;
  }
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return String(value);
  }
  return null;
}

export function transferFromRow(row: SupabaseRow, wallets: Wallet[]): Transfer {
  const wallet = walletForRow(row, wallets);
  const walletAddress = requireWalletAddress(wallet);
  const txHash = stringField(
    row,
    ["tx_hash", "hash"],
    stableHash(`transfer:${JSON.stringify(row)}`),
  );

  return {
    id: stringField(row, ["id"], stableUuid(`transfer:${txHash}`)),
    tenantId: stringField(row, ["tenant_id"], FALLBACK_TENANT_ID),
    walletId: wallet?.id ?? stableUuid(`wallet:${walletAddress}`),
    agentId: stringField(row, ["agent_id"], null),
    txHash,
    blockNumber: numberField(row, ["block_number"], 0),
    timestamp: dateField(row, ["event_time", "created_at"]),
    toAddress: stringField(row, ["to_address", "counterparty_address"], zeroWallet()),
    amount: moneyBaseUnits(row, ["amount", "amount_usdc"]),
    verdict: verdictFromString(stringField(row, ["verdict", "status"], "ALLOW")),
    reason: stringField(row, ["decision_reason"], "indexed from Supabase"),
    vendorCategory: stringField(row, ["vendor_category", "category"], "other"),
    dailySpentAfter: moneyBaseUnits(row, ["daily_spent_after"], 0),
  };
}

export type EscalationWithWalletIdentity = Escalation & {
  /** Stable Supabase wallet row id; never use this as a contract address. */
  walletId: string;
  /** GovernedWallet contract address used as the onchain cancellation target. */
  walletAddress: string;
  /** Current owner mirror for display only; actions re-read the chain owner. */
  ownerAddress: string;
  /** Exact uint256 amount representation used for chain/display binding. */
  amountBaseUnits: string;
  counterpartyAddress: string;
};

/**
 * The canonical `escalations.amount` column is numeric(78,0) base units. Do
 * not send that column through the decimal-USDC compatibility parser: values
 * below one whole USDC are still valid base-unit amounts.
 */
export function escalationAmountBaseUnits(row: SupabaseRow) {
  const canonical = row.amount;
  if (typeof canonical === "bigint") {
    if (canonical < 0n) throw new Error("Escalation amount cannot be negative.");
    return canonical.toString();
  }
  if (typeof canonical === "number") {
    if (canonical < 0 || !Number.isFinite(canonical)) {
      throw new Error("Escalation amount cannot be represented exactly.");
    }
    if (!Number.isInteger(canonical)) {
      return moneyBaseUnits({ amount_usdc: String(canonical) }, ["amount_usdc"]);
    }
    if (!Number.isSafeInteger(canonical)) {
      throw new Error("Escalation amount cannot be represented exactly.");
    }
    return String(canonical);
  }
  if (typeof canonical === "string" && /^\d+$/.test(canonical.trim())) {
    return canonical.trim().replace(/^0+(?=\d)/, "");
  }
  if (typeof canonical === "string" && /^(0|[1-9]\d*)(\.\d{1,6})?$/.test(canonical.trim())) {
    return moneyBaseUnits({ amount_usdc: canonical.trim() }, ["amount_usdc"]);
  }
  return moneyBaseUnits(row, ["amount_usdc"], "0");
}

export function escalationFromRow(
  row: SupabaseRow,
  wallets: Wallet[],
): EscalationWithWalletIdentity {
  const wallet = walletForRow(row, wallets);
  const walletAddress = requireWalletAddress(wallet);
  // The dashboard and the public approver portal both call the escalation
  // manager with this id, so it must be the onchain escalation key. Falling
  // back to the Supabase UUID leaves approve/reject permanently disabled.
  const id = stringField(
    row,
    ["escalation_key", "tx_hash", "id"],
    stableHash(`escalation:${JSON.stringify(row)}`),
  );

  const amountBaseUnits = escalationAmountBaseUnits(row);
  const counterpartyAddress = stringField(
    row,
    ["to_address", "counterparty_address"],
    zeroWallet(),
  );

  return {
    id,
    tenantId: stringField(row, ["tenant_id"], FALLBACK_TENANT_ID),
    walletId: wallet?.id ?? stableUuid(`wallet:${walletAddress}`),
    walletAddress,
    ownerAddress: wallet?.ownerAddress ?? ownerScopeFromEnv(),
    transferId: stringField(row, ["ledger_event_id"], null),
    toAddress: counterpartyAddress,
    counterpartyAddress,
    amount: amountBaseUnits,
    amountBaseUnits,
    reason: stringField(row, ["reason"], "Supabase escalation"),
    createdAt: dateField(row, ["created_at"]),
    expiresAt: dateField(row, ["expires_at"], new Date(Date.now() + 30 * 60_000)),
    status: escalationStatusFromString(stringField(row, ["status"], "pending")),
    signaturesCount: numberField(row, ["approvals_count"], 0),
    threshold: numberField(row, ["quorum_required"], 1),
    signers: arrayField(row, ["signers"]),
    executedTxHash: stringField(row, ["release_tx_hash", "deny_tx_hash"], null),
  };
}

export function anomalyFromRow(row: SupabaseRow, wallets: Wallet[]): Anomaly {
  const wallet = walletForRow(row, wallets);
  const walletAddress = requireWalletAddress(wallet);

  return {
    id: stringField(row, ["id"], stableUuid(`anomaly:${JSON.stringify(row)}`)),
    tenantId: stringField(row, ["tenant_id"], FALLBACK_TENANT_ID),
    walletId: wallet?.id ?? stableUuid(`wallet:${walletAddress}`),
    agentId: stringField(row, ["agent_id"], null),
    sigma: String(numberField(row, ["score"], 0)),
    reason: stringField(row, ["description", "title"], "Supabase anomaly"),
    blockNumber: numberField(row, ["block_number"], 0),
    txHash: stringField(row, ["tx_hash"], null),
    severity: anomalySeverityFromString(stringField(row, ["severity"], "low")),
    createdAt: dateField(row, ["detected_at", "created_at"]),
  };
}

export function publicProfileFromRow(
  row: SupabaseRow,
  source: SupabasePublicWalletProfile["dataSource"],
): SupabasePublicWalletProfile {
  const walletAddress = stringField(row, ["wallet_address", "address"], zeroWallet());

  return {
    walletAddress,
    label: stringField(row, ["label", "name"], shortAddress(walletAddress)),
    postureScore: numberOrNull(row, ["posture_score", "posture", "score"]),
    state: stringField(row, ["status", "state", "health_grade"], "PENDING INDEXER"),
    spend: stringField(row, ["total_spend", "spend"], null),
    threatsBlocked: numberOrNull(row, ["threats_blocked", "blocked"]),
    governedDays: numberOrNull(row, ["governed_days", "days_under_governance"]),
    dataSource: stringField(
      row,
      ["data_source"],
      source,
    ) as SupabasePublicWalletProfile["dataSource"],
  };
}

export function agentTypeFromLabel(label: string): Agent["type"] {
  const normalized = label.toLowerCase();
  if (normalized.includes("research")) {
    return "research";
  }
  if (normalized.includes("marketing")) {
    return "marketing";
  }
  if (normalized.includes("treasury")) {
    return "treasury";
  }
  if (normalized.includes("support")) {
    return "support";
  }
  if (normalized.includes("dev")) {
    return "dev";
  }

  return "other";
}

export function vendorStatusFromString(value: string): Vendor["status"] {
  const normalized = value.toLowerCase();
  if (normalized === "blocked" || normalized === "removed") {
    return normalized;
  }

  return "allowed";
}

export function verdictFromString(value: string): Transfer["verdict"] {
  const normalized = value.toLowerCase();
  if (
    normalized === "deny" ||
    normalized === "denied" ||
    normalized === "blocked" ||
    normalized === "rejected"
  ) {
    return "DENY";
  }
  if (normalized === "escalate" || normalized === "escalated") {
    return "ESCALATE";
  }
  if (normalized === "freeze" || normalized === "frozen") {
    return "FREEZE";
  }

  return "ALLOW";
}

export function escalationStatusFromString(value: string): Escalation["status"] {
  const normalized = value.toLowerCase();
  if (normalized === "approved" || normalized === "executed" || normalized === "released") {
    return "EXECUTED";
  }
  if (normalized === "rejected") {
    return "REJECTED";
  }
  if (normalized === "expired") {
    return "EXPIRED";
  }
  if (normalized === "denied") {
    return "DENIED";
  }
  if (normalized === "cancelled") {
    return "CANCELLED";
  }
  if (normalized === "invalidated") {
    return "INVALIDATED";
  }

  return "PENDING";
}

export function anomalySeverityFromString(value: string): Anomaly["severity"] {
  const normalized = value.toLowerCase();
  if (normalized === "critical" || normalized === "high" || normalized === "danger") {
    return "danger";
  }
  if (normalized === "medium" || normalized === "warning") {
    return "warning";
  }

  return "info";
}

/** Bit positions of RestraintCategory in the onchain policy bitmask. */
const CATEGORY_BITS: Record<string, number> = {
  api: 1,
  compute: 2,
  data: 4,
  subcontracting: 8,
  other: 16,
};

const ALL_CATEGORIES_MASK = 31;

/**
 * Inverse of allowedCategoryMask: turn the bitmask the wallet enforces back
 * into the category names the read model stores.
 */
export function categoryNamesFromMask(mask: number): string[] {
  return Object.entries(CATEGORY_BITS)
    .filter(([, bit]) => (mask & bit) !== 0)
    .map(([name]) => name);
}

/** VendorRegistry category enum order, mirrored from the contract. */
const VENDOR_CATEGORY_ORDER = ["api", "compute", "data", "subcontracting", "other"] as const;

export function vendorCategoryFromIndex(index: number): string {
  return VENDOR_CATEGORY_ORDER[index] ?? "other";
}

export function allowedCategoryMask(row: SupabaseRow) {
  const categories = arrayField(row, ["allowed_categories"]);
  if (categories.length === 0) {
    return ALL_CATEGORIES_MASK;
  }

  return categories.reduce(
    (mask, category) => mask | (CATEGORY_BITS[category.trim().toLowerCase()] ?? 0),
    0,
  );
}

export function zeroWallet() {
  return "0x0000000000000000000000000000000000000000";
}

export function requireWalletAddress(wallet: Wallet | null | undefined) {
  if (!wallet) {
    throw new Error("Read-model row references a wallet outside the workspace read model");
  }

  return wallet.address;
}

export function ownerScopeFromEnv() {
  const owner = process.env.ARCANUM_DEMO_OWNER_WALLET?.toLowerCase();
  if (!owner) {
    throw new Error("ARCANUM_DEMO_OWNER_WALLET is not set");
  }

  return owner;
}
