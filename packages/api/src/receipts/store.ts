import {
  type PaymentReceiptEnvelope,
  type PaymentReceiptEvidence,
  paymentReceiptDigest,
  paymentReceiptEnvelopeSchema,
  paymentReceiptEvidenceSchema,
} from "@arcanum/shared";

import type { ApiContext } from "../context";
import {
  SupabaseRequestError,
  type SupabaseRow,
  type SupabaseServiceRoleClient,
  warnSupabase,
} from "../supabase/client";
import { numberOrNull, stringField } from "../supabase/fields";
import { ReceiptError } from "./errors";

export const RECEIPTS_TABLE = "payment_receipts";
export const EVIDENCE_TABLE = "payment_receipt_evidence";

export const MAX_RECEIPTS_PER_PAGE = 100;
const MAX_EVIDENCE_PER_RECEIPT = 200;

export type StoredReceipt = Readonly<{
  envelope: PaymentReceiptEnvelope;
  walletId: string;
  orgId: string;
  /** Row creation time, normalized to a UTC `Z` timestamp. */
  createdAt: string;
}>;

export type ReceiptRequestKey = Readonly<{
  chainId: number;
  walletAddress: string;
  agentSignerAddress: string;
  reference: string;
}>;

export type NewEvidence = Omit<PaymentReceiptEvidence, "id" | "observedAt">;

/**
 * Receipts are persisted exactly as issued: the envelope is stored whole in a
 * table only the service role can write, and every row read back is parsed
 * against the envelope schema with its digest recomputed from the body, so a
 * row that no longer says what was signed is reported as a store fault rather
 * than served. Issuer and agent signatures are checked by the consumers that
 * act on a receipt (the SDK before it pays, the browser on the receipt page,
 * the public verifier), which is where a forged signature would matter.
 */
export async function insertStoredReceipt(
  ctx: ApiContext,
  receipt: StoredReceipt,
): Promise<"inserted" | "conflict"> {
  const client = requireStore(ctx);
  const body = receipt.envelope.receipt;
  try {
    await client.insertRows(RECEIPTS_TABLE, [
      {
        id: body.receiptId,
        organization_id: receipt.orgId,
        governed_wallet_id: receipt.walletId,
        chain_id: body.request.chainId,
        wallet_address: body.request.governedWalletAddress,
        agent_signer_address: body.request.agentSignerAddress,
        vendor_address: body.request.vendorAddress,
        token_address: body.request.tokenAddress,
        amount_base_units: body.amountBaseUnits,
        reference: body.request.reference,
        request_digest: body.requestDigest,
        verdict: body.decision.verdict,
        reason_code: body.decision.reasonCode,
        block_number: body.evaluation.blockNumber,
        block_hash: body.evaluation.blockHash,
        policy_version: body.evaluation.policyVersion,
        evaluated_at: body.evaluation.evaluatedAt,
        issuer_key_id: body.issuer.keyId,
        receipt_digest: receipt.envelope.receiptDigest,
        signature: receipt.envelope.signature,
        envelope: receipt.envelope,
        created_at: receipt.createdAt,
      },
    ]);
    return "inserted";
  } catch (error) {
    if (error instanceof SupabaseRequestError && error.status === 409) {
      return "conflict";
    }
    throw storeUnavailable(`${RECEIPTS_TABLE}.insert`, error);
  }
}

export async function findStoredReceiptByKey(
  ctx: ApiContext,
  key: ReceiptRequestKey,
): Promise<StoredReceipt | null> {
  const rows = await select(ctx, RECEIPTS_TABLE, {
    filters: {
      chain_id: key.chainId,
      wallet_address: key.walletAddress.toLowerCase(),
      agent_signer_address: key.agentSignerAddress.toLowerCase(),
      reference: key.reference,
    },
    limit: 1,
  });
  const [row] = rows;
  return row ? storedReceiptFromRow(row) : null;
}

export async function readStoredReceipt(
  ctx: ApiContext,
  receiptId: string,
): Promise<StoredReceipt | null> {
  const [row] = await select(ctx, RECEIPTS_TABLE, { filters: { id: receiptId }, limit: 1 });
  return row ? storedReceiptFromRow(row) : null;
}

export type ReceiptListQuery = Readonly<{
  walletIds: readonly string[];
  agentSignerAddress: string | null;
  limit: number;
  before?: { createdAt: string; id: string };
}>;

/**
 * Receipts visible to a caller: those issued for wallets they can see, plus
 * those they requested themselves as an agent signer. The two reads are
 * merged in memory because PostgREST cannot express the union in one filter
 * without hand-built `or=` strings.
 */
export async function listStoredReceipts(
  ctx: ApiContext,
  query: ReceiptListQuery,
): Promise<StoredReceipt[]> {
  const limit = Math.min(Math.max(query.limit, 1), MAX_RECEIPTS_PER_PAGE);
  const common = { order: "created_at.desc,id.desc", limit, before: query.before };

  const [walletRows, signerRows] = await Promise.all([
    query.walletIds.length > 0
      ? select(ctx, RECEIPTS_TABLE, {
          ...common,
          inFilters: { governed_wallet_id: [...query.walletIds] },
        })
      : Promise.resolve([] as SupabaseRow[]),
    query.agentSignerAddress
      ? select(ctx, RECEIPTS_TABLE, {
          ...common,
          filters: { agent_signer_address: query.agentSignerAddress.toLowerCase() },
        })
      : Promise.resolve([] as SupabaseRow[]),
  ]);

  const byId = new Map<string, SupabaseRow>();
  for (const row of [...walletRows, ...signerRows]) {
    byId.set(stringField(row, ["id"]), row);
  }

  return [...byId.values()]
    .map(storedReceiptFromRow)
    .sort(
      (left, right) =>
        Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
        right.envelope.receipt.receiptId.localeCompare(left.envelope.receipt.receiptId),
    )
    .slice(0, limit);
}

export async function insertReceiptEvidence(
  ctx: ApiContext,
  evidence: NewEvidence,
  scope: Readonly<{ walletId: string; orgId: string }>,
): Promise<"inserted" | "duplicate"> {
  const client = requireStore(ctx);
  try {
    await client.insertRows(EVIDENCE_TABLE, [
      {
        receipt_id: evidence.receiptId,
        organization_id: scope.orgId,
        governed_wallet_id: scope.walletId,
        kind: evidence.kind,
        outcome: evidence.outcome,
        tx_hash: evidence.txHash,
        log_index: evidence.logIndex,
        block_number: evidence.blockNumber,
        escalation_key: evidence.escalationKey,
        calldata_names_receipt: evidence.calldataNamesReceipt,
        details: evidence.details,
      },
    ]);
    return "inserted";
  } catch (error) {
    if (error instanceof SupabaseRequestError && error.status === 409) {
      return "duplicate";
    }
    throw storeUnavailable(`${EVIDENCE_TABLE}.insert`, error);
  }
}

/** Receipts that already hold an execution row for this transaction hash. */
export async function findReceiptsLinkedToTransaction(
  ctx: ApiContext,
  txHash: string,
): Promise<string[]> {
  const rows = await select(ctx, EVIDENCE_TABLE, {
    filters: { tx_hash: txHash, kind: "execution" },
    limit: MAX_EVIDENCE_PER_RECEIPT,
  });
  return [...new Set(rows.map((row) => stringField(row, ["receipt_id"])))];
}

export async function readReceiptEvidence(
  ctx: ApiContext,
  receiptId: string,
): Promise<PaymentReceiptEvidence[]> {
  const rows = await select(ctx, EVIDENCE_TABLE, {
    filters: { receipt_id: receiptId },
    order: "observed_at.asc,id.asc",
    limit: MAX_EVIDENCE_PER_RECEIPT,
  });
  return rows.map(evidenceFromRow);
}

export function storedReceiptFromRow(row: SupabaseRow): StoredReceipt {
  const parsed = paymentReceiptEnvelopeSchema.safeParse(row.envelope);
  if (!parsed.success) {
    throw new ReceiptError(
      "RECEIPT_STORE_UNAVAILABLE",
      `Stored receipt ${stringField(row, ["id"], "?")} is not a valid receipt envelope.`,
      { cause: parsed.error },
    );
  }
  if (paymentReceiptDigest(parsed.data.receipt) !== parsed.data.receiptDigest) {
    throw new ReceiptError(
      "RECEIPT_STORE_UNAVAILABLE",
      `Stored receipt ${stringField(row, ["id"], "?")} no longer matches its signed digest.`,
    );
  }
  const walletId = stringField(row, ["governed_wallet_id"], "");
  const orgId = stringField(row, ["organization_id"], "");
  if (!walletId || !orgId) {
    throw new ReceiptError(
      "RECEIPT_STORE_UNAVAILABLE",
      `Stored receipt ${stringField(row, ["id"], "?")} has no governed wallet or workspace.`,
    );
  }
  return {
    envelope: parsed.data,
    walletId,
    orgId,
    createdAt: timestampField(row, "created_at"),
  };
}

/**
 * PostgREST renders `timestamptz` with an explicit offset (`+00:00`) and a
 * variable number of fraction digits; the API speaks `Z` timestamps only.
 */
function timestampField(row: SupabaseRow, key: string): string {
  const raw = stringField(row, [key], "");
  const millis = Date.parse(raw);
  if (!raw || Number.isNaN(millis)) {
    throw new ReceiptError(
      "RECEIPT_STORE_UNAVAILABLE",
      `Stored row ${stringField(row, ["id"], "?")} has no valid ${key}.`,
    );
  }
  return new Date(millis).toISOString();
}

function evidenceFromRow(row: SupabaseRow): PaymentReceiptEvidence {
  const parsed = paymentReceiptEvidenceSchema.safeParse({
    id: stringField(row, ["id"]),
    receiptId: stringField(row, ["receipt_id"]),
    kind: stringField(row, ["kind"]),
    outcome: stringField(row, ["outcome"]),
    txHash: stringField(row, ["tx_hash"], "") || null,
    logIndex: numberOrNull(row, ["log_index"]),
    blockNumber: numberOrNull(row, ["block_number"]),
    escalationKey: stringField(row, ["escalation_key"], "") || null,
    calldataNamesReceipt:
      typeof row.calldata_names_receipt === "boolean" ? row.calldata_names_receipt : null,
    observedAt: timestampField(row, "observed_at"),
    details: row.details && typeof row.details === "object" ? row.details : {},
  });
  if (!parsed.success) {
    throw new ReceiptError(
      "RECEIPT_STORE_UNAVAILABLE",
      `Stored evidence ${stringField(row, ["id"], "?")} is not a valid evidence record.`,
      { cause: parsed.error },
    );
  }
  return parsed.data;
}

function requireStore(ctx: ApiContext): SupabaseServiceRoleClient {
  if (!ctx.supabase) {
    throw new ReceiptError(
      "RECEIPT_STORE_UNAVAILABLE",
      "The receipt store is not configured on this deployment, so receipts cannot be issued or read.",
    );
  }
  return ctx.supabase;
}

async function select(
  ctx: ApiContext,
  table: string,
  options: Parameters<SupabaseServiceRoleClient["selectRows"]>[1],
) {
  const client = requireStore(ctx);
  try {
    return await client.selectRows(table, options);
  } catch (error) {
    throw storeUnavailable(`${table}.read`, error);
  }
}

function storeUnavailable(label: string, error: unknown) {
  warnSupabase(label, error);
  return new ReceiptError(
    "RECEIPT_STORE_UNAVAILABLE",
    "The receipt store is unavailable. This is an outage, not a missing receipt. Try again shortly.",
    { cause: error },
  );
}
