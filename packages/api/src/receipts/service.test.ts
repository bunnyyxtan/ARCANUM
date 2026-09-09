import {
  type PaymentReceiptEnvelope,
  paymentReceiptEnvelopeSchema,
  verifyPaymentReceipt,
} from "@arcanum/shared";
import { testAgentAccount, testIssuer } from "@arcanum/shared/testing";
import { beforeEach, describe, expect, it } from "vitest";
import type { ApiContext } from "../context";
import type { SupabaseRow } from "../supabase/client";

import { ReceiptError } from "./errors";
import { handleCreateReceipt } from "./http";
import { issuePaymentReceipt, listPaymentReceipts, readPaymentReceipt } from "./service";
import {
  ORG_ID,
  OWNER,
  RECEIPT_ID,
  type Tables,
  WALLET,
  WALLET_ID,
  context,
  defaultChain,
  deps,
  normalized,
  session,
  signedIntent,
  walletRow,
} from "./test-support";

describe("issuePaymentReceipt", () => {
  let tables: Tables;
  beforeEach(() => {
    tables = { governed_wallets: [walletRow()], payment_receipts: [] };
  });

  it("issues a receipt that verifies against the issuer registry", async () => {
    const log = { policyEngineCalls: [] as unknown[] };
    const ctx = context({ tables, log });
    const intent = await signedIntent();

    const issued = await issuePaymentReceipt(ctx, normalized(intent), deps());

    expect(issued.replayed).toBe(false);
    expect(paymentReceiptEnvelopeSchema.safeParse(issued.receipt).success).toBe(true);
    const body = issued.receipt.receipt;
    expect(body.receiptId).toBe(RECEIPT_ID);
    expect(body.decision).toEqual({
      verdict: "allow",
      reasonCode: "NONE",
      explanation: expect.stringContaining("Within the per-transaction"),
    });
    expect(body.amountBaseUnits).toBe("12500000");
    expect(body.evaluation.blockNumber).toBe("61000000");
    expect(body.evaluation.policyVersion).toBe("3");
    expect(body.evaluation.spend.effectiveDailySpent).toBe("1000000");
    expect(body.request.signature).toBe(intent.signature.toLowerCase());

    const verification = await verifyPaymentReceipt(issued.receipt, { issuers: [testIssuer] });
    expect(verification.ok).toBe(true);
    expect(verification.issuer).toMatchObject({ status: "verified", issuer: testIssuer });
    expect(verification.request.status).toBe("verified");

    expect(tables.payment_receipts).toHaveLength(1);
    expect(tables.payment_receipts[0]?.governed_wallet_id).toBe(WALLET_ID);
    expect(tables.payment_receipts[0]?.organization_id).toBe(ORG_ID);
    expect(log.policyEngineCalls).toHaveLength(1);
  });

  it("feeds the policy engine the rolled-over counters, as executeUSDC would", async () => {
    const log = { policyEngineCalls: [] as unknown[] };
    const chain = { ...defaultChain(), dailySpent: 400_000_000n, spendDay: 1n };
    const ctx = context({ tables, chain, log });

    const issued = await issuePaymentReceipt(ctx, normalized(await signedIntent()), deps());

    const args = log.policyEngineCalls[0] as unknown[];
    expect(args[3]).toBe(0n);
    expect(issued.receipt.receipt.evaluation.spend).toMatchObject({
      dailySpent: "400000000",
      spendDay: "1",
      effectiveDailySpent: "0",
    });
  });

  it("attests escalations, denials and freezes with the engine's reason", async () => {
    for (const [verdict, reason, expected] of [
      [1, 4, "escalate"],
      [2, 2, "deny"],
      [3, 5, "freeze"],
    ] as const) {
      const ctx = context({ tables, chain: { ...defaultChain(), verdict, reason } });
      const issued = await issuePaymentReceipt(
        ctx,
        normalized(await signedIntent({ reference: `ref-${verdict}-0000` })),
        deps(),
      );
      expect(issued.receipt.receipt.decision.verdict).toBe(expected);
    }
    expect(tables.payment_receipts.map((row) => row.reason_code)).toEqual([
      "ESCALATION_THRESHOLD",
      "PER_TX_CAP",
      "BLOCKED_VENDOR",
    ]);
  });

  it("attests a frozen wallet without asking the policy engine", async () => {
    const log = { policyEngineCalls: [] as unknown[] };
    const ctx = context({ tables, chain: { ...defaultChain(), frozen: true }, log });

    const issued = await issuePaymentReceipt(ctx, normalized(await signedIntent()), deps());

    expect(issued.receipt.receipt.decision).toMatchObject({
      verdict: "freeze",
      reasonCode: "WALLET_FROZEN",
    });
    expect(log.policyEngineCalls).toHaveLength(0);
  });

  it("returns the stored receipt when the same signed intent is replayed", async () => {
    const ctx = context({ tables });
    const intent = normalized(await signedIntent());

    const first = await issuePaymentReceipt(ctx, intent, deps());
    const second = await issuePaymentReceipt(ctx, intent, deps());

    expect(second.replayed).toBe(true);
    expect(second.receipt).toEqual(first.receipt);
    expect(tables.payment_receipts).toHaveLength(1);
  });

  it("refuses to reuse a reference for a different payment", async () => {
    const ctx = context({ tables });
    await issuePaymentReceipt(ctx, normalized(await signedIntent()), deps());

    await expect(
      issuePaymentReceipt(ctx, normalized(await signedIntent({ amount: "13" })), deps()),
    ).rejects.toMatchObject({ code: "REQUEST_KEY_CONFLICT", httpStatus: 409 });
    expect(tables.payment_receipts).toHaveLength(1);
  });

  it("serves the winning row when two requests race on the unique key", async () => {
    const ctx = context({ tables });
    const intent = normalized(await signedIntent());
    const supabase = ctx.supabase as NonNullable<ApiContext["supabase"]>;
    const originalSelect = supabase.selectRows;
    let raced = false;
    supabase.selectRows = async (table, options) => {
      const rows = await originalSelect(table, options);
      // First idempotency lookup sees nothing; a concurrent writer then lands.
      if (table === "payment_receipts" && !raced) {
        raced = true;
        const rival = await issuePaymentReceipt(
          { ...ctx, supabase: { ...supabase, selectRows: originalSelect } },
          intent,
          deps(),
        );
        expect(rival.replayed).toBe(false);
        return rows;
      }
      return rows;
    };

    const issued = await issuePaymentReceipt(ctx, intent, deps());

    expect(issued.replayed).toBe(true);
    expect(tables.payment_receipts).toHaveLength(1);
    expect(issued.receipt.receipt.receiptId).toBe(tables.payment_receipts[0]?.id);
  });

  it("rejects a signature that does not match the intent, before touching the store", async () => {
    const ctx = context({ tables });
    const intent = normalized(await signedIntent());
    const tampered = { ...intent, amount: "99" };

    await expect(issuePaymentReceipt(ctx, tampered, deps())).rejects.toMatchObject({
      code: "SIGNATURE_INVALID",
      httpStatus: 400,
    });
    expect(tables.payment_receipts).toHaveLength(0);
  });

  it("gives an unauthorized signer no receipt at all", async () => {
    const ctx = context({ tables, chain: { ...defaultChain(), signerAuthorized: false } });

    await expect(
      issuePaymentReceipt(ctx, normalized(await signedIntent()), deps()),
    ).rejects.toMatchObject({ code: "AGENT_NOT_AUTHORIZED", httpStatus: 403 });
    expect(tables.payment_receipts).toHaveLength(0);
  });

  it("rejects intents the chain would revert or the receipt could not describe", async () => {
    const ctx = context({ tables });

    await expect(
      issuePaymentReceipt(
        ctx,
        normalized(
          await signedIntent({ vendorAddress: "0x0000000000000000000000000000000000000000" }),
        ),
        deps(),
      ),
    ).rejects.toMatchObject({ code: "INVALID_RECIPIENT", httpStatus: 400 });
    await expect(
      issuePaymentReceipt(ctx, normalized(await signedIntent({ tokenSymbol: "EURC" })), deps()),
    ).rejects.toMatchObject({ code: "UNSUPPORTED_TOKEN", httpStatus: 400 });
    expect(tables.payment_receipts).toHaveLength(0);
  });

  it("refuses wallets the read model does not know or that have no workspace", async () => {
    tables.governed_wallets = [{ ...walletRow(), organization_id: null }];
    await expect(
      issuePaymentReceipt(context({ tables }), normalized(await signedIntent()), deps()),
    ).rejects.toMatchObject({ code: "WALLET_NOT_REGISTERED", httpStatus: 404 });

    tables.governed_wallets = [];
    const ctx = context({ tables });
    await expect(
      issuePaymentReceipt(ctx, normalized(await signedIntent()), deps()),
    ).rejects.toMatchObject({ code: "WALLET_NOT_REGISTERED", httpStatus: 404 });
  });

  it("fails explicitly when the issuer key is missing or unregistered", async () => {
    const ctx = context({ tables });
    const intent = normalized(await signedIntent());

    await expect(
      issuePaymentReceipt(
        ctx,
        intent,
        deps({
          issuer: () => {
            throw new ReceiptError("RECEIPT_ISSUER_NOT_CONFIGURED", "unset");
          },
        }),
      ),
    ).rejects.toMatchObject({ code: "RECEIPT_ISSUER_NOT_CONFIGURED", httpStatus: 503 });
    expect(tables.payment_receipts).toHaveLength(0);
  });

  it("reports a store outage instead of inventing an empty result", async () => {
    const ctx = context({ tables });
    const supabase = ctx.supabase as NonNullable<ApiContext["supabase"]>;
    supabase.selectRows = () => Promise.reject(new Error("connect ECONNREFUSED"));

    await expect(
      issuePaymentReceipt(ctx, normalized(await signedIntent()), deps()),
    ).rejects.toMatchObject({ code: "RECEIPT_STORE_UNAVAILABLE", httpStatus: 503 });
  });

  it("does not persist anything when the chain read fails", async () => {
    const ctx = context({ tables });
    ctx.publicClient = {
      getBlock: () => Promise.reject(new Error("rpc down")),
    } as unknown as ApiContext["publicClient"];

    await expect(
      issuePaymentReceipt(ctx, normalized(await signedIntent()), deps()),
    ).rejects.toMatchObject({ code: "CHAIN_READ_FAILED", httpStatus: 502 });
    expect(tables.payment_receipts).toHaveLength(0);
  });
});

describe("receipt access", () => {
  let tables: Tables & { payment_receipt_evidence: SupabaseRow[] };
  let envelope: PaymentReceiptEnvelope;

  beforeEach(async () => {
    tables = {
      governed_wallets: [walletRow()],
      payment_receipts: [],
      payment_receipt_evidence: [],
    };
    const issued = await issuePaymentReceipt(
      context({ tables }),
      normalized(await signedIntent()),
      deps(),
    );
    envelope = issued.receipt;
  });

  it("lets the wallet owner read and list the receipt", async () => {
    const ctx = context({ tables, session: session(OWNER) });

    const read = await readPaymentReceipt(ctx, RECEIPT_ID, deps());
    expect(read.receipt).toEqual(envelope);
    expect(read.wallet?.label).toBe("Ops wallet");

    const listed = await listPaymentReceipts(ctx, { limit: 25 });
    expect(listed.items.map((item) => item.receipt.receipt.receiptId)).toEqual([RECEIPT_ID]);
    expect(listed.nextCursor).toBeNull();
  });

  it("lets the requesting agent signer see its own receipt", async () => {
    const ctx = context({ tables, session: session(testAgentAccount.address) });

    const read = await readPaymentReceipt(ctx, RECEIPT_ID, deps());
    expect(read.receipt.receiptDigest).toBe(envelope.receiptDigest);
    expect(read.wallet).toBeNull();

    const listed = await listPaymentReceipts(ctx, { limit: 25 });
    expect(listed.items).toHaveLength(1);
  });

  it("lets an onchain council member read but not list", async () => {
    const council = "0x7777777777777777777777777777777777777777";
    const ctx = context({ tables, session: session(council) });
    const councilDeps = deps({
      isCouncilMember: async (wallet, caller) => wallet === WALLET && caller === council,
    });

    await expect(readPaymentReceipt(ctx, RECEIPT_ID, councilDeps)).resolves.toMatchObject({
      receipt: envelope,
    });
    await expect(listPaymentReceipts(ctx, { limit: 25 })).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it("hides receipts from strangers as not found", async () => {
    const ctx = context({ tables, session: session("0x9999999999999999999999999999999999999999") });

    await expect(readPaymentReceipt(ctx, RECEIPT_ID, deps())).rejects.toMatchObject({
      code: "RECEIPT_NOT_FOUND",
    });
  });
});

describe("REST handler", () => {
  it("issues a receipt over plain HTTP and reports domain errors as JSON", async () => {
    const tables = { governed_wallets: [walletRow()], payment_receipts: [] };
    const ctx = context({ tables });
    const intent = await signedIntent();
    const request = () =>
      new Request("https://arcanum.test/api/receipts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(intent),
      });

    const created = await handleCreateReceipt(request(), ctx, deps());
    expect(created.status).toBe(201);
    const payload = (await created.json()) as { receipt: unknown; replayed: boolean };
    expect(paymentReceiptEnvelopeSchema.safeParse(payload.receipt).success).toBe(true);

    const replayed = await handleCreateReceipt(request(), ctx, deps());
    expect(replayed.status).toBe(200);
    expect(((await replayed.json()) as { replayed: boolean }).replayed).toBe(true);

    const conflict = await handleCreateReceipt(
      new Request("https://arcanum.test/api/receipts", {
        method: "POST",
        body: JSON.stringify(await signedIntent({ amount: "1" })),
      }),
      ctx,
      deps(),
    );
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({
      error: { code: "REQUEST_KEY_CONFLICT", message: expect.stringContaining("inv-2026-09-0001") },
    });

    const malformed = await handleCreateReceipt(
      new Request("https://arcanum.test/api/receipts", { method: "POST", body: "{not json" }),
      ctx,
      deps(),
    );
    expect(malformed.status).toBe(400);
    expect(((await malformed.json()) as { error: { code: string } }).error.code).toBe(
      "INVALID_REQUEST",
    );
  });
});
