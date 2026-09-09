import { GuardedWalletAbi } from "@arcanum/contracts";
import { testAgentAccount } from "@arcanum/shared/testing";
import {
  type Address,
  type Hex,
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  stringToHex,
} from "viem";
import { beforeEach, describe, expect, it } from "vitest";

import type { ApiContext } from "../context";
import type { SupabaseRow } from "../supabase/client";
import { type EvidenceDeps, attachPaymentReceiptEvidence } from "./evidence";
import { handleAttachEvidence } from "./http";
import { issuePaymentReceipt } from "./service";
import {
  type ChainState,
  RECEIPT_ID,
  VENDOR,
  WALLET,
  context,
  defaultChain,
  deps,
  normalized,
  signedIntent,
  walletRow,
} from "./test-support";

const TX_HASH = `0x${"77".repeat(32)}` as Hex;
const ESCALATION_ID = `0x${"99".repeat(32)}` as Hex;
const AMOUNT = 12_500_000n;

type FakeTx = {
  from: Address;
  to: Address | null;
  input: Hex;
  status: "success" | "reverted";
  logs: { address: Address; topics: Hex[]; data: Hex; logIndex: number }[];
};

type WalletEvent = "TransferExecuted" | "TransferEscalated" | "Frozen";

function eventLog(eventName: WalletEvent, args: Record<string, unknown>, logIndex = 3) {
  const item = GuardedWalletAbi.find(
    (entry) => entry.type === "event" && entry.name === eventName,
  ) as Extract<(typeof GuardedWalletAbi)[number], { type: "event" }>;
  const topics = encodeEventTopics({ abi: GuardedWalletAbi, eventName, args } as never) as Hex[];
  const unindexed = item.inputs.filter((input) => !input.indexed);
  const data = encodeAbiParameters(
    unindexed,
    unindexed.map((input) => args[input.name as string]),
  );
  return { address: WALLET, topics, data, logIndex };
}

function executeCall(overrides: Partial<{ to: Address; amount: bigint; reason: string }> = {}) {
  return encodeFunctionData({
    abi: GuardedWalletAbi,
    functionName: "executeUSDC",
    args: [
      overrides.to ?? VENDOR,
      overrides.amount ?? AMOUNT,
      stringToHex(overrides.reason ?? `Monthly API quota receipt:${RECEIPT_ID}`),
    ],
  });
}

function executedTx(overrides: Partial<FakeTx> = {}): FakeTx {
  return {
    from: testAgentAccount.address,
    to: WALLET,
    input: executeCall(),
    status: "success",
    logs: [
      eventLog("TransferExecuted", {
        wallet: WALLET,
        signer: testAgentAccount.address,
        to: VENDOR,
        amount: AMOUNT,
        escalationId: `0x${"00".repeat(32)}`,
      }),
    ],
    ...overrides,
  };
}

function withTransaction(ctx: ApiContext, tx: FakeTx | null): ApiContext {
  const notFound = (name: string) => Object.assign(new Error(`${name} simulated`), { name });
  const client = ctx.publicClient as unknown as Record<string, unknown>;
  ctx.publicClient = {
    ...client,
    chain: { name: "Arc Testnet" },
    async getTransaction() {
      if (!tx) {
        throw notFound("TransactionNotFoundError");
      }
      return { hash: TX_HASH, from: tx.from, to: tx.to, input: tx.input };
    },
    async getTransactionReceipt() {
      if (!tx) {
        throw notFound("TransactionReceiptNotFoundError");
      }
      return {
        transactionHash: TX_HASH,
        status: tx.status,
        blockNumber: 61_000_010n,
        logs: tx.logs.map((log) => ({
          ...log,
          blockNumber: 61_000_010n,
          transactionHash: TX_HASH,
          removed: false,
        })),
      };
    },
  } as unknown as ApiContext["publicClient"];
  return ctx;
}

type StatusQuery = Parameters<EvidenceDeps["readEscalationStatus"]>[1];
type StatusResult = Awaited<ReturnType<EvidenceDeps["readEscalationStatus"]>>;

function evidenceDeps(status: (query: StatusQuery) => Promise<StatusResult> = async () => null) {
  return { readEscalationStatus: (_ctx, query) => status(query) } satisfies EvidenceDeps;
}

describe("attachPaymentReceiptEvidence", () => {
  let tables: {
    governed_wallets: SupabaseRow[];
    payment_receipts: SupabaseRow[];
    payment_receipt_evidence: SupabaseRow[];
  };

  async function issued(chain: Partial<ChainState> = {}) {
    tables = {
      governed_wallets: [walletRow()],
      payment_receipts: [],
      payment_receipt_evidence: [],
    };
    const ctx = context({ tables, chain: { ...defaultChain(), ...chain } });
    await issuePaymentReceipt(ctx, normalized(await signedIntent()), deps());
    return ctx;
  }

  beforeEach(async () => {
    await issued();
  });

  it("records an executed transfer that matches the receipt", async () => {
    const ctx = withTransaction(context({ tables }), executedTx());

    const attached = await attachPaymentReceiptEvidence(
      ctx,
      { receiptId: RECEIPT_ID, txHash: TX_HASH.toUpperCase().replace("0X", "0x") },
      evidenceDeps(),
    );

    expect(attached.evidence).toHaveLength(1);
    expect(attached.evidence[0]).toMatchObject({
      receiptId: RECEIPT_ID,
      kind: "execution",
      outcome: "executed",
      txHash: TX_HASH,
      logIndex: 3,
      blockNumber: 61_000_010,
      calldataNamesReceipt: true,
      details: { receiptVerdict: "allow", verdictMatches: true },
    });
  });

  it("is idempotent for the same observation", async () => {
    const ctx = withTransaction(context({ tables }), executedTx());
    await attachPaymentReceiptEvidence(
      ctx,
      { receiptId: RECEIPT_ID, txHash: TX_HASH },
      evidenceDeps(),
    );
    const again = await attachPaymentReceiptEvidence(
      ctx,
      { receiptId: RECEIPT_ID, txHash: TX_HASH },
      evidenceDeps(),
    );

    expect(again.evidence).toHaveLength(1);
    expect(tables.payment_receipt_evidence).toHaveLength(1);
  });

  it("records a held transfer and appends the escalation's resolution later", async () => {
    await issued({ verdict: 1, reason: 4 });
    const held = executedTx({
      logs: [
        eventLog("TransferEscalated", {
          escalationId: ESCALATION_ID,
          wallet: WALLET,
          to: VENDOR,
          amount: AMOUNT,
          reason: stringToHex("Monthly API quota"),
          threshold: 2n,
          expiresAt: 1_789_100_000n,
          policyVersion: 3n,
          councilVersion: 1n,
        }),
      ],
    });
    const ctx = withTransaction(context({ tables }), held);

    const first = await attachPaymentReceiptEvidence(
      ctx,
      { receiptId: RECEIPT_ID, txHash: TX_HASH },
      evidenceDeps(async (query) => {
        expect(query).toEqual({
          wallet: WALLET,
          escalationKey: ESCALATION_ID,
          blockNumber: 61_000_010n,
        });
        return "pending";
      }),
    );
    expect(first.evidence.map((item) => [item.kind, item.outcome, item.escalationKey])).toEqual([
      ["execution", "escalated", ESCALATION_ID],
      ["escalation", "pending", ESCALATION_ID],
    ]);
    expect(first.evidence[0]?.details).toMatchObject({
      receiptVerdict: "escalate",
      verdictMatches: true,
      threshold: "2",
    });

    const second = await attachPaymentReceiptEvidence(
      ctx,
      { receiptId: RECEIPT_ID, txHash: TX_HASH },
      evidenceDeps(async () => "executed"),
    );
    expect(second.evidence.map((item) => item.outcome)).toEqual([
      "escalated",
      "pending",
      "released",
    ]);
  });

  it("records a freeze with its source and reason", async () => {
    await issued({ verdict: 3, reason: 5 });
    const frozen = executedTx({
      logs: [
        eventLog("Frozen", {
          wallet: WALLET,
          source: 0,
          reason: 5,
          data: stringToHex("Monthly API quota"),
        }),
      ],
    });
    const ctx = withTransaction(context({ tables }), frozen);

    const attached = await attachPaymentReceiptEvidence(
      ctx,
      { receiptId: RECEIPT_ID, txHash: TX_HASH },
      evidenceDeps(),
    );

    expect(attached.evidence[0]).toMatchObject({
      outcome: "frozen",
      details: { source: "POLICY", reason: "BLOCKED_VENDOR", verdictMatches: true },
    });
  });

  it("records a reverted call and flags a verdict the chain disagreed with", async () => {
    const ctx = withTransaction(context({ tables }), executedTx({ status: "reverted", logs: [] }));

    const attached = await attachPaymentReceiptEvidence(
      ctx,
      { receiptId: RECEIPT_ID, txHash: TX_HASH },
      evidenceDeps(),
    );

    expect(attached.evidence[0]).toMatchObject({
      outcome: "reverted",
      logIndex: null,
      details: { receiptVerdict: "allow", verdictMatches: false },
    });
  });

  it("refuses transactions that do not belong to the receipt", async () => {
    const cases: [Partial<FakeTx>, string][] = [
      [{ from: "0x9999999999999999999999999999999999999999" }, "agent signer"],
      [{ to: "0x9999999999999999999999999999999999999999" }, "receipt's wallet"],
      [{ input: executeCall({ amount: AMOUNT + 1n }) }, "different vendor or amount"],
      [
        {
          input: executeCall({ to: "0x9999999999999999999999999999999999999999" }),
        },
        "different vendor or amount",
      ],
      [{ input: "0x12345678" }, "not call a GuardedWallet function"],
      [{ logs: [] }, "emitted no transfer"],
    ];
    for (const [overrides, message] of cases) {
      const ctx = withTransaction(context({ tables }), executedTx(overrides));
      await expect(
        attachPaymentReceiptEvidence(
          ctx,
          { receiptId: RECEIPT_ID, txHash: TX_HASH },
          evidenceDeps(),
        ),
      ).rejects.toMatchObject({
        code: "EVIDENCE_MISMATCH",
        message: expect.stringContaining(message),
      });
    }
    expect(tables.payment_receipt_evidence).toHaveLength(0);
  });

  it("tells the caller to wait when the transaction is not mined yet", async () => {
    const ctx = withTransaction(context({ tables }), null);

    await expect(
      attachPaymentReceiptEvidence(ctx, { receiptId: RECEIPT_ID, txHash: TX_HASH }, evidenceDeps()),
    ).rejects.toMatchObject({ code: "TRANSACTION_NOT_FOUND", httpStatus: 404 });
  });

  it("rejects malformed hashes and unknown receipts", async () => {
    const ctx = withTransaction(context({ tables }), executedTx());

    await expect(
      attachPaymentReceiptEvidence(
        ctx,
        { receiptId: RECEIPT_ID, txHash: "0x1234" },
        evidenceDeps(),
      ),
    ).rejects.toMatchObject({ code: "INVALID_TRANSACTION_HASH" });
    await expect(
      attachPaymentReceiptEvidence(
        ctx,
        { receiptId: "00000000-0000-4000-8000-000000000000", txHash: TX_HASH },
        evidenceDeps(),
      ),
    ).rejects.toMatchObject({ code: "RECEIPT_NOT_FOUND" });
  });

  it("links what happened to a denied receipt, agreeing or not", async () => {
    await issued({ verdict: 2, reason: 2 });
    const ignored = await attachPaymentReceiptEvidence(
      withTransaction(context({ tables }), executedTx({ status: "reverted", logs: [] })),
      { receiptId: RECEIPT_ID, txHash: TX_HASH },
      evidenceDeps(),
    );
    expect(ignored.evidence[0]).toMatchObject({
      outcome: "reverted",
      details: { receiptVerdict: "deny", verdictMatches: true },
    });

    // The policy was loosened after issuance and the same call went through.
    const loosened = await attachPaymentReceiptEvidence(
      withTransaction(context({ tables }), executedTx()),
      { receiptId: RECEIPT_ID, txHash: TX_HASH },
      evidenceDeps(),
    );
    expect(loosened.evidence.map((item) => item.outcome)).toEqual(["reverted", "executed"]);
    expect(loosened.evidence[1]?.details).toMatchObject({ verdictMatches: false });
  });

  it("serves the REST route with the same semantics", async () => {
    const ctx = withTransaction(context({ tables }), executedTx());

    const ok = await handleAttachEvidence(
      new Request(`https://arcanum.test/api/receipts/${RECEIPT_ID}/evidence`, {
        method: "POST",
        body: JSON.stringify({ txHash: TX_HASH }),
      }),
      ctx,
      RECEIPT_ID,
      evidenceDeps(),
    );
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { evidence: unknown[] }).evidence).toHaveLength(1);

    const badId = await handleAttachEvidence(
      new Request("https://arcanum.test/api/receipts/not-a-uuid/evidence", {
        method: "POST",
        body: JSON.stringify({ txHash: TX_HASH }),
      }),
      ctx,
      "not-a-uuid",
      evidenceDeps(),
    );
    expect(badId.status).toBe(400);
  });
});
