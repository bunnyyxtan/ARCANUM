import type { Category, LedgerEntry, LedgerStatus } from "@/lib/types";

const hashFor = (index: number) =>
  `0x${(BigInt("0x5042002000000000000000000000000000000000000000000000000000000000") + BigInt(index)).toString(16)}`;

const baseLedger: LedgerEntry[] = [
  {
    id: "tx-001",
    agentId: "research-agent",
    agentName: "Research Agent",
    counterparty: "OpenAI",
    category: "api",
    action: "inference call",
    amount: 4.2,
    status: "approved",
    reason: "Within API cap and vendor whitelist.",
    timestamp: "02:51:02Z",
    hash: hashFor(1),
    block: 5_042_118,
    gasUsed: "0.00042 USDC",
    calldata: "0xa9059cbb0000000000000000000000000a1129ec4a6ef8245e52fe1a0000000000000ai0",
  },
  {
    id: "tx-002",
    agentId: "treasury-rebalancer",
    agentName: "TreasuryRebalancer",
    counterparty: "Internal Vault",
    category: "other",
    action: "rebalance xfer",
    amount: 1247,
    status: "approved",
    reason: "Internal safe movement under treasury doctrine.",
    timestamp: "02:50:44Z",
    hash: hashFor(2),
    block: 5_042_117,
    gasUsed: "0.00038 USDC",
    calldata: "0x23b872dd000000000000000000000000helix000000000000000000000000000000f1a9",
  },
  {
    id: "tx-003",
    agentId: "treasury-guard-agent",
    agentName: "Treasury Guard Agent",
    counterparty: "Unapproved treasury endpoint",
    category: "other",
    action: "treasury request",
    amount: 500,
    status: "rejected",
    reason: "Counterparty blocked; wallet was frozen after a 7.4 deviation.",
    timestamp: "02:49:58Z",
    hash: hashFor(3),
    block: 5_042_116,
    gasUsed: "0.00000 USDC",
    calldata: "0xdeadbeef000000000000000000000000bad0d47a8b0c0000000000000000000000000bad",
  },
  {
    id: "tx-004",
    agentId: "cloud-ops-agent",
    agentName: "Cloud Ops Agent",
    counterparty: "AWS Bedrock",
    category: "compute",
    action: "gpu lease",
    amount: 96.2,
    status: "escalated",
    reason: "Compute request exceeds the per-transaction threshold; awaiting one approver.",
    timestamp: "02:49:12Z",
    hash: hashFor(4),
    block: 5_042_115,
    gasUsed: "0.00012 USDC",
    calldata: "0xa9059cbb000000000000000000000000b3dr0cc9a13c74d9926200000000000000000ck0",
  },
  {
    id: "tx-005",
    agentId: "treasury-guard-agent",
    agentName: "Treasury Guard Agent",
    counterparty: "Anthropic",
    category: "api",
    action: "model call",
    amount: 312,
    status: "frozen",
    reason: "Wallet already restrained; transaction held until doctrine review.",
    timestamp: "02:47:55Z",
    hash: hashFor(5),
    block: 5_042_114,
    gasUsed: "0.00000 USDC",
    calldata: "0xf00dbabe000000000000000000000000a17h09b3f31715f6f104f56f00000000000r0p1",
  },
  {
    id: "tx-006",
    agentId: "marketing-agent",
    agentName: "MarketingAgent",
    counterparty: "Tavily",
    category: "data",
    action: "search api",
    amount: 2.1,
    status: "approved",
    reason: "Whitelisted vendor and campaign research category.",
    timestamp: "02:48:30Z",
    hash: hashFor(6),
    block: 5_042_113,
    gasUsed: "0.00031 USDC",
    calldata: "0xa9059cbb0000000000000000000000007av1a2427d88f99e100000000000000000001y00",
  },
  {
    id: "tx-007",
    agentId: "support-agent",
    agentName: "SupportAgent",
    counterparty: "Anthropic",
    category: "api",
    action: "inference call",
    amount: 0.8,
    status: "approved",
    reason: "Within support response doctrine.",
    timestamp: "02:47:03Z",
    hash: hashFor(7),
    block: 5_042_112,
    gasUsed: "0.00028 USDC",
    calldata: "0xa9059cbb000000000000000000000000a17h09b3f31715f6f104f56f00000000000r0p1",
  },
  {
    id: "tx-008",
    agentId: "research-agent",
    agentName: "Research Agent",
    counterparty: "Pinecone",
    category: "compute",
    action: "embeddings",
    amount: 1.9,
    status: "approved",
    reason: "Confidential compute vendor approved by quorum.",
    timestamp: "02:46:21Z",
    hash: hashFor(8),
    block: 5_042_111,
    gasUsed: "0.00035 USDC",
    calldata: "0xa9059cbb000000000000000000000000p1nec0a18f37c4a220000000000000000000000e",
  },
];

const agents = [
  ["ops-runner", "OpsRunner"],
  ["compliance-agent", "ComplianceAgent"],
  ["vendor-pay", "VendorPay"],
  ["infra-agent", "InfraAgent"],
  ["legal-agent", "LegalAgent"],
  ["audit-agent", "AuditAgent"],
] as const;

const counterparties = [
  "OpenAI",
  "Anthropic",
  "AWS Bedrock",
  "Tavily",
  "Pinecone",
  "Cloudflare",
  "Stripe",
  "Cohere",
] as const;

const categories: readonly Category[] = ["api", "compute", "data", "subcontracting", "other"];
const statuses: readonly LedgerStatus[] = [
  "approved",
  "approved",
  "approved",
  "escalated",
  "rejected",
];
const actions = [
  "policy check",
  "inference call",
  "vendor sync",
  "invoice settle",
  "retrieval query",
  "cloud task",
] as const;

const generatedLedger: LedgerEntry[] = Array.from({ length: 41 }, (_, index) => {
  const serial = index + 9;
  const agent = agents[index % agents.length] ?? agents[0];
  const counterparty = counterparties[index % counterparties.length] ?? counterparties[0];
  const category = categories[index % categories.length] ?? "api";
  const status = statuses[index % statuses.length] ?? "approved";
  const action = actions[index % actions.length] ?? "policy check";
  const minute = Math.max(5, 46 - index);

  return {
    id: `tx-${serial.toString().padStart(3, "0")}`,
    agentId: agent[0],
    agentName: agent[1],
    counterparty,
    category,
    action,
    amount: Number((3.75 + ((index * 17) % 340) + (index % 4) * 0.42).toFixed(2)),
    status,
    reason:
      status === "approved"
        ? "Doctrine allowed transaction after category, vendor, and daily-limit checks."
        : status === "escalated"
          ? "Transaction requires quorum because the burst envelope is elevated."
          : "Transaction rejected by the counterparty and category policy.",
    timestamp: `02:${minute.toString().padStart(2, "0")}:${((index * 7) % 60).toString().padStart(2, "0")}Z`,
    hash: hashFor(serial),
    block: 5_042_110 - index,
    gasUsed: `${(0.00022 + index * 0.00001).toFixed(5)} USDC`,
    calldata: `0xa9059cbb${serial.toString(16).padStart(64, "0")}`,
  };
});

export const ledger: LedgerEntry[] = [...baseLedger, ...generatedLedger];
