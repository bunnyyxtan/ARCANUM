import { EscalationManagerAbi, GuardedWalletAbi } from "@arcanum/contracts";
import {
  type PaymentReceiptEvidence,
  type PaymentReceiptEvidenceOutcome,
  escalationReasonFromIndex,
  escalationStatusFromIndex,
  freezeSourceFromIndex,
} from "@arcanum/shared";
import {
  type Address,
  type Hex,
  type Log,
  type ParseEventLogsReturnType,
  type TransactionReceipt,
  decodeFunctionData,
  hexToString,
  isHash,
  parseEventLogs,
} from "viem";

import type { EscalationChainStatus } from "../chain";
import type { ApiContext } from "../context";
import { ReceiptError } from "./errors";
import {
  type NewEvidence,
  type StoredReceipt,
  findReceiptsLinkedToTransaction,
  insertReceiptEvidence,
  readReceiptEvidence,
  readStoredReceipt,
} from "./store";

export type EvidenceDeps = Readonly<{
  /**
   * Current status of a held transfer, or null when the manager has no such
   * escalation. The manager is the one the wallet pointed at in the block
   * that held the transfer, so a module rotated afterwards cannot hide it.
   */
  readEscalationStatus: (
    ctx: ApiContext,
    query: Readonly<{ wallet: Address; escalationKey: Hex; blockNumber: bigint }>,
  ) => Promise<EscalationChainStatus | null>;
}>;

export const defaultEvidenceDeps: EvidenceDeps = {
  async readEscalationStatus(ctx, query) {
    const manager = await ctx.publicClient.readContract({
      address: query.wallet,
      abi: GuardedWalletAbi,
      functionName: "escalationManager",
      blockNumber: query.blockNumber,
    });
    const detail = await ctx.publicClient.readContract({
      address: manager,
      abi: EscalationManagerAbi,
      functionName: "getEscalation",
      args: [query.escalationKey],
    });
    if (/^0x0{40}$/i.test(detail[0])) {
      return null;
    }
    const status = escalationStatusFromIndex(Number(detail[8]));
    if (!status) {
      throw new Error(
        `Escalation ${query.escalationKey} returned an unknown status ${String(detail[8])}.`,
      );
    }
    return status.toLowerCase() as EscalationChainStatus;
  },
};

export type AttachedEvidence = Readonly<{
  receiptId: string;
  evidence: PaymentReceiptEvidence[];
}>;

const ESCALATION_OUTCOMES: Record<EscalationChainStatus, PaymentReceiptEvidenceOutcome> = {
  pending: "pending",
  executed: "released",
  rejected: "rejected",
  expired: "expired",
  denied: "denied",
  cancelled: "cancelled",
  invalidated: "invalidated",
};

/**
 * Link a receipt to the transaction that acted on it.
 *
 * The caller proves nothing but a transaction hash; everything else is read
 * from the chain and must agree with the receipt: the transaction has to be
 * an `executeUSDC` call from the receipt's agent signer to the receipt's
 * wallet, for the receipt's vendor and amount, and the single wallet event it
 * emitted has to name the same signer, vendor and amount. Reason bytes that
 * name another receipt disqualify it, and a transaction already linked to
 * another receipt cannot be linked again: one call acted on one decision.
 *
 * A reverted call is recorded as such; the chain keeps no reason for it, so
 * the record says the transfer did not happen, not why. A successful call is
 * classified from the wallet's own event, and a held transfer additionally
 * records the escalation's current status, so posting the same hash again
 * later appends the resolution.
 *
 * Denied receipts are linkable too: an agent that ignores a "deny" and sends
 * anyway leaves a reverted call, and a policy loosened after issuance leaves
 * an executed one. Both are worth recording; `details.verdictMatches` says
 * whether the chain did what the receipt predicted.
 */
export async function attachPaymentReceiptEvidence(
  ctx: ApiContext,
  input: Readonly<{ receiptId: string; txHash: string }>,
  deps: EvidenceDeps = defaultEvidenceDeps,
): Promise<AttachedEvidence> {
  const txHash = input.txHash.toLowerCase();
  if (!isHash(txHash)) {
    throw new ReceiptError(
      "INVALID_TRANSACTION_HASH",
      "Transaction hash must be a 32-byte 0x-prefixed hex string.",
    );
  }

  const stored = await readStoredReceipt(ctx, input.receiptId);
  if (!stored) {
    throw new ReceiptError("RECEIPT_NOT_FOUND", `Receipt ${input.receiptId} was not found.`);
  }
  const body = stored.envelope.receipt;

  const { transaction, receipt } = await readTransaction(ctx, txHash);
  const request = body.request;
  if (
    transaction.to?.toLowerCase() !== request.governedWalletAddress ||
    transaction.from.toLowerCase() !== request.agentSignerAddress
  ) {
    throw new ReceiptError(
      "EVIDENCE_MISMATCH",
      "Transaction was not sent by the receipt's agent signer to the receipt's wallet.",
    );
  }

  const call = decodeExecuteUSDC(transaction.input);
  if (
    call.to.toLowerCase() !== request.vendorAddress ||
    call.amount.toString() !== body.amountBaseUnits
  ) {
    throw new ReceiptError(
      "EVIDENCE_MISMATCH",
      "Transaction pays a different vendor or amount than the receipt attests.",
    );
  }

  const named = receiptNamedInCalldata(call.reason);
  if (named && named !== body.receiptId) {
    throw new ReceiptError(
      "EVIDENCE_MISMATCH",
      `Transaction names receipt ${named} in its reason bytes, not ${body.receiptId}.`,
    );
  }

  const linkedElsewhere = (await findReceiptsLinkedToTransaction(ctx, txHash)).filter(
    (receiptId) => receiptId !== body.receiptId,
  );
  if (linkedElsewhere.length > 0) {
    throw new ReceiptError(
      "EVIDENCE_CONFLICT",
      `Transaction ${txHash} is already linked to receipt ${linkedElsewhere[0]}; one call acted on one decision.`,
    );
  }

  const scope = { walletId: stored.walletId, orgId: stored.orgId };
  const observed = await classifyExecution(ctx, stored, receipt, txHash, call.reason, deps);
  for (const evidence of observed) {
    await insertReceiptEvidence(ctx, evidence, scope);
  }

  return { receiptId: body.receiptId, evidence: await readReceiptEvidence(ctx, body.receiptId) };
}

async function readTransaction(ctx: ApiContext, txHash: Hex) {
  let transaction: Awaited<ReturnType<ApiContext["publicClient"]["getTransaction"]>>;
  let receipt: TransactionReceipt;
  try {
    [transaction, receipt] = await Promise.all([
      ctx.publicClient.getTransaction({ hash: txHash }),
      ctx.publicClient.getTransactionReceipt({ hash: txHash }),
    ]);
  } catch (error) {
    if (isNotFound(error)) {
      throw new ReceiptError(
        "TRANSACTION_NOT_FOUND",
        `Transaction ${txHash} is not on ${ctxChainName(ctx)} yet. Wait for it to be mined and retry.`,
        { cause: error },
      );
    }
    throw new ReceiptError(
      "CHAIN_READ_FAILED",
      `Transaction ${txHash} could not be read from the chain.`,
      { cause: error },
    );
  }
  return { transaction, receipt };
}

function decodeExecuteUSDC(data: Hex) {
  let decoded: ReturnType<typeof decodeFunctionData<typeof GuardedWalletAbi>>;
  try {
    decoded = decodeFunctionData({ abi: GuardedWalletAbi, data });
  } catch (error) {
    throw new ReceiptError(
      "EVIDENCE_MISMATCH",
      "Transaction does not call a GuardedWallet function.",
      { cause: error },
    );
  }
  if (decoded.functionName !== "executeUSDC") {
    throw new ReceiptError(
      "EVIDENCE_MISMATCH",
      `Transaction calls ${decoded.functionName}, not executeUSDC.`,
    );
  }
  const [to, amount, reason] = decoded.args;
  return { to, amount, reason };
}

async function classifyExecution(
  ctx: ApiContext,
  stored: StoredReceipt,
  receipt: TransactionReceipt,
  txHash: Hex,
  reasonBytes: Hex,
  deps: EvidenceDeps,
): Promise<NewEvidence[]> {
  const body = stored.envelope.receipt;
  const base = {
    receiptId: body.receiptId,
    txHash,
    blockNumber: Number(receipt.blockNumber),
    calldataNamesReceipt: calldataNamesReceipt(reasonBytes, body.receiptId, stored),
  };
  const details = (outcome: string, extra: Record<string, unknown> = {}) => ({
    receiptVerdict: body.decision.verdict,
    verdictMatches: verdictMatches(body.decision.verdict, outcome),
    ...extra,
  });

  if (receipt.status === "reverted") {
    return [
      {
        ...base,
        kind: "execution",
        outcome: "reverted",
        logIndex: null,
        escalationKey: null,
        details: details("reverted"),
      },
    ];
  }

  const walletLogs = receipt.logs.filter(
    (log) => log.address.toLowerCase() === body.request.governedWalletAddress,
  );
  const events = parseEventLogs({
    abi: GuardedWalletAbi,
    logs: walletLogs as Log[],
    eventName: ["TransferExecuted", "TransferEscalated", "Frozen"],
  });
  const event = events[0];
  if (!event) {
    throw new ReceiptError(
      "EVIDENCE_MISMATCH",
      "Transaction succeeded but the wallet emitted no transfer, escalation or freeze event.",
    );
  }
  if (events.length > 1) {
    // One executeUSDC call emits exactly one of these; more means this is not
    // the single decision the receipt describes.
    throw new ReceiptError(
      "EVIDENCE_MISMATCH",
      `Transaction emitted ${events.length} wallet events; a receipt links to exactly one decision.`,
    );
  }
  if (!eventMatchesReceipt(event, body)) {
    throw new ReceiptError(
      "EVIDENCE_MISMATCH",
      `Wallet ${event.eventName} event does not name the receipt's wallet, signer, vendor and amount.`,
    );
  }

  switch (event.eventName) {
    case "TransferExecuted":
      return [
        {
          ...base,
          kind: "execution",
          outcome: "executed",
          logIndex: event.logIndex,
          escalationKey: null,
          details: details("executed", { signer: event.args.signer.toLowerCase() }),
        },
      ];
    case "Frozen":
      return [
        {
          ...base,
          kind: "execution",
          outcome: "frozen",
          logIndex: event.logIndex,
          escalationKey: null,
          details: details("frozen", {
            source: freezeSourceFromIndex(event.args.source) ?? String(event.args.source),
            reason: escalationReasonFromIndex(event.args.reason) ?? String(event.args.reason),
          }),
        },
      ];
    case "TransferEscalated": {
      const escalationKey = event.args.escalationId.toLowerCase() as Hex;
      const held: NewEvidence = {
        ...base,
        kind: "execution",
        outcome: "escalated",
        logIndex: event.logIndex,
        escalationKey,
        details: details("escalated", {
          threshold: event.args.threshold.toString(),
          expiresAt: event.args.expiresAt.toString(),
          policyVersion: event.args.policyVersion.toString(),
        }),
      };
      const status = await readStatus(ctx, deps, {
        wallet: body.request.governedWalletAddress as Address,
        escalationKey,
        blockNumber: receipt.blockNumber,
      });
      if (!status) {
        return [held];
      }
      return [
        held,
        {
          ...base,
          kind: "escalation",
          outcome: ESCALATION_OUTCOMES[status],
          logIndex: null,
          escalationKey,
          details: details(ESCALATION_OUTCOMES[status], { status: status.toUpperCase() }),
        },
      ];
    }
  }
}

async function readStatus(
  ctx: ApiContext,
  deps: EvidenceDeps,
  query: Parameters<EvidenceDeps["readEscalationStatus"]>[1],
) {
  try {
    return await deps.readEscalationStatus(ctx, query);
  } catch (error) {
    throw new ReceiptError(
      "CHAIN_READ_FAILED",
      `Escalation ${query.escalationKey} could not be read from the escalation manager.`,
      { cause: error },
    );
  }
}

type WalletEvent = ParseEventLogsReturnType<
  typeof GuardedWalletAbi,
  ["TransferExecuted", "TransferEscalated", "Frozen"],
  true
>[number];

/**
 * The calldata already proved signer, vendor and amount; the event the wallet
 * emitted must say the same, so evidence never rests on the calldata alone.
 */
function eventMatchesReceipt(event: WalletEvent, body: StoredReceipt["envelope"]["receipt"]) {
  const request = body.request;
  if (event.args.wallet.toLowerCase() !== request.governedWalletAddress) {
    return false;
  }
  switch (event.eventName) {
    case "TransferExecuted":
      return (
        event.args.signer.toLowerCase() === request.agentSignerAddress &&
        event.args.to.toLowerCase() === request.vendorAddress &&
        event.args.amount.toString() === body.amountBaseUnits
      );
    case "TransferEscalated":
      return (
        event.args.to.toLowerCase() === request.vendorAddress &&
        event.args.amount.toString() === body.amountBaseUnits
      );
    case "Frozen":
      return true;
  }
}

/** Whether the agent named the receipt in the executeUSDC reason bytes. */
function calldataNamesReceipt(reasonBytes: Hex, receiptId: string, stored: StoredReceipt) {
  const text = safeHexToString(reasonBytes).toLowerCase();
  return text.includes(receiptId.toLowerCase()) || text.includes(stored.envelope.receiptDigest);
}

/**
 * The receipt id the SDK puts in the reason metadata (`{ reason, metadata:
 * { receiptId } }`), when the calldata carries one. Free-text reasons name
 * nothing, so they neither confirm nor contradict a receipt.
 */
function receiptNamedInCalldata(reasonBytes: Hex): string | null {
  const text = safeHexToString(reasonBytes);
  if (!text.startsWith("{")) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    const metadata =
      typeof parsed === "object" && parsed !== null
        ? (parsed as { metadata?: unknown }).metadata
        : undefined;
    const receiptId =
      typeof metadata === "object" && metadata !== null
        ? (metadata as { receiptId?: unknown }).receiptId
        : undefined;
    return typeof receiptId === "string" && receiptId.length > 0 ? receiptId.toLowerCase() : null;
  } catch {
    // Reason bytes that merely start with a brace are free text, not metadata.
    return null;
  }
}

function safeHexToString(value: Hex) {
  try {
    return hexToString(value);
  } catch {
    return "";
  }
}

/**
 * Whether the chain did what the receipt predicted. A revert only shows that
 * the transfer did not happen: for a `deny` that is consistent but unproven
 * (the call may have failed for gas, balance or any other reason), so it is
 * left `null`; for every other verdict it is a plain disagreement.
 */
function verdictMatches(verdict: string, outcome: string) {
  switch (outcome) {
    case "executed":
      return verdict === "allow";
    case "escalated":
      return verdict === "escalate";
    case "frozen":
      return verdict === "freeze";
    case "reverted":
      return verdict === "deny" ? null : false;
    default:
      return null;
  }
}

function isNotFound(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "TransactionNotFoundError" || error.name === "TransactionReceiptNotFoundError")
  );
}

function ctxChainName(ctx: ApiContext) {
  return ctx.publicClient.chain?.name ?? "the chain";
}
