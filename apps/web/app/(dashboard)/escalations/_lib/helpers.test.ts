import { describe, expect, it } from "vitest";

import type { Escalation } from "@/lib/types";
import { applyEscalationChainUpdate } from "./helpers";

const escalation: Escalation = {
  agentId: "agent",
  agentName: "Governed Wallet",
  amount: "10000000",
  amountBaseUnits: "10000000",
  category: "compute",
  counterparty: "Vendor",
  createdAt: "2026-01-01T00:00:00.000Z",
  deviation: 0,
  expiresAt: "2026-01-01T01:00:00.000Z",
  expiresIn: "1 hour",
  expiryPercent: 100,
  id: `0x${"1".repeat(64)}`,
  walletId: "wallet-row-id",
  walletAddress: "0x0000000000000000000000000000000000000001",
  ownerAddress: "0x0000000000000000000000000000000000000002",
  quorumCurrent: 0,
  quorumRequired: 2,
  reason: "ESCALATION_THRESHOLD",
  status: "PENDING",
  counterpartyAddress: "0x0000000000000000000000000000000000000003",
};

describe("escalation chain updates", () => {
  it("keeps a one-of-two approval pending with its recorded vote", () => {
    const updated = applyEscalationChainUpdate(escalation, {
      signaturesCount: 1,
      status: "PENDING",
    });

    expect(updated.status).toBe("PENDING");
    expect(updated.quorumCurrent).toBe(1);
    expect(updated.votePending).toBe(true);
  });

  it("reconciles a rejected receipt as a settled decision", () => {
    const updated = applyEscalationChainUpdate(escalation, {
      signaturesCount: 0,
      status: "REJECTED",
    });

    expect(updated.status).toBe("REJECTED");
    expect(updated.votePending).toBe(false);
  });

  it("reconciles a permissionless expiry sweep as finalized expiry", () => {
    const updated = applyEscalationChainUpdate(escalation, {
      signaturesCount: 0,
      status: "EXPIRED",
    });

    expect(updated.status).toBe("EXPIRED");
    expect(updated.votePending).toBe(false);
  });
});
