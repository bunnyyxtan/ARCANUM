import { describe, expect, it } from "vitest";

import { paymentReceiptDigest } from "./digest";
import { signedTestReceipt, testIssuer, testIssuerAccount } from "./test-fixtures";
import { verifyPaymentReceipt } from "./verify";

const issuers = [testIssuer];

describe("verifyPaymentReceipt", () => {
  it("accepts a receipt signed by a trusted issuer over an agent-signed request", async () => {
    const envelope = await signedTestReceipt();
    const result = await verifyPaymentReceipt(envelope, { issuers });

    expect(result.ok).toBe(true);
    expect(result.receiptDigest).toMatchObject({
      status: "verified",
      digest: envelope.receiptDigest,
    });
    expect(result.issuer).toMatchObject({ status: "verified", issuer: testIssuer });
    expect(result.request).toMatchObject({ status: "verified" });
  });

  it("survives a JSON round trip with reordered keys", async () => {
    const envelope = await signedTestReceipt();
    const reordered = JSON.parse(
      JSON.stringify({
        signature: envelope.signature,
        receiptDigest: envelope.receiptDigest,
        receipt: { ...envelope.receipt, schema: envelope.receipt.schema },
      }),
    );
    expect((await verifyPaymentReceipt(reordered, { issuers })).ok).toBe(true);
  });

  it("flags a body edited after signing even when the digest is recomputed", async () => {
    const envelope = await signedTestReceipt();
    const tampered = {
      ...envelope,
      receipt: {
        ...envelope.receipt,
        decision: { ...envelope.receipt.decision, verdict: "deny" as const },
      },
    };
    const stale = await verifyPaymentReceipt(tampered, { issuers });
    expect(stale.ok).toBe(false);
    expect(stale.receiptDigest.status).toBe("mismatch");
    expect(stale.issuer.status).toBe("invalid_signature");

    const recomputed = { ...tampered, receiptDigest: paymentReceiptDigest(tampered.receipt) };
    const result = await verifyPaymentReceipt(recomputed, { issuers });
    expect(result.ok).toBe(false);
    expect(result.receiptDigest.status).toBe("verified");
    expect(result.issuer.status).toBe("invalid_signature");
    // The agent's signature is untouched and still verifies independently.
    expect(result.request.status).toBe("verified");
  });

  it("reports an issuer key it has not been told to trust", async () => {
    const envelope = await signedTestReceipt();
    const result = await verifyPaymentReceipt(envelope, { issuers: [] });
    expect(result.ok).toBe(false);
    expect(result.issuer).toMatchObject({ status: "unknown_issuer", keyId: testIssuer.keyId });
    expect(result.request.status).toBe("verified");
  });

  it("does not trust the issuer address written inside the receipt", async () => {
    const envelope = await signedTestReceipt();
    const impostor = { ...testIssuer, address: `0x${"77".repeat(20)}` as const };
    const result = await verifyPaymentReceipt(envelope, { issuers: [impostor] });
    expect(result.issuer).toMatchObject({
      status: "issuer_mismatch",
      claimed: testIssuerAccount.address.toLowerCase(),
    });
  });

  it("reports a receipt issued after the key was retired", async () => {
    const envelope = await signedTestReceipt();
    const retired = { ...testIssuer, retiredAt: "2026-09-01T00:00:00Z" };
    const result = await verifyPaymentReceipt(envelope, { issuers: [retired] });
    expect(result.issuer.status).toBe("issuer_retired");
  });

  it("refuses a key attesting decisions for a chain it is not registered for", async () => {
    const envelope = await signedTestReceipt();
    const otherChain = { ...testIssuer, chainId: 1 };
    const result = await verifyPaymentReceipt(envelope, { issuers: [otherChain] });
    expect(result.issuer).toMatchObject({ status: "issuer_chain_mismatch", chainId: 5042002 });
  });

  it("detects a request whose agent signature does not match its fields", async () => {
    const envelope = await signedTestReceipt();
    const forged = {
      ...envelope.receipt,
      request: { ...envelope.receipt.request, amount: "9999.000000" },
      amountBaseUnits: "9999000000",
    };
    const requestDigestOnly = await verifyPaymentReceipt(
      { ...envelope, receipt: forged, receiptDigest: paymentReceiptDigest(forged) },
      { issuers },
    );
    expect(requestDigestOnly.request.status).toBe("digest_mismatch");
  });

  it("detects base units that disagree with the signed decimal amount", async () => {
    const envelope = await signedTestReceipt({ amountBaseUnits: "12500001" });
    const result = await verifyPaymentReceipt(envelope, { issuers });
    expect(result.request).toMatchObject({
      status: "amount_mismatch",
      expected: "12500000",
      computed: "12500001",
    });
  });

  it("rejects malformed envelopes without throwing", async () => {
    const envelope = await signedTestReceipt();
    const withExtraField = { ...envelope, receipt: { ...envelope.receipt, note: "hi" } };
    const result = await verifyPaymentReceipt(withExtraField, { issuers });
    expect(result.ok).toBe(false);
    expect(result.format.status).toBe("malformed");
    expect(result.issuer.status).toBe("not_checked");

    expect((await verifyPaymentReceipt(null, { issuers })).format.status).toBe("malformed");
    expect((await verifyPaymentReceipt("{}", { issuers })).format.status).toBe("malformed");
  });

  it("uses the published registry by default", async () => {
    const envelope = await signedTestReceipt();
    const result = await verifyPaymentReceipt(envelope);
    expect(result.issuer.status).toBe("unknown_issuer");
  });
});
