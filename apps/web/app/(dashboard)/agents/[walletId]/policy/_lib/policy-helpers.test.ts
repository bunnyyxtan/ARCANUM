import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/deployment", () => ({
  contractAddresses: {
    anomalyOracle: "0x0000000000000000000000000000000000000001",
    escalationManager: "0x0000000000000000000000000000000000000002",
    policyEngine: "0x0000000000000000000000000000000000000003",
    usdc: "0x0000000000000000000000000000000000000004",
    vendorRegistry: "0x0000000000000000000000000000000000000005",
    walletFactory: "0x0000000000000000000000000000000000000006",
  },
}));

import type { PolicyDraftState } from "@/lib/contracts";
import { policyValidationError, reconcilePolicyDraft } from "./policy-helpers";

const draft: PolicyDraftState = {
  dailyCap: "100",
  enabledCategories: new Set(["API"]),
  escalationThreshold: "50",
  freezeOnBlockedVendor: true,
  monthlyCap: "1000",
  perTxCap: "75",
  requireAllowlist: true,
};

describe("policy draft validation and reconciliation", () => {
  it("rejects an escalation threshold above the per-transaction cap", () => {
    expect(policyValidationError({ ...draft, escalationThreshold: "76" })).toBe(
      "Escalation threshold must be less than or equal to the per transaction cap.",
    );
  });

  it("preserves a dirty draft when a refetch observes a changed on-chain policy", () => {
    const dirtyDraft = { ...draft, dailyCap: "90" };
    const nextOnChain = { ...draft, dailyCap: "110" };

    expect(reconcilePolicyDraft(dirtyDraft, nextOnChain, false)).toEqual({
      draft: dirtyDraft,
      onChainChanged: true,
    });
  });
});
