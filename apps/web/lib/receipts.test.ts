import type { PaymentReceiptEvidence } from "@arcanum/shared";
import { describe, expect, it } from "vitest";

import { chainAgreement } from "./receipts";

function evidence(overrides: Partial<PaymentReceiptEvidence> = {}): PaymentReceiptEvidence {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    receiptId: "20000000-0000-4000-8000-000000000002",
    kind: "execution",
    outcome: "executed",
    txHash: `0x${"11".repeat(32)}`,
    logIndex: 1,
    blockNumber: 10,
    escalationKey: null,
    calldataNamesReceipt: true,
    observedAt: "2026-09-19T00:00:00.000Z",
    details: { verdictMatches: true },
    ...overrides,
  };
}

describe("chainAgreement", () => {
  it("reports agreement only for execution evidence bound to this receipt", () => {
    expect(chainAgreement(evidence())).toBe(true);
    expect(chainAgreement(evidence({ details: { verdictMatches: false } }))).toBe(false);
    expect(chainAgreement(evidence({ calldataNamesReceipt: false }))).toBeNull();
    expect(chainAgreement(evidence({ calldataNamesReceipt: null }))).toBeNull();
  });

  it("preserves escalation resolution agreement recorded from a bound hold transaction", () => {
    expect(
      chainAgreement(
        evidence({
          kind: "escalation",
          outcome: "released",
          calldataNamesReceipt: true,
          details: { verdictMatches: true },
        }),
      ),
    ).toBe(true);
  });

  it.each([false, null])("does not infer agreement from an unbound escalation (%s)", (binding) => {
    for (const verdictMatches of [true, false]) {
      expect(
        chainAgreement(
          evidence({
            kind: "escalation",
            outcome: "released",
            calldataNamesReceipt: binding,
            details: { verdictMatches },
          }),
        ),
      ).toBeNull();
    }
  });
});
