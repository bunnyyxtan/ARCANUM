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
    ownerAddress: stringField(row, ["owner_address"], ownerScopeFromEnv()),
    createdBlock: numberField(row, ["created_block", "block_number"], 0),
    createdAt: dateField(row, ["created_at", "deployed_at"]),
    factoryAddress: stringField(
      row,
      ["wallet_factory_address"],
      process.env.NEXT_PUBLIC_WALLET_FACTORY ?? zeroWallet(),
    ),
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
    monthlyRollingCap: moneyBaseUnits(doctrine, ["monthly_cap_usdc"]),
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
    monthlyRollingCap: moneyBaseUnits(row, ["monthly_cap_usdc"]),
    allowedCategories: allowedCategoryMask(row),
    escalationThreshold: moneyBaseUnits(row, ["escalate_above_usdc"]),
    requireAllowlist: booleanField(row, ["require_vendor_allowlist"], true),
    updatedAt: dateField(row, ["updated_at"]),
    updatedBy: wallet.ownerAddress,
    doctrineStatus: stringField(row, ["status"], "active"),
    signers: arrayField(row, ["signers"]),
  };
}

export function vendorFromRow(
  row: SupabaseRow,
  wallet?: Wallet | null,
): Vendor & {
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
    perVendorCap: "0",
    metadataHash: stringField(row, ["metadata_hash"], stableHash(`vendor:${vendorAddress}`)),
    addedAt: dateField(row, ["created_at"]),
    addedBy: wallet?.ownerAddress ?? ownerScopeFromEnv(),
    name: stringField(row, ["name", "label"], shortAddress(vendorAddress)),
    kycStatus: booleanField(row, ["confidential"], false) ? "arcanevm" : "public",
    walletAddress,
  };
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

export function escalationFromRow(row: SupabaseRow, wallets: Wallet[]): Escalation {
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

  return {
    id,
    tenantId: stringField(row, ["tenant_id"], FALLBACK_TENANT_ID),
    walletId: wallet?.id ?? stableUuid(`wallet:${walletAddress}`),
    transferId: stringField(row, ["ledger_event_id"], null),
    toAddress: stringField(row, ["to_address", "counterparty_address"], zeroWallet()),
    amount: moneyBaseUnits(row, ["amount", "amount_usdc"]),
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
  if (value === "blocked" || value === "removed") {
    return value;
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
  if (normalized === "executed" || normalized === "released" || normalized === "approved") {
    return "EXECUTED";
  }
  if (normalized === "rejected" || normalized === "denied") {
    return "REJECTED";
  }
  if (normalized === "expired") {
    return "EXPIRED";
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
