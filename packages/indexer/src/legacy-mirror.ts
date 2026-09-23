/**
 * Shared persistence operations for the supported legacy Drizzle read model.
 * Keep this separate from Supabase scheduling: disabling this mirror must not
 * disable dashboard writes. Handler-specific mutations still live with their
 * event mapping; no schema or auth/database consumer is retired here.
 */
import { db } from "@arcanum/db";
import { events, organizations, transfers, wallets } from "@arcanum/db/schema";
import { ARC_CHAIN_ID } from "@arcanum/shared";
import { and, eq } from "drizzle-orm";

export const pgMirrorDisabled = process.env.ARCANUM_DISABLE_PG_MIRROR === "1";
if (pgMirrorDisabled) {
  console.warn(
    "[indexer] ARCANUM_DISABLE_PG_MIRROR=1 - the legacy Postgres mirror is off; Supabase is the only write target for this run.",
  );
}

export async function findWallet(walletAddress: string, tenantId: string) {
  if (pgMirrorDisabled) return undefined;
  return db.query.wallets.findFirst({
    where: and(eq(wallets.tenantId, tenantId), eq(wallets.address, walletAddress.toLowerCase())),
  });
}

export async function ensureOrganization(ownerAddress: string, tenantId: string) {
  if (pgMirrorDisabled) return undefined;
  const owner = ownerAddress.toLowerCase();
  const existing = await db.query.organizations.findFirst({
    where: and(eq(organizations.tenantId, tenantId), eq(organizations.ownerWallet, owner)),
  });
  if (existing) return existing;
  const created = await db
    .insert(organizations)
    .values({
      tenantId,
      name: "Arcanum Workspace",
      type: "DAO",
      ownerWallet: owner,
      multisigAddress: owner,
      chainId: ARC_CHAIN_ID,
    })
    .returning();
  return created[0];
}

export async function insertEvent(input: {
  tenantId: string;
  walletId?: string;
  type: string;
  severity: "info" | "warning" | "danger" | "success";
  payload: Record<string, unknown>;
  blockNumber: number;
  txHash: string;
  timestamp: Date;
}) {
  if (pgMirrorDisabled) return undefined;
  const existing = await db.query.events.findFirst({
    where: and(
      eq(events.tenantId, input.tenantId),
      eq(events.txHash, input.txHash),
      eq(events.type, input.type),
    ),
  });
  if (existing) return existing;
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

export async function findTransferByTx(tenantId: string, txHash: string) {
  if (pgMirrorDisabled) return undefined;
  return db.query.transfers.findFirst({
    where: and(eq(transfers.tenantId, tenantId), eq(transfers.txHash, txHash)),
  });
}
