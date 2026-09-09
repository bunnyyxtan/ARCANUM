import { randomUUID } from "node:crypto";

import type { Wallet } from "@arcanum/db/schema";
import {
  ARC_NETWORK_NAME,
  type NormalizedSignedPaymentIntentInput,
  PAYMENT_RECEIPT_ISSUERS,
  PAYMENT_RECEIPT_SCHEMA_V1,
  type PaymentReceiptBody,
  type PaymentReceiptEnvelope,
  type PaymentReceiptEvidence,
  paymentRequestDigest,
  signPaymentReceipt,
} from "@arcanum/shared";
import { TRPCError } from "@trpc/server";
import type { Address } from "viem";

import { isWalletCouncilMember } from "../chain";
import type { ApiContext } from "../context";
import { readSupabaseWalletByAddressUnscoped, readSupabaseWallets } from "../supabase/wallets";
import { ReceiptError } from "./errors";
import { evaluatePaymentIntentAtBlock, verifyPaymentIntentSignature } from "./evaluation";
import { type ReceiptIssuer, resolveReceiptIssuer } from "./issuer";
import {
  type StoredReceipt,
  findStoredReceiptByKey,
  insertStoredReceipt,
  listStoredReceipts,
  readReceiptEvidence,
  readStoredReceipt,
} from "./store";

export type ReceiptServiceDeps = Readonly<{
  issuer: () => ReceiptIssuer;
  now: () => Date;
  receiptId: () => string;
  isCouncilMember: (wallet: Address, caller: Address) => Promise<boolean>;
}>;

export const defaultReceiptServiceDeps: ReceiptServiceDeps = {
  issuer: () => resolveReceiptIssuer(),
  now: () => new Date(),
  receiptId: () => randomUUID(),
  isCouncilMember: isWalletCouncilMember,
};

export type IssuedReceipt = Readonly<{
  receipt: PaymentReceiptEnvelope;
  /** True when the signed reference was already attested and the stored receipt was returned. */
  replayed: boolean;
}>;

/**
 * Issue a signed decision receipt for a signed payment intent.
 *
 * The order matters: the request is authenticated (agent signature), the
 * issuer is resolved, the idempotency key is checked, the wallet must be one
 * the read model knows, and only then is the chain consulted. Nothing is
 * persisted unless the policy engine produced a verdict this build can name.
 */
export async function issuePaymentReceipt(
  ctx: ApiContext,
  intent: NormalizedSignedPaymentIntentInput,
  deps: ReceiptServiceDeps = defaultReceiptServiceDeps,
): Promise<IssuedReceipt> {
  if (!(await verifyPaymentIntentSignature(intent))) {
    throw new ReceiptError(
      "SIGNATURE_INVALID",
      "Agent signer signature did not match this payment intent.",
    );
  }

  const issuer = deps.issuer();
  const requestDigest = paymentRequestDigest(intent);
  const requestKey = {
    chainId: intent.chainId,
    walletAddress: intent.governedWalletAddress,
    agentSignerAddress: intent.agentSignerAddress,
    reference: intent.reference,
  };

  const existing = await findStoredReceiptByKey(ctx, requestKey);
  if (existing) {
    return replayOrConflict(existing, requestDigest);
  }

  if (intent.tokenSymbol !== undefined && intent.tokenSymbol !== "USDC") {
    // The receipt attests the token by symbol as well as address; the two
    // must agree before anything is signed.
    throw new ReceiptError(
      "UNSUPPORTED_TOKEN",
      `Token symbol ${intent.tokenSymbol} does not match the ${ARC_NETWORK_NAME} USDC address.`,
    );
  }

  const wallet = await readRegisteredWallet(ctx, intent.governedWalletAddress);
  const evaluation = await evaluatePaymentIntentAtBlock(ctx.publicClient, intent);
  if (!evaluation.state.signerAuthorized) {
    // An unauthorized signer gets no receipt at all: a signed "deny" would
    // still be a signed statement about a wallet the caller has no standing on.
    throw new ReceiptError(
      "AGENT_NOT_AUTHORIZED",
      "The agent signer is not authorized for this governed wallet.",
    );
  }

  const { state, decision } = evaluation;
  const body: PaymentReceiptBody = {
    schema: PAYMENT_RECEIPT_SCHEMA_V1,
    receiptId: deps.receiptId(),
    issuedAt: deps.now().toISOString(),
    issuer: { keyId: issuer.keyId, address: issuer.address },
    request: {
      chainId: intent.chainId,
      governedWalletAddress: intent.governedWalletAddress,
      agentSignerAddress: intent.agentSignerAddress,
      vendorAddress: intent.vendorAddress,
      tokenAddress: intent.tokenAddress,
      ...(intent.tokenSymbol ? { tokenSymbol: intent.tokenSymbol } : {}),
      amount: intent.amount,
      purpose: intent.purpose,
      reference: intent.reference,
      signature: intent.signature,
    },
    requestDigest,
    amountBaseUnits: evaluation.amount.toString(),
    decision,
    evaluation: {
      blockNumber: state.block.number.toString(),
      blockHash: state.block.hash.toLowerCase() as `0x${string}`,
      blockTimestamp: Number(state.block.timestamp),
      evaluatedAt: evaluation.evaluatedAt.toISOString(),
      policyVersion: state.policyVersion.toString(),
      policyEngine: state.policyEngine.toLowerCase() as `0x${string}`,
      vendorRegistry: state.vendorRegistry.toLowerCase() as `0x${string}`,
      escalationManager: state.escalationManager.toLowerCase() as `0x${string}`,
      policy: {
        perTxCap: state.policy.perTxCap.toString(),
        daily24hCap: state.policy.daily24hCap.toString(),
        monthlyCap: state.policy.monthlyCap.toString(),
        allowedCategories: state.policy.allowedCategories.toString(),
        escalationThreshold: state.policy.escalationThreshold.toString(),
        requireAllowlist: state.policy.requireAllowlist,
        freezeOnBlockedVendor: state.policy.freezeOnBlockedVendor,
      },
      signerAuthorized: state.signerAuthorized,
      frozen: state.frozen,
      vendor: {
        allowed: state.vendor.allowed,
        blocked: state.vendor.blocked,
        category: state.vendor.category,
        perVendorCap: state.vendor.perVendorCap.toString(),
      },
      spend: {
        spendDay: state.spend.spendDay.toString(),
        spendMonth: state.spend.spendMonth.toString(),
        dailySpent: state.spend.dailySpent.toString(),
        monthlySpent: state.spend.monthlySpent.toString(),
        blockDay: state.spend.blockDay.toString(),
        blockMonth: state.spend.blockMonth.toString(),
        effectiveDailySpent: state.spend.effectiveDailySpent.toString(),
        effectiveMonthlySpent: state.spend.effectiveMonthlySpent.toString(),
      },
      usdcBalance: state.usdcBalance.toString(),
    },
  };

  const envelope = await signPaymentReceipt(body, issuer.signMessage);
  const stored: StoredReceipt = {
    envelope,
    walletId: wallet.id,
    orgId: wallet.orgId,
    createdAt: body.issuedAt,
  };

  const outcome = await insertStoredReceipt(ctx, stored);
  if (outcome === "inserted") {
    return { receipt: envelope, replayed: false };
  }

  // Two concurrent requests for the same reference: exactly one row won the
  // unique key. Serve that row so both callers hold the same receipt.
  const winner = await findStoredReceiptByKey(ctx, requestKey);
  if (!winner) {
    throw new ReceiptError(
      "RECEIPT_STORE_UNAVAILABLE",
      "The receipt store reported a duplicate reference but returned no receipt for it.",
    );
  }
  return replayOrConflict(winner, requestDigest);
}

function replayOrConflict(stored: StoredReceipt, requestDigest: `0x${string}`): IssuedReceipt {
  if (stored.envelope.receipt.requestDigest === requestDigest) {
    return { receipt: stored.envelope, replayed: true };
  }
  throw new ReceiptError(
    "REQUEST_KEY_CONFLICT",
    `Reference ${stored.envelope.receipt.request.reference} was already attested for a different payment intent. Use a new reference for a new payment.`,
  );
}

export type ReceiptWithEvidence = Readonly<{
  receipt: PaymentReceiptEnvelope;
  evidence: PaymentReceiptEvidence[];
  wallet: Readonly<{ id: string; label: string; ownerAddress: string }> | null;
  createdAt: string;
}>;

/**
 * A receipt is readable by anyone who can see the wallet in the dashboard,
 * by the agent signer who requested it, and by the wallet's onchain council
 * (approvers need the receipt to judge an escalation they did not request).
 */
export async function readPaymentReceipt(
  ctx: ApiContext,
  receiptId: string,
  deps: ReceiptServiceDeps = defaultReceiptServiceDeps,
): Promise<ReceiptWithEvidence> {
  const caller = requireCaller(ctx);
  const stored = await readStoredReceipt(ctx, receiptId);
  if (!stored) {
    throw new ReceiptError("RECEIPT_NOT_FOUND", `Receipt ${receiptId} was not found.`);
  }

  const request = stored.envelope.receipt.request;
  const visibleWallets = await readSupabaseWallets(ctx);
  const wallet = visibleWallets.find((item) => item.id === stored.walletId) ?? null;
  const allowed =
    wallet !== null ||
    request.agentSignerAddress === caller ||
    (await deps.isCouncilMember(request.governedWalletAddress as Address, caller));
  if (!allowed) {
    // Indistinguishable from a missing receipt on purpose: receipt ids must
    // not leak which wallets exist.
    throw new ReceiptError("RECEIPT_NOT_FOUND", `Receipt ${receiptId} was not found.`);
  }

  const evidence = await readReceiptEvidence(ctx, receiptId);
  return {
    receipt: stored.envelope,
    evidence,
    wallet: wallet
      ? { id: wallet.id, label: wallet.label, ownerAddress: wallet.ownerAddress }
      : null,
    createdAt: stored.createdAt,
  };
}

export type ReceiptListItem = Readonly<{
  receipt: PaymentReceiptEnvelope;
  walletLabel: string | null;
  createdAt: string;
}>;

export async function listPaymentReceipts(
  ctx: ApiContext,
  query: Readonly<{ limit: number; before?: { createdAt: string; id: string } }>,
): Promise<{ items: ReceiptListItem[]; nextCursor: { createdAt: string; id: string } | null }> {
  const caller = requireCaller(ctx);
  const wallets = await readSupabaseWallets(ctx);
  const labels = new Map(wallets.map((wallet) => [wallet.id, wallet.label]));

  const rows = await listStoredReceipts(ctx, {
    walletIds: wallets.map((wallet) => wallet.id),
    agentSignerAddress: caller,
    limit: query.limit,
    before: query.before,
  });

  const items = rows.map((row) => ({
    receipt: row.envelope,
    walletLabel: labels.get(row.walletId) ?? null,
    createdAt: row.createdAt,
  }));
  const last = rows.at(-1);
  return {
    items,
    nextCursor:
      last && rows.length === query.limit
        ? { createdAt: last.createdAt, id: last.envelope.receipt.receiptId }
        : null,
  };
}

export function listReceiptIssuers() {
  return PAYMENT_RECEIPT_ISSUERS.map((issuer) => ({ ...issuer }));
}

async function readRegisteredWallet(ctx: ApiContext, address: Address): Promise<Wallet> {
  let wallet: Wallet | null;
  try {
    wallet = await readSupabaseWalletByAddressUnscoped(ctx, address);
  } catch (error) {
    throw new ReceiptError(
      "RECEIPT_STORE_UNAVAILABLE",
      "The wallet registry is unavailable, so the receipt cannot be issued right now.",
      { cause: error instanceof TRPCError ? (error.cause ?? error) : error },
    );
  }
  if (!wallet) {
    throw new ReceiptError(
      "WALLET_NOT_REGISTERED",
      `Governed wallet ${address} is not registered with this Arcanum deployment.`,
    );
  }
  if (!wallet.orgId) {
    // Receipts are tenant-scoped rows; a wallet outside any workspace cannot
    // own one, and inventing an owner for it is not an option.
    throw new ReceiptError(
      "WALLET_NOT_REGISTERED",
      `Governed wallet ${address} is not attached to a workspace, so receipts cannot be issued for it.`,
    );
  }
  return wallet;
}

function requireCaller(ctx: ApiContext): Address {
  const caller = ctx.session?.walletAddress.toLowerCase();
  if (!caller) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in to view receipts." });
  }
  return caller as Address;
}
