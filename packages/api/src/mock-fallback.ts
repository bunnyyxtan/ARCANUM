import { FALLBACK_TENANT_ID } from "@arcanum/db";
import type {
  Agent,
  Anomaly,
  Escalation,
  Event,
  Policy,
  Transfer,
  User,
  Vendor,
  Wallet,
} from "@arcanum/db/schema";
import { DEFAULT_ARCANUM_DEMO_OWNER_WALLET } from "@arcanum/shared";

export const fallbackOrgId = "10000000-0000-4000-8000-000000000001";

export const fallbackWallets = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    label: "ResearchAgent",
    address: "0x4f8c39a7d2b1e84f3af20a91ddb83a7b7a4ea3b7",
    ownerAddress: DEFAULT_ARCANUM_DEMO_OWNER_WALLET,
    frozen: false,
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    label: "MarketingAgent",
    address: "0xa12e00000000000000000000000000000000d9f4",
    ownerAddress: DEFAULT_ARCANUM_DEMO_OWNER_WALLET,
    frozen: false,
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    label: "DevAgent-01",
    address: "0xc74b00000000000000000000000000000000e2a8",
    ownerAddress: DEFAULT_ARCANUM_DEMO_OWNER_WALLET,
    frozen: true,
  },
  {
    id: "20000000-0000-4000-8000-000000000004",
    label: "TreasuryRebalancer",
    address: "0x8e3d00000000000000000000000000000000f5c1",
    ownerAddress: DEFAULT_ARCANUM_DEMO_OWNER_WALLET,
    frozen: false,
  },
  {
    id: "20000000-0000-4000-8000-000000000005",
    label: "CustomerSupportAgent",
    address: "0x2b9100000000000000000000000000000000a7e3",
    ownerAddress: DEFAULT_ARCANUM_DEMO_OWNER_WALLET,
    frozen: false,
  },
] as const;

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);
const minutesAhead = (minutes: number) => new Date(Date.now() + minutes * 60_000);

function requiredFixtureItem<T>(items: readonly T[], index: number, label: string): T {
  const item = items[index];
  if (!item) {
    throw new Error(`Missing ${label} fixture at index ${index}`);
  }

  return item;
}

export const fallbackAgents: Agent[] = [
  agent(
    "30000000-0000-4000-8000-000000000001",
    0,
    "research",
    "ResearchAgent",
    "active",
    minutesAgo(0),
  ),
  agent(
    "30000000-0000-4000-8000-000000000002",
    1,
    "marketing",
    "MarketingAgent",
    "active",
    minutesAgo(3),
  ),
  agent("30000000-0000-4000-8000-000000000003", 2, "dev", "DevAgent-01", "frozen", minutesAgo(4)),
  agent(
    "30000000-0000-4000-8000-000000000004",
    3,
    "treasury",
    "TreasuryRebalancer",
    "active",
    minutesAgo(6),
  ),
  agent(
    "30000000-0000-4000-8000-000000000005",
    4,
    "support",
    "CustomerSupportAgent",
    "active",
    minutesAgo(1),
  ),
];

export const fallbackVendors: Array<Vendor & { name: string; kycStatus: "public" | "arcanevm" }> = [
  vendor(
    "40000000-0000-4000-8000-000000000001",
    0,
    "OpenAI",
    "0x71c700000000000000000000000000000000fe19",
    "api",
    "arcanevm",
    12,
  ),
  vendor(
    "40000000-0000-4000-8000-000000000002",
    0,
    "Anthropic",
    "0x4a2b000000000000000000000000000000008c0d",
    "api",
    "arcanevm",
    44,
  ),
  vendor(
    "40000000-0000-4000-8000-000000000003",
    0,
    "Tavily",
    "0x3f1900000000000000000000000000000000aa52",
    "data",
    "public",
    5,
  ),
  vendor(
    "40000000-0000-4000-8000-000000000004",
    0,
    "GitHub",
    "0xab0900000000000000000000000000000000cd44",
    "subcontracting",
    "public",
    120,
  ),
  vendor(
    "40000000-0000-4000-8000-000000000005",
    0,
    "AWS Bedrock",
    "0x9dd400000000000000000000000000000000b71a",
    "compute",
    "arcanevm",
    2,
  ),
  vendor(
    "40000000-0000-4000-8000-000000000006",
    0,
    "Cloudflare",
    "0x88e10000000000000000000000000000000007bb",
    "compute",
    "public",
    31,
  ),
  vendor(
    "40000000-0000-4000-8000-000000000007",
    0,
    "Vercel",
    "0x77fa0000000000000000000000000000000012dd",
    "compute",
    "public",
    180,
  ),
  vendor(
    "40000000-0000-4000-8000-000000000008",
    0,
    "Pinecone",
    "0x6b880000000000000000000000000000000014ec",
    "compute",
    "arcanevm",
    8,
  ),
  vendor(
    "40000000-0000-4000-8000-000000000009",
    0,
    "Cohere",
    "0x22ad000000000000000000000000000000009f31",
    "api",
    "public",
    15,
  ),
  vendor(
    "40000000-0000-4000-8000-000000000010",
    0,
    "Stripe",
    "0x1234000000000000000000000000000000005678",
    "other",
    "public",
    60,
  ),
];

export const fallbackPolicies: Policy[] = fallbackWallets.map((wallet, index) => ({
  id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  tenantId: FALLBACK_TENANT_ID,
  walletId: wallet.id,
  version: 1,
  perTxCap: "50000000",
  daily24hCap: index === 3 ? "5000000000" : "500000000",
  monthlyRollingCap: "15000000000",
  allowedCategories: 0b11111,
  escalationThreshold: "100000000",
  requireAllowlist: true,
  updatedAt: minutesAgo(index),
  updatedBy: DEFAULT_ARCANUM_DEMO_OWNER_WALLET,
}));

export const fallbackTransfers: Transfer[] = [
  transfer(
    "60000000-0000-4000-8000-000000000001",
    0,
    "0xaaa1000000000000000000000000000000000000000000000000000000000001",
    5042118,
    0,
    "0x71c700000000000000000000000000000000fe19",
    "4200000",
    "ALLOW",
    "within all caps",
    "api",
    "4200000",
  ),
  transfer(
    "60000000-0000-4000-8000-000000000002",
    3,
    "0xaaa1000000000000000000000000000000000000000000000000000000002",
    5042117,
    1,
    "0x1234000000000000000000000000000000005678",
    "1247000000",
    "ALLOW",
    "treasury rebalance approved",
    "other",
    "1247000000",
  ),
  transfer(
    "60000000-0000-4000-8000-000000000003",
    2,
    "0xaaa1000000000000000000000000000000000000000000000000000000003",
    5042061,
    2,
    "0xe11d00000000000000000000000000000000da7a",
    "847000000",
    "DENY",
    "vendor not on allowlist",
    "data",
    "0",
  ),
  transfer(
    "60000000-0000-4000-8000-000000000004",
    0,
    "0xaaa1000000000000000000000000000000000000000000000000000000004",
    5042060,
    3,
    "0x9dd400000000000000000000000000000000b71a",
    "73420000",
    "ESCALATE",
    "exceeds per-vendor daily limit",
    "compute",
    "342000000",
  ),
  transfer(
    "60000000-0000-4000-8000-000000000005",
    2,
    "0xaaa1000000000000000000000000000000000000000000000000000000005",
    5042059,
    4,
    "0x4a2b000000000000000000000000000000008c0d",
    "312000000",
    "FREEZE",
    "agent frozen by anomaly oracle",
    "api",
    "0",
  ),
  transfer(
    "60000000-0000-4000-8000-000000000006",
    1,
    "0xaaa1000000000000000000000000000000000000000000000000000000006",
    5042058,
    5,
    "0x3f1900000000000000000000000000000000aa52",
    "2100000",
    "ALLOW",
    "within all caps",
    "data",
    "89000000",
  ),
  transfer(
    "60000000-0000-4000-8000-000000000007",
    4,
    "0xaaa1000000000000000000000000000000000000000000000000000000007",
    5042057,
    6,
    "0x4a2b000000000000000000000000000000008c0d",
    "800000",
    "ALLOW",
    "within all caps",
    "api",
    "34000000",
  ),
  transfer(
    "60000000-0000-4000-8000-000000000008",
    0,
    "0xaaa1000000000000000000000000000000000000000000000000000000008",
    5042056,
    7,
    "0x6b880000000000000000000000000000000014ec",
    "1900000",
    "ALLOW",
    "within all caps",
    "compute",
    "343900000",
  ),
  transfer(
    "60000000-0000-4000-8000-000000000009",
    1,
    "0xaaa1000000000000000000000000000000000000000000000000000000009",
    5042055,
    8,
    "0x22ad000000000000000000000000000000009f31",
    "1400000",
    "ALLOW",
    "within all caps",
    "api",
    "90400000",
  ),
];

export const fallbackEscalations: Escalation[] = [
  {
    id: "0xeeee000000000000000000000000000000000000000000000000000000000001",
    tenantId: FALLBACK_TENANT_ID,
    walletId: requiredFixtureItem(fallbackWallets, 0, "wallet").id,
    transferId: requiredFixtureItem(fallbackTransfers, 3, "transfer").id,
    toAddress: "0x9dd400000000000000000000000000000000b71a",
    amount: "73420000",
    reason: "Exceeds per-vendor daily limit ($50.00). Held for approver review.",
    createdAt: minutesAgo(0),
    expiresAt: minutesAhead(42),
    status: "PENDING",
    signaturesCount: 1,
    threshold: 2,
    signers: [DEFAULT_ARCANUM_DEMO_OWNER_WALLET],
    executedTxHash: null,
  },
  {
    id: "0xeeee000000000000000000000000000000000000000000000000000000000002",
    tenantId: FALLBACK_TENANT_ID,
    walletId: requiredFixtureItem(fallbackWallets, 2, "wallet").id,
    transferId: requiredFixtureItem(fallbackTransfers, 2, "transfer").id,
    toAddress: "0xe11d00000000000000000000000000000000da7a",
    amount: "847000000",
    reason: "Vendor not on allowlist and 7.4 deviation triggered.",
    createdAt: minutesAgo(2),
    expiresAt: minutesAhead(3),
    status: "REJECTED",
    signaturesCount: 0,
    threshold: 2,
    signers: [],
    executedTxHash: null,
  },
];

export const fallbackAnomalies: Anomaly[] = [
  {
    id: "70000000-0000-4000-8000-000000000001",
    tenantId: FALLBACK_TENANT_ID,
    walletId: requiredFixtureItem(fallbackWallets, 2, "wallet").id,
    agentId: requiredFixtureItem(fallbackAgents, 2, "agent").id,
    sigma: "7.4000",
    reason: "DevAgent-01 attempted 47 transactions in 3 minutes to an unrecognized counterparty.",
    blockNumber: 5042061,
    txHash: requiredFixtureItem(fallbackTransfers, 2, "transfer").txHash,
    severity: "danger",
    createdAt: minutesAgo(4),
  },
];

export const fallbackEvents: Event[] = fallbackTransfers.map((item, index) => ({
  id: `80000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  tenantId: FALLBACK_TENANT_ID,
  walletId: item.walletId,
  type: item.verdict === "ALLOW" ? "TRANSFER_ALLOWED" : `TRANSFER_${item.verdict}`,
  severity:
    item.verdict === "ALLOW" ? "success" : item.verdict === "ESCALATE" ? "warning" : "danger",
  payload: {
    agentId: item.agentId,
    toAddress: item.toAddress,
    amount: item.amount,
    category: item.vendorCategory,
    reason: item.reason,
  },
  blockNumber: item.blockNumber,
  txHash: item.txHash,
  timestamp: item.timestamp,
}));

export const fallbackMembers: User[] = [
  {
    id: "90000000-0000-4000-8000-000000000001",
    tenantId: FALLBACK_TENANT_ID,
    walletAddress: DEFAULT_ARCANUM_DEMO_OWNER_WALLET,
    displayName: "Aisha Chen",
    role: "owner",
    createdAt: minutesAgo(120),
  },
];

export function walletAddressForId(walletId: string | null | undefined) {
  return fallbackWallets.find((wallet) => wallet.id === walletId)?.address ?? walletId ?? "";
}

export function agentNameForId(agentId: string | null | undefined) {
  return fallbackAgents.find((agent) => agent.id === agentId)?.label ?? "Agent";
}

export function vendorNameForAddress(address: string | null | undefined) {
  return (
    fallbackVendors.find((vendorItem) => vendorItem.address === address?.toLowerCase())?.name ??
    address ??
    ""
  );
}

function wallet(index: number): Wallet {
  const item = requiredFixtureItem(fallbackWallets, index, "wallet");
  return {
    id: item.id,
    tenantId: FALLBACK_TENANT_ID,
    orgId: fallbackOrgId,
    address: item.address,
    label: item.label,
    ownerAddress: item.ownerAddress,
    createdBlock: 5041000 + index,
    createdAt: minutesAgo(500 + index),
    factoryAddress: "0xfac7000000000000000000000000000000000000",
    frozen: item.frozen,
    policyVersion: 1,
  };
}

export const fallbackWalletRows: Wallet[] = fallbackWallets.map((_, index) => wallet(index));

function agent(
  id: string,
  walletIndex: number,
  type: Agent["type"],
  label: string,
  status: Agent["status"],
  lastSeenAt: Date,
): Agent {
  const wallet = requiredFixtureItem(fallbackWallets, walletIndex, "wallet");
  return {
    id,
    tenantId: FALLBACK_TENANT_ID,
    walletId: wallet.id,
    signerAddress: wallet.address,
    label,
    type,
    createdAt: minutesAgo(600 + walletIndex),
    lastSeenAt,
    status,
  };
}

function vendor(
  id: string,
  walletIndex: number,
  name: string,
  address: string,
  category: string,
  kycStatus: "public" | "arcanevm",
  minutes: number,
): Vendor & { name: string; kycStatus: "public" | "arcanevm" } {
  return {
    id,
    tenantId: FALLBACK_TENANT_ID,
    walletId: requiredFixtureItem(fallbackWallets, walletIndex, "wallet").id,
    address,
    category,
    status: "allowed",
    perVendorCap: kycStatus === "arcanevm" ? "100000000" : "0",
    metadataHash: `0x${id.replaceAll("-", "").padEnd(64, "0").slice(0, 64)}`,
    addedAt: minutesAgo(minutes),
    addedBy: DEFAULT_ARCANUM_DEMO_OWNER_WALLET,
    name,
    kycStatus,
  };
}

function transfer(
  id: string,
  walletIndex: number,
  txHash: string,
  blockNumber: number,
  minutes: number,
  toAddress: string,
  amount: string,
  verdict: Transfer["verdict"],
  reason: string,
  vendorCategory: string,
  dailySpentAfter: string,
): Transfer {
  return {
    id,
    tenantId: FALLBACK_TENANT_ID,
    walletId: requiredFixtureItem(fallbackWallets, walletIndex, "wallet").id,
    agentId: fallbackAgents[walletIndex]?.id ?? null,
    txHash,
    blockNumber,
    timestamp: minutesAgo(minutes),
    toAddress,
    amount,
    verdict,
    reason,
    vendorCategory,
    dailySpentAfter,
  };
}
