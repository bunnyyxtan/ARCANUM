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

export const demoMetrics = {
  activeAgents: 4,
  pendingEscalations: 1,
  postureIndex: 94,
  threatsBlocked30d: 3,
  valueGoverned: "48200000000",
} as const;

export const demoSignerAddresses = [
  "0x7c22f17824442cbf62faa81f1790d34c311fa81f",
  "0x2c92d63f66c98bca0dd33159b43c18cb5a2b20c1",
  "0x55207c090418cb56cb909d3c58c76be0d2f5b777",
  "0xaa90bddd0e3f431b72caa77c8cbb00e52e0f1c42",
  "0x021a68f900e06351ca8c4b2922c91f7e508b0a09",
] as const;

export const fallbackWallets = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    label: "Research Agent",
    address: "0x4f8c39a7d2b1e84f3af20a91ddb83a7b7a4ea3b7",
    ownerAddress: DEFAULT_ARCANUM_DEMO_OWNER_WALLET,
    frozen: false,
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    label: "Cloud Ops Agent",
    address: "0xa12e00000000000000000000000000000000d9f4",
    ownerAddress: DEFAULT_ARCANUM_DEMO_OWNER_WALLET,
    frozen: false,
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    label: "Market Intel Agent",
    address: "0xc74b00000000000000000000000000000000e2a8",
    ownerAddress: DEFAULT_ARCANUM_DEMO_OWNER_WALLET,
    frozen: false,
  },
  {
    id: "20000000-0000-4000-8000-000000000004",
    label: "Treasury Guard Agent",
    address: "0x8e3d00000000000000000000000000000000f5c1",
    ownerAddress: DEFAULT_ARCANUM_DEMO_OWNER_WALLET,
    frozen: true,
  },
  {
    id: "20000000-0000-4000-8000-000000000005",
    label: "Security Monitor Agent",
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

function demoTxHash(index: number) {
  return `0x${index.toString(16).padStart(64, "a")}`;
}

export const fallbackAgents: Agent[] = [
  agent("30000000-0000-4000-8000-000000000001", 0, "research", "Research Agent", "active", 79),
  agent("30000000-0000-4000-8000-000000000002", 1, "dev", "Cloud Ops Agent", "active", 116),
  agent("30000000-0000-4000-8000-000000000003", 2, "marketing", "Market Intel Agent", "active", 169),
  agent(
    "30000000-0000-4000-8000-000000000004",
    3,
    "treasury",
    "Treasury Guard Agent",
    "frozen",
    0,
  ),
  agent(
    "30000000-0000-4000-8000-000000000005",
    4,
    "support",
    "Security Monitor Agent",
    "active",
    43,
  ),
];

export const fallbackVendors: Array<Vendor & { name: string; kycStatus: "public" | "arcanevm" }> = [
  vendor(
    "40000000-0000-4000-8000-000000000001",
    "OpenAI",
    "0x71c700000000000000000000000000000000fe19",
    "api",
    "public",
    140,
  ),
  vendor(
    "40000000-0000-4000-8000-000000000002",
    "Anthropic",
    "0x4a2b000000000000000000000000000000008c0d",
    "api",
    "public",
    76,
  ),
  vendor(
    "40000000-0000-4000-8000-000000000003",
    "AWS Bedrock",
    "0x9dd400000000000000000000000000000000b71a",
    "compute",
    "arcanevm",
    54,
  ),
  vendor(
    "40000000-0000-4000-8000-000000000004",
    "Cloudflare",
    "0x88e10000000000000000000000000000000007bb",
    "other",
    "public",
    31,
  ),
  vendor(
    "40000000-0000-4000-8000-000000000005",
    "Perplexity",
    "0x3f1900000000000000000000000000000000aa52",
    "data",
    "public",
    107,
  ),
  vendor(
    "40000000-0000-4000-8000-000000000006",
    "Stripe Treasury Sandbox",
    "0x1234000000000000000000000000000000005678",
    "other",
    "public",
    0,
  ),
  vendor(
    "40000000-0000-4000-8000-000000000007",
    "Vercel AI Gateway",
    "0x77fa0000000000000000000000000000000012dd",
    "compute",
    "public",
    164,
  ),
];

const policyInputs = [
  ["150000000", "750000000", "12000000000", "150000000"],
  ["75000000", "1200000000", "18000000000", "75000000"],
  ["100000000", "600000000", "9000000000", "100000000"],
  ["250000000", "1500000000", "24000000000", "250000000"],
  ["50000000", "300000000", "6000000000", "50000000"],
] as const;

export const fallbackPolicies: Array<Policy & { doctrineStatus: string; signers: string[] }> =
  fallbackWallets.map((wallet, index) => {
    const [perTxCap, daily24hCap, monthlyRollingCap, escalationThreshold] =
      requiredFixtureItem(policyInputs, index, "policy");
    return {
      id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      tenantId: FALLBACK_TENANT_ID,
      walletId: wallet.id,
      version: 4,
      perTxCap,
      daily24hCap,
      monthlyRollingCap,
      allowedCategories: 0b11111,
      escalationThreshold,
      requireAllowlist: true,
      updatedAt: minutesAgo(index + 20),
      updatedBy: DEFAULT_ARCANUM_DEMO_OWNER_WALLET,
      doctrineStatus: "active",
      signers: [requiredFixtureItem(demoSignerAddresses, index, "signer")],
    };
  });

export const fallbackTransfers: Transfer[] = [
  transfer(1, 3, 0, "0x1234000000000000000000000000000000005678", "500000000", "DENY", "Unapproved treasury destination blocked by allowlist.", "other", "0"),
  transfer(2, 4, 31, "0x88e10000000000000000000000000000000007bb", "12000000", "ALLOW", "Approved security service within policy envelope.", "other", "12000000"),
  transfer(3, 1, 54, "0x9dd400000000000000000000000000000000b71a", "96200000", "ESCALATE", "Compute request exceeds the per-transaction threshold.", "compute", "128300000"),
  transfer(4, 0, 76, "0x4a2b000000000000000000000000000000008c0d", "64800000", "ALLOW", "Approved model provider within research policy.", "api", "126150000"),
  transfer(5, 2, 107, "0x3f1900000000000000000000000000000000aa52", "42750000", "ALLOW", "Approved data provider within market-intelligence policy.", "data", "107750000"),
  transfer(6, 0, 140, "0x71c700000000000000000000000000000000fe19", "18400000", "ALLOW", "Approved model provider within research policy.", "api", "61350000"),
  transfer(7, 1, 164, "0x77fa0000000000000000000000000000000012dd", "128300000", "ALLOW", "Approved infrastructure provider within cloud-ops policy.", "compute", "128300000"),
  transfer(8, 4, 187, "0x88e10000000000000000000000000000000007bb", "12000000", "ALLOW", "Approved security service within policy envelope.", "other", "24000000"),
  transfer(9, 0, 211, "0x71c700000000000000000000000000000000fe19", "42950000", "ALLOW", "Approved model provider within research policy.", "api", "104300000"),
  transfer(10, 2, 231, "0x3f1900000000000000000000000000000000aa52", "65000000", "ALLOW", "Approved data provider within market-intelligence policy.", "data", "107750000"),
];

export const fallbackEscalations: Escalation[] = [
  {
    id: "0xeeee000000000000000000000000000000000000000000000000000000000001",
    tenantId: FALLBACK_TENANT_ID,
    walletId: requiredFixtureItem(fallbackWallets, 1, "wallet").id,
    transferId: requiredFixtureItem(fallbackTransfers, 2, "transfer").id,
    toAddress: "0x9dd400000000000000000000000000000000b71a",
    amount: "96200000",
    reason: "Compute request exceeds the per-transaction threshold. Held for human approval.",
    createdAt: minutesAgo(54),
    expiresAt: minutesAhead(42),
    status: "PENDING",
    signaturesCount: 1,
    threshold: 2,
    signers: [DEFAULT_ARCANUM_DEMO_OWNER_WALLET],
    executedTxHash: null,
  },
];

export const fallbackAnomalies: Anomaly[] = [
  {
    id: "70000000-0000-4000-8000-000000000001",
    tenantId: FALLBACK_TENANT_ID,
    walletId: requiredFixtureItem(fallbackWallets, 3, "wallet").id,
    agentId: requiredFixtureItem(fallbackAgents, 3, "agent").id,
    sigma: "4.8000",
    reason:
      "Treasury Guard Agent targeted an unapproved treasury destination and was restrained before execution.",
    blockNumber: 5_042_118,
    txHash: requiredFixtureItem(fallbackTransfers, 0, "transfer").txHash,
    severity: "danger",
    createdAt: minutesAgo(0),
  },
  {
    id: "70000000-0000-4000-8000-000000000002",
    tenantId: FALLBACK_TENANT_ID,
    walletId: requiredFixtureItem(fallbackWallets, 1, "wallet").id,
    agentId: requiredFixtureItem(fallbackAgents, 1, "agent").id,
    sigma: "1.8000",
    reason:
      "Cloud Ops Agent crossed the compute soft threshold during a deployment window; payment escalated before execution.",
    blockNumber: 5_042_116,
    txHash: requiredFixtureItem(fallbackTransfers, 2, "transfer").txHash,
    severity: "warning",
    createdAt: minutesAgo(54),
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
  member("90000000-0000-4000-8000-000000000001", DEFAULT_ARCANUM_DEMO_OWNER_WALLET, "Maya Rao", "owner", 120),
  member("90000000-0000-4000-8000-000000000002", "0x2c92d63f66c98bca0dd33159b43c18cb5a2b20c1", "Elias Chen", "approver", 80),
  member("90000000-0000-4000-8000-000000000003", "0x55207c090418cb56cb909d3c58c76be0d2f5b777", "Nora Patel", "approver", 55),
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
    createdBlock: 5_041_000 + index,
    createdAt: minutesAgo(2_880 + index),
    factoryAddress: "0xfac7000000000000000000000000000000000000",
    frozen: item.frozen,
    policyVersion: 4,
  };
}

export const fallbackWalletRows: Wallet[] = fallbackWallets.map((_, index) => wallet(index));

function agent(
  id: string,
  walletIndex: number,
  type: Agent["type"],
  label: string,
  status: Agent["status"],
  lastSeenMinutesAgo: number,
): Agent {
  const wallet = requiredFixtureItem(fallbackWallets, walletIndex, "wallet");
  return {
    id,
    tenantId: FALLBACK_TENANT_ID,
    walletId: wallet.id,
    signerAddress: requiredFixtureItem(demoSignerAddresses, walletIndex, "signer"),
    label,
    type,
    createdAt: minutesAgo(4_320 + walletIndex),
    lastSeenAt: minutesAgo(lastSeenMinutesAgo),
    status,
  };
}

function vendor(
  id: string,
  name: string,
  address: string,
  category: string,
  kycStatus: "public" | "arcanevm",
  minutes: number,
): Vendor & { name: string; kycStatus: "public" | "arcanevm" } {
  return {
    id,
    tenantId: FALLBACK_TENANT_ID,
    walletId: requiredFixtureItem(fallbackWallets, 0, "wallet").id,
    address,
    category,
    status: "allowed",
    perVendorCap: kycStatus === "arcanevm" ? "150000000" : "0",
    metadataHash: `0x${id.replaceAll("-", "").padEnd(64, "0").slice(0, 64)}`,
    addedAt: minutesAgo(minutes),
    addedBy: DEFAULT_ARCANUM_DEMO_OWNER_WALLET,
    name,
    kycStatus,
  };
}

function transfer(
  index: number,
  walletIndex: number,
  minutes: number,
  toAddress: string,
  amount: string,
  verdict: Transfer["verdict"],
  reason: string,
  vendorCategory: string,
  dailySpentAfter: string,
): Transfer {
  return {
    id: `60000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    tenantId: FALLBACK_TENANT_ID,
    walletId: requiredFixtureItem(fallbackWallets, walletIndex, "wallet").id,
    agentId: requiredFixtureItem(fallbackAgents, walletIndex, "agent").id,
    txHash: demoTxHash(index),
    blockNumber: 5_042_119 - index,
    timestamp: minutesAgo(minutes),
    toAddress,
    amount,
    verdict,
    reason,
    vendorCategory,
    dailySpentAfter,
  };
}

function member(
  id: string,
  walletAddress: string,
  displayName: string,
  role: User["role"],
  minutes: number,
): User {
  return {
    id,
    tenantId: FALLBACK_TENANT_ID,
    walletAddress,
    displayName,
    role,
    createdAt: minutesAgo(minutes),
  };
}
