import { ponder } from "ponder:registry";
import { db, defaultTenantId } from "@arcanum/db";
import {
  events,
  agents,
  anomalies,
  escalations,
  organizations,
  transfers,
  vendors,
  wallets,
} from "@arcanum/db/schema";
import { and, eq } from "drizzle-orm";

const ARC_TESTNET_CHAIN_ID = 5_042_002;

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asAddress(value: unknown) {
  return asString(value).toLowerCase();
}

function asBigint(value: unknown) {
  return typeof value === "bigint" ? value : 0n;
}

function asNumber(value: unknown) {
  return typeof value === "number" ? value : Number(asBigint(value));
}

function blockDate(timestamp: bigint) {
  return new Date(Number(timestamp) * 1000);
}

async function findWallet(walletAddress: string, tenantId: string) {
  return db.query.wallets.findFirst({
    where: and(eq(wallets.tenantId, tenantId), eq(wallets.address, walletAddress.toLowerCase())),
  });
}

async function ensureOrganization(ownerAddress: string, tenantId: string) {
  const owner = ownerAddress.toLowerCase();
  const existing = await db.query.organizations.findFirst({
    where: and(eq(organizations.tenantId, tenantId), eq(organizations.ownerWallet, owner)),
  });

  if (existing) {
    return existing;
  }

  const created = await db
    .insert(organizations)
    .values({
      tenantId,
      name: "Helix DAO",
      type: "DAO",
      ownerWallet: owner,
      multisigAddress: owner,
      chainId: ARC_TESTNET_CHAIN_ID,
    })
    .returning();
  return created[0];
}

async function insertEvent(input: {
  tenantId: string;
  walletId?: string;
  type: string;
  severity: "info" | "warning" | "danger" | "success";
  payload: Record<string, unknown>;
  blockNumber: number;
  txHash: string;
  timestamp: Date;
}) {
  const existing = await db.query.events.findFirst({
    where: and(
      eq(events.tenantId, input.tenantId),
      eq(events.txHash, input.txHash),
      eq(events.type, input.type),
    ),
  });

  if (existing) {
    return existing;
  }

  await db.insert(events).values({
    tenantId: input.tenantId,
    walletId: input.walletId,
    type: input.type,
    severity: input.severity,
    payload: input.payload,
    blockNumber: input.blockNumber,
    txHash: input.txHash,
    timestamp: input.timestamp,
  });
}

async function findTransferByTx(tenantId: string, txHash: string) {
  return db.query.transfers.findFirst({
    where: and(eq(transfers.tenantId, tenantId), eq(transfers.txHash, txHash)),
  });
}

ponder.on("WalletFactory:WalletCreated", async ({ event }) => {
  const tenantId = defaultTenantId();
  const walletAddress = asAddress(event.args.wallet);
  const owner = asAddress(event.args.owner);
  const label = asString(event.args.label) || "Agent Wallet";
  const org = await ensureOrganization(owner, tenantId);

  if (!org) {
    return;
  }

  const existingWallet = await findWallet(walletAddress, tenantId);
  const wallet =
    existingWallet ??
    (
      await db
        .insert(wallets)
        .values({
          tenantId,
          orgId: org.id,
          address: walletAddress,
          label,
          ownerAddress: owner,
          createdBlock: Number(event.block.number),
          factoryAddress: asAddress(event.args.factory) || asAddress(event.args.walletFactory),
          frozen: false,
          policyVersion: 1,
        })
        .returning()
    )[0];

  if (!wallet) {
    return;
  }

  await insertEvent({
    tenantId,
    walletId: wallet.id,
    type: "WALLET_CREATED",
    severity: "info",
    payload: { wallet: walletAddress, owner, label },
    blockNumber: Number(event.block.number),
    txHash: event.transaction.hash,
    timestamp: blockDate(event.block.timestamp),
  });
});

ponder.on("GuardedWallet:TransferExecuted", async ({ event }) => {
  const tenantId = defaultTenantId();
  const walletAddress = asAddress(event.args.wallet);
  const wallet = await findWallet(walletAddress, tenantId);
  if (!wallet) {
    return;
  }

  const amount = asBigint(event.args.amount).toString();
  const existingTransfer = await findTransferByTx(tenantId, event.transaction.hash);
  const transfer =
    existingTransfer ??
    (
      await db
        .insert(transfers)
        .values({
          tenantId,
          walletId: wallet.id,
          txHash: event.transaction.hash,
          blockNumber: Number(event.block.number),
          timestamp: blockDate(event.block.timestamp),
          toAddress: asAddress(event.args.to),
          amount,
          verdict: "ALLOW",
          reason: "ON_CHAIN_POLICY_ALLOW",
          vendorCategory: "other",
          dailySpentAfter: amount,
        })
        .returning()
    )[0];

  await insertEvent({
    tenantId,
    walletId: wallet.id,
    type: "TRANSFER_EXECUTED",
    severity: "success",
    payload: { transferId: transfer?.id, amount },
    blockNumber: Number(event.block.number),
    txHash: event.transaction.hash,
    timestamp: blockDate(event.block.timestamp),
  });
});

ponder.on("GuardedWallet:TransferEscalated", async ({ event }) => {
  const tenantId = defaultTenantId();
  const wallet = await findWallet(asAddress(event.args.wallet), tenantId);
  if (!wallet) {
    return;
  }

  const amount = asBigint(event.args.amount).toString();
  const existingTransfer = await findTransferByTx(tenantId, event.transaction.hash);
  const transfer =
    existingTransfer ??
    (
      await db
        .insert(transfers)
        .values({
          tenantId,
          walletId: wallet.id,
          txHash: event.transaction.hash,
          blockNumber: Number(event.block.number),
          timestamp: blockDate(event.block.timestamp),
          toAddress: asAddress(event.args.to),
          amount,
          verdict: "ESCALATE",
          reason: asString(event.args.reason),
          vendorCategory: "compute",
          dailySpentAfter: "0",
        })
        .returning()
    )[0];

  const escalationId = asString(event.args.escalationId);
  const existingEscalation = await db.query.escalations.findFirst({
    where: and(eq(escalations.tenantId, tenantId), eq(escalations.id, escalationId)),
  });

  if (!existingEscalation) {
    await db.insert(escalations).values({
      id: escalationId,
      tenantId,
      walletId: wallet.id,
      transferId: transfer?.id,
      toAddress: asAddress(event.args.to),
      amount,
      reason: asString(event.args.reason),
      createdAt: blockDate(event.block.timestamp),
      expiresAt: new Date(Number(event.block.timestamp + 3_600n) * 1000),
      status: "PENDING",
      signaturesCount: 0,
      threshold: 2,
      signers: [],
    });
  }

  await insertEvent({
    tenantId,
    walletId: wallet.id,
    type: "TRANSFER_ESCALATED",
    severity: "warning",
    payload: { escalationId, amount },
    blockNumber: Number(event.block.number),
    txHash: event.transaction.hash,
    timestamp: blockDate(event.block.timestamp),
  });
});

ponder.on("GuardedWallet:Frozen", async ({ event }) => {
  const tenantId = defaultTenantId();
  const wallet = await findWallet(asAddress(event.args.wallet), tenantId);
  if (!wallet) {
    return;
  }

  await db.update(wallets).set({ frozen: true }).where(eq(wallets.id, wallet.id));
  await db
    .update(agents)
    .set({ status: "frozen" })
    .where(and(eq(agents.tenantId, tenantId), eq(agents.walletId, wallet.id)));
  await insertEvent({
    tenantId,
    walletId: wallet.id,
    type: "WALLET_FROZEN",
    severity: "danger",
    payload: { reason: asNumber(event.args.reason) },
    blockNumber: Number(event.block.number),
    txHash: event.transaction.hash,
    timestamp: blockDate(event.block.timestamp),
  });
});

ponder.on("GuardedWallet:Unfrozen", async ({ event }) => {
  const tenantId = defaultTenantId();
  const wallet = await findWallet(asAddress(event.args.wallet), tenantId);
  if (!wallet) {
    return;
  }

  await db.update(wallets).set({ frozen: false }).where(eq(wallets.id, wallet.id));
  await insertEvent({
    tenantId,
    walletId: wallet.id,
    type: "WALLET_UNFROZEN",
    severity: "info",
    payload: {},
    blockNumber: Number(event.block.number),
    txHash: event.transaction.hash,
    timestamp: blockDate(event.block.timestamp),
  });
});

ponder.on("GuardedWallet:PolicyUpdated", async ({ event }) => {
  const tenantId = defaultTenantId();
  const wallet = await findWallet(asAddress(event.args.wallet), tenantId);
  if (!wallet) {
    return;
  }
  const txHash = event.transaction.hash;
  const existingEvent = await db.query.events.findFirst({
    where: and(
      eq(events.tenantId, tenantId),
      eq(events.txHash, txHash),
      eq(events.type, "POLICY_UPDATED"),
    ),
  });
  if (existingEvent) {
    return;
  }

  const nextPolicyVersion = wallet.policyVersion + 1;

  await db
    .update(wallets)
    .set({ policyVersion: nextPolicyVersion })
    .where(eq(wallets.id, wallet.id));
  await insertEvent({
    tenantId,
    walletId: wallet.id,
    type: "POLICY_UPDATED",
    severity: "info",
    payload: { version: nextPolicyVersion, source: "GuardedWallet.PolicyUpdated" },
    blockNumber: Number(event.block.number),
    txHash,
    timestamp: blockDate(event.block.timestamp),
  });
});

ponder.on("GuardedWallet:SignerAdded", async ({ event }) => {
  const tenantId = defaultTenantId();
  const wallet = await findWallet(asAddress(event.args.wallet), tenantId);
  if (!wallet) {
    return;
  }

  const signerAddress = asAddress(event.args.signer);
  const existingAgent = await db.query.agents.findFirst({
    where: and(
      eq(agents.tenantId, tenantId),
      eq(agents.walletId, wallet.id),
      eq(agents.signerAddress, signerAddress),
    ),
  });

  if (existingAgent) {
    await db
      .update(agents)
      .set({
        label: wallet.label,
        lastSeenAt: blockDate(event.block.timestamp),
        status: "active",
      })
      .where(eq(agents.id, existingAgent.id));
  } else {
    await db.insert(agents).values({
      tenantId,
      walletId: wallet.id,
      signerAddress,
      label: wallet.label,
      type: "other",
      lastSeenAt: blockDate(event.block.timestamp),
      status: "active",
    });
  }

  await insertEvent({
    tenantId,
    walletId: wallet.id,
    type: "SIGNER_AUTHORIZED",
    severity: "info",
    payload: { signer: signerAddress },
    blockNumber: Number(event.block.number),
    txHash: event.transaction.hash,
    timestamp: blockDate(event.block.timestamp),
  });
});

ponder.on("GuardedWallet:SignerRemoved", async ({ event }) => {
  const tenantId = defaultTenantId();
  const wallet = await findWallet(asAddress(event.args.wallet), tenantId);
  if (!wallet) {
    return;
  }

  const signerAddress = asAddress(event.args.signer);
  const existingAgent = await db.query.agents.findFirst({
    where: and(
      eq(agents.tenantId, tenantId),
      eq(agents.walletId, wallet.id),
      eq(agents.signerAddress, signerAddress),
    ),
  });

  if (existingAgent) {
    await db.update(agents).set({ status: "paused" }).where(eq(agents.id, existingAgent.id));
  } else {
    await db.insert(agents).values({
      tenantId,
      walletId: wallet.id,
      signerAddress,
      label: wallet.label,
      type: "other",
      lastSeenAt: blockDate(event.block.timestamp),
      status: "paused",
    });
  }

  await insertEvent({
    tenantId,
    walletId: wallet.id,
    type: "SIGNER_REVOKED",
    severity: "info",
    payload: { signer: signerAddress },
    blockNumber: Number(event.block.number),
    txHash: event.transaction.hash,
    timestamp: blockDate(event.block.timestamp),
  });
});

ponder.on("GuardedWallet:ModuleRotated", async ({ event }) => {
  const tenantId = defaultTenantId();
  const wallet = await findWallet(asAddress(event.args.wallet), tenantId);
  if (!wallet) {
    return;
  }

  await insertEvent({
    tenantId,
    walletId: wallet.id,
    type: "MODULE_ROTATED",
    severity: "info",
    payload: { module: asString(event.args.module), newModule: asAddress(event.args.newModule) },
    blockNumber: Number(event.block.number),
    txHash: event.transaction.hash,
    timestamp: blockDate(event.block.timestamp),
  });
});

ponder.on("EscalationManager:EscalationApproved", async ({ event }) => {
  const tenantId = defaultTenantId();
  const escalationId = asString(event.args.escalationId);
  const escalation = await db.query.escalations.findFirst({
    where: and(eq(escalations.tenantId, tenantId), eq(escalations.id, escalationId)),
  });
  if (!escalation) {
    return;
  }

  const signer = asAddress(event.args.signer);
  const signers = escalation.signers.includes(signer)
    ? escalation.signers
    : [...escalation.signers, signer];

  await db
    .update(escalations)
    .set({
      signaturesCount: Math.max(asNumber(event.args.count), signers.length),
      signers,
    })
    .where(and(eq(escalations.tenantId, tenantId), eq(escalations.id, escalationId)));

  await insertEvent({
    tenantId,
    walletId: escalation.walletId,
    type: "ESCALATION_APPROVED",
    severity: "info",
    payload: { escalationId, signer, count: asNumber(event.args.count) },
    blockNumber: Number(event.block.number),
    txHash: event.transaction.hash,
    timestamp: blockDate(event.block.timestamp),
  });
});

ponder.on("EscalationManager:EscalationRejected", async ({ event }) => {
  await updateEscalationStatus(asString(event.args.escalationId), "REJECTED", event);
});

ponder.on("EscalationManager:EscalationExpired", async ({ event }) => {
  await updateEscalationStatus(asString(event.args.escalationId), "EXPIRED", event);
});

ponder.on("EscalationManager:EscalationExecuted", async ({ event }) => {
  const tenantId = defaultTenantId();
  const escalationId = asString(event.args.escalationId);
  const updated = await db
    .update(escalations)
    .set({ status: "EXECUTED", executedTxHash: event.transaction.hash })
    .where(and(eq(escalations.tenantId, tenantId), eq(escalations.id, escalationId)))
    .returning();
  const escalation = updated[0];
  if (!escalation) {
    return;
  }

  await insertEvent({
    tenantId,
    walletId: escalation.walletId,
    type: "ESCALATION_EXECUTED",
    severity: "success",
    payload: { escalationId },
    blockNumber: Number(event.block.number),
    txHash: event.transaction.hash,
    timestamp: blockDate(event.block.timestamp),
  });
});

ponder.on("AnomalyOracle:AnomalyScoreSubmitted", async ({ event }) => {
  const tenantId = defaultTenantId();
  const wallet = await findWallet(asAddress(event.args.wallet), tenantId);
  if (!wallet) {
    return;
  }

  const sigmaBps = asBigint(event.args.sigmaBps);
  const sigma = Number(sigmaBps) / 100;
  const existingAnomaly = await db.query.anomalies.findFirst({
    where: and(
      eq(anomalies.tenantId, tenantId),
      eq(anomalies.walletId, wallet.id),
      eq(anomalies.txHash, event.transaction.hash),
    ),
  });

  if (!existingAnomaly) {
    await db.insert(anomalies).values({
      tenantId,
      walletId: wallet.id,
      sigma: sigma.toFixed(4),
      reason: "SIGNED_ANOMALY_SCORE",
      blockNumber: Number(event.block.number),
      txHash: event.transaction.hash,
      severity: sigma >= 7 ? "danger" : sigma >= 4 ? "warning" : "info",
      createdAt: blockDate(event.block.timestamp),
    });
  }

  await insertEvent({
    tenantId,
    walletId: wallet.id,
    type: "ANOMALY_RECORDED",
    severity: sigma >= 7 ? "danger" : sigma >= 4 ? "warning" : "info",
    payload: { sigma },
    blockNumber: Number(event.block.number),
    txHash: event.transaction.hash,
    timestamp: blockDate(event.block.timestamp),
  });
});

ponder.on("VendorRegistry:VendorAdded", async ({ event }) => {
  const tenantId = defaultTenantId();
  const wallet = await findWallet(asAddress(event.args.wallet), tenantId);
  if (!wallet) {
    return;
  }

  const vendorAddress = asAddress(event.args.vendor);
  const existingVendor = await db.query.vendors.findFirst({
    where: and(
      eq(vendors.tenantId, tenantId),
      eq(vendors.walletId, wallet.id),
      eq(vendors.address, vendorAddress),
    ),
  });
  const vendorPatch = {
    category: categoryName(asNumber(event.args.category)),
    status: "allowed" as const,
    perVendorCap: asBigint(event.args.perVendorCap).toString(),
    metadataHash: asString(event.args.metadataHash),
    addedBy: wallet.ownerAddress,
    addedAt: blockDate(event.block.timestamp),
  };

  if (existingVendor) {
    await db.update(vendors).set(vendorPatch).where(eq(vendors.id, existingVendor.id));
  } else {
    await db.insert(vendors).values({
      tenantId,
      walletId: wallet.id,
      address: vendorAddress,
      ...vendorPatch,
    });
  }

  await insertEvent({
    tenantId,
    walletId: wallet.id,
    type: existingVendor ? "VENDOR_UPDATED" : "VENDOR_ALLOWED",
    severity: "info",
    payload: { vendor: vendorAddress, category: vendorPatch.category },
    blockNumber: Number(event.block.number),
    txHash: event.transaction.hash,
    timestamp: blockDate(event.block.timestamp),
  });
});

ponder.on("VendorRegistry:VendorBlocked", async ({ event }) => {
  await upsertVendorStatus(event, "blocked");
});

ponder.on("VendorRegistry:VendorRemoved", async ({ event }) => {
  await upsertVendorStatus(event, "removed");
});

async function updateEscalationStatus(
  escalationId: string,
  status: "REJECTED" | "EXPIRED",
  event: {
    transaction: { hash: `0x${string}` };
    block: { number: bigint; timestamp: bigint };
  },
) {
  const tenantId = defaultTenantId();
  const updated = await db
    .update(escalations)
    .set({ status })
    .where(and(eq(escalations.tenantId, tenantId), eq(escalations.id, escalationId)))
    .returning();
  const escalation = updated[0];
  if (!escalation) {
    return;
  }

  await insertEvent({
    tenantId,
    walletId: escalation.walletId,
    type: `ESCALATION_${status}`,
    severity: status === "EXPIRED" ? "info" : "warning",
    payload: { escalationId },
    blockNumber: Number(event.block.number),
    txHash: event.transaction.hash,
    timestamp: blockDate(event.block.timestamp),
  });
}

async function upsertVendorStatus(
  event: {
    args: Record<string, unknown>;
    block: { number: bigint; timestamp: bigint };
    transaction: { hash: `0x${string}` };
  },
  status: "blocked" | "removed",
) {
  const tenantId = defaultTenantId();
  const wallet = await findWallet(asAddress(event.args.wallet), tenantId);
  if (!wallet) {
    return;
  }

  const vendorAddress = asAddress(event.args.vendor);
  const existingVendor = await db.query.vendors.findFirst({
    where: and(
      eq(vendors.tenantId, tenantId),
      eq(vendors.walletId, wallet.id),
      eq(vendors.address, vendorAddress),
    ),
  });
  const vendorPatch = {
    status,
    addedAt: blockDate(event.block.timestamp),
  };

  if (existingVendor) {
    await db.update(vendors).set(vendorPatch).where(eq(vendors.id, existingVendor.id));
  } else {
    await db.insert(vendors).values({
      tenantId,
      walletId: wallet.id,
      address: vendorAddress,
      category: "other",
      status,
      perVendorCap: "0",
      metadataHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
      addedBy: wallet.ownerAddress,
      addedAt: blockDate(event.block.timestamp),
    });
  }

  await insertEvent({
    tenantId,
    walletId: wallet.id,
    type: status === "blocked" ? "VENDOR_BLOCKED" : "VENDOR_REMOVED",
    severity: status === "blocked" ? "warning" : "info",
    payload: { vendor: vendorAddress },
    blockNumber: Number(event.block.number),
    txHash: event.transaction.hash,
    timestamp: blockDate(event.block.timestamp),
  });
}

function categoryName(category: number) {
  return ["api", "compute", "data", "subcontracting", "other"][category] ?? "other";
}
