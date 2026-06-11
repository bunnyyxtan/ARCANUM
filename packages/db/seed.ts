import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { FALLBACK_TENANT_ID } from "./src/tenant";
import {
  agents,
  anomalies,
  escalations,
  events,
  organizations,
  policies,
  transfers,
  users,
  vendors,
  wallets,
} from "./src/schema";

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://arcanum:arcanum@localhost:5432/arcanum";
const client = postgres(databaseUrl, { prepare: false });
const db = drizzle(client);

const orgId = "10000000-0000-4000-8000-000000000001";
const admin = "0x9f4e0000000000000000000000000000000003b7";
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);
const minutesAhead = (minutes: number) => new Date(Date.now() + minutes * 60_000);

const walletSeeds = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    label: "ResearchAgent",
    address: "0x4f8c39a7d2b1e84f3af20a91ddb83a7b7a4ea3b7",
    type: "research",
    status: "active",
    frozen: false,
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    label: "MarketingAgent",
    address: "0xa12e00000000000000000000000000000000d9f4",
    type: "marketing",
    status: "active",
    frozen: false,
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    label: "DevAgent-01",
    address: "0xc74b00000000000000000000000000000000e2a8",
    type: "dev",
    status: "frozen",
    frozen: true,
  },
  {
    id: "20000000-0000-4000-8000-000000000004",
    label: "TreasuryRebalancer",
    address: "0x8e3d00000000000000000000000000000000f5c1",
    type: "treasury",
    status: "active",
    frozen: false,
  },
  {
    id: "20000000-0000-4000-8000-000000000005",
    label: "CustomerSupportAgent",
    address: "0x2b9100000000000000000000000000000000a7e3",
    type: "support",
    status: "active",
    frozen: false,
  },
] as const;

const agentIds = [
  "30000000-0000-4000-8000-000000000001",
  "30000000-0000-4000-8000-000000000002",
  "30000000-0000-4000-8000-000000000003",
  "30000000-0000-4000-8000-000000000004",
  "30000000-0000-4000-8000-000000000005",
] as const;

const vendorSeeds = [
  ["40000000-0000-4000-8000-000000000001", "OpenAI", "0x71c700000000000000000000000000000000fe19", "api", "arcanevm"],
  ["40000000-0000-4000-8000-000000000002", "Anthropic", "0x4a2b000000000000000000000000000000008c0d", "api", "arcanevm"],
  ["40000000-0000-4000-8000-000000000003", "Tavily", "0x3f1900000000000000000000000000000000aa52", "data", "public"],
  ["40000000-0000-4000-8000-000000000004", "GitHub", "0xab0900000000000000000000000000000000cd44", "subcontracting", "public"],
  ["40000000-0000-4000-8000-000000000005", "AWS Bedrock", "0x9dd400000000000000000000000000000000b71a", "compute", "arcanevm"],
  ["40000000-0000-4000-8000-000000000006", "Cloudflare", "0x88e10000000000000000000000000000000007bb", "compute", "public"],
  ["40000000-0000-4000-8000-000000000007", "Vercel", "0x77fa0000000000000000000000000000000012dd", "compute", "public"],
  ["40000000-0000-4000-8000-000000000008", "Pinecone", "0x6b880000000000000000000000000000000014ec", "compute", "arcanevm"],
  ["40000000-0000-4000-8000-000000000009", "Cohere", "0x22ad000000000000000000000000000000009f31", "api", "public"],
  ["40000000-0000-4000-8000-000000000010", "Stripe", "0x1234000000000000000000000000000000005678", "other", "public"],
] as const;

const transferSeeds = [
  ["60000000-0000-4000-8000-000000000001", 0, "0xaaa1000000000000000000000000000000000000000000000000000000000001", 5042118, 0, "0x71c700000000000000000000000000000000fe19", "4200000", "ALLOW", "within all caps", "api", "4200000"],
  ["60000000-0000-4000-8000-000000000002", 3, "0xaaa1000000000000000000000000000000000000000000000000000000002", 5042117, 1, "0x1234000000000000000000000000000000005678", "1247000000", "ALLOW", "treasury rebalance approved", "other", "1247000000"],
  ["60000000-0000-4000-8000-000000000003", 2, "0xaaa1000000000000000000000000000000000000000000000000000000003", 5042061, 2, "0xe11d00000000000000000000000000000000da7a", "847000000", "DENY", "vendor not on allowlist", "data", "0"],
  ["60000000-0000-4000-8000-000000000004", 0, "0xaaa1000000000000000000000000000000000000000000000000000000004", 5042060, 3, "0x9dd400000000000000000000000000000000b71a", "73420000", "ESCALATE", "exceeds per-vendor daily limit", "compute", "342000000"],
  ["60000000-0000-4000-8000-000000000005", 2, "0xaaa1000000000000000000000000000000000000000000000000000000005", 5042059, 4, "0x4a2b000000000000000000000000000000008c0d", "312000000", "FREEZE", "agent frozen by anomaly oracle", "api", "0"],
  ["60000000-0000-4000-8000-000000000006", 1, "0xaaa1000000000000000000000000000000000000000000000000000000006", 5042058, 5, "0x3f1900000000000000000000000000000000aa52", "2100000", "ALLOW", "within all caps", "data", "89000000"],
  ["60000000-0000-4000-8000-000000000007", 4, "0xaaa1000000000000000000000000000000000000000000000000000000007", 5042057, 6, "0x4a2b000000000000000000000000000000008c0d", "800000", "ALLOW", "within all caps", "api", "34000000"],
  ["60000000-0000-4000-8000-000000000008", 0, "0xaaa1000000000000000000000000000000000000000000000000000000008", 5042056, 7, "0x6b880000000000000000000000000000000014ec", "1900000", "ALLOW", "within all caps", "compute", "343900000"],
  ["60000000-0000-4000-8000-000000000009", 1, "0xaaa1000000000000000000000000000000000000000000000000000000009", 5042055, 8, "0x22ad000000000000000000000000000000009f31", "1400000", "ALLOW", "within all caps", "api", "90400000"],
] as const;

async function main() {
  await db
    .insert(organizations)
    .values({
      id: orgId,
      tenantId: FALLBACK_TENANT_ID,
      name: "Helix DAO",
      type: "DAO",
      ownerWallet: admin,
      multisigAddress: "0x1111000000000000000000000000000000000da0",
      chainId: 5042002,
      createdAt: minutesAgo(120),
    })
    .onConflictDoNothing();

  await db
    .insert(users)
    .values({
      id: "90000000-0000-4000-8000-000000000001",
      tenantId: FALLBACK_TENANT_ID,
      walletAddress: admin,
      displayName: "Aisha Chen",
      role: "owner",
      createdAt: minutesAgo(120),
    })
    .onConflictDoNothing();

  await db
    .insert(wallets)
    .values(
      walletSeeds.map((wallet, index) => ({
        id: wallet.id,
        tenantId: FALLBACK_TENANT_ID,
        orgId,
        address: wallet.address,
        label: wallet.label,
        ownerAddress: admin,
        createdBlock: 5041000 + index,
        createdAt: minutesAgo(600 + index),
        factoryAddress: "0xfac7000000000000000000000000000000000000",
        frozen: wallet.frozen,
        policyVersion: 1,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(agents)
    .values(
      walletSeeds.map((wallet, index) => ({
        id: agentIds[index],
        tenantId: FALLBACK_TENANT_ID,
        walletId: wallet.id,
        signerAddress: wallet.address,
        label: wallet.label,
        type: wallet.type,
        status: wallet.status,
        createdAt: minutesAgo(500 + index),
        lastSeenAt: minutesAgo(index),
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(vendors)
    .values(
      vendorSeeds.map(([id, name, address, category, kyc], index) => ({
        id,
        tenantId: FALLBACK_TENANT_ID,
        walletId: walletSeeds[0].id,
        address,
        category,
        status: "allowed" as const,
        perVendorCap: kyc === "arcanevm" ? "100000000" : "0",
        metadataHash: `0x${Buffer.from(name).toString("hex").padEnd(64, "0").slice(0, 64)}`,
        addedAt: minutesAgo(2 + index),
        addedBy: admin,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(policies)
    .values(
      walletSeeds.map((wallet, index) => ({
        id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        tenantId: FALLBACK_TENANT_ID,
        walletId: wallet.id,
        version: 1,
        perTxCap: index === 3 ? "1000000000" : "50000000",
        daily24hCap: index === 3 ? "5000000000" : "500000000",
        monthlyRollingCap: "15000000000",
        allowedCategories: 0b11111,
        escalationThreshold: "100000000",
        requireAllowlist: true,
        updatedAt: minutesAgo(index),
        updatedBy: admin,
      })),
    )
    .onConflictDoNothing();

  await db
    .insert(transfers)
    .values(
      transferSeeds.map(
        ([id, walletIndex, txHash, blockNumber, minute, toAddress, amount, verdict, reason, vendorCategory, dailySpentAfter]) => ({
          id,
          tenantId: FALLBACK_TENANT_ID,
          walletId: walletSeeds[walletIndex].id,
          agentId: agentIds[walletIndex],
          txHash,
          blockNumber,
          timestamp: minutesAgo(minute),
          toAddress,
          amount,
          verdict,
          reason,
          vendorCategory,
          dailySpentAfter,
        }),
      ),
    )
    .onConflictDoNothing();

  await db
    .insert(escalations)
    .values([
      {
        id: "0xeeee000000000000000000000000000000000000000000000000000000000001",
        tenantId: FALLBACK_TENANT_ID,
        walletId: walletSeeds[0].id,
        transferId: transferSeeds[3][0],
        toAddress: "0x9dd400000000000000000000000000000000b71a",
        amount: "73420000",
        reason: "Exceeds per-vendor daily limit ($50.00). Held for approver review.",
        createdAt: minutesAgo(0),
        expiresAt: minutesAhead(42),
        status: "PENDING",
        signaturesCount: 1,
        threshold: 2,
        signers: [admin],
      },
      {
        id: "0xeeee000000000000000000000000000000000000000000000000000000000002",
        tenantId: FALLBACK_TENANT_ID,
        walletId: walletSeeds[2].id,
        transferId: transferSeeds[2][0],
        toAddress: "evil-data-broker.com",
        amount: "847000000",
        reason: "Vendor not on allowlist and 7.4 sigma deviation triggered.",
        createdAt: minutesAgo(2),
        expiresAt: minutesAhead(3),
        status: "REJECTED",
        signaturesCount: 0,
        threshold: 2,
        signers: [],
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(anomalies)
    .values({
      id: "70000000-0000-4000-8000-000000000001",
      tenantId: FALLBACK_TENANT_ID,
      walletId: walletSeeds[2].id,
      agentId: agentIds[2],
      sigma: "7.4000",
      reason: "DevAgent-01 attempted 47 transactions in 3 minutes to an unrecognized counterparty.",
      blockNumber: 5042061,
      txHash: transferSeeds[2][2],
      severity: "danger",
      createdAt: new Date("2026-06-08T02:47:12.000Z"),
    })
    .onConflictDoNothing();

  await db
    .insert(events)
    .values(
      transferSeeds.map(
        ([id, walletIndex, txHash, blockNumber, minute, toAddress, amount, verdict, reason, vendorCategory], index) => ({
          id: `80000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
          tenantId: FALLBACK_TENANT_ID,
          walletId: walletSeeds[walletIndex].id,
          type: verdict === "ALLOW" ? "TRANSFER_ALLOWED" : `TRANSFER_${verdict}`,
          severity: verdict === "ALLOW" ? "success" : verdict === "ESCALATE" ? "warning" : "danger",
          payload: {
            transferId: id,
            agentId: agentIds[walletIndex],
            toAddress,
            amount,
            category: vendorCategory,
            reason,
          },
          blockNumber,
          txHash,
          timestamp: minutesAgo(minute),
        }),
      ),
    )
    .onConflictDoNothing();
}

main()
  .then(async () => {
    await client.end();
    console.log("Seed complete: Helix DAO demo seed data inserted.");
  })
  .catch(async (error) => {
    await client.end();
    console.error(error);
    process.exit(1);
  });
