import { describe, expect, it, vi } from "vitest";

import type { ApiContext } from "../context";

const chainMocks = vi.hoisted(() => ({
  isEscalationSigner: vi.fn(),
  readEscalationChainState: vi.fn(),
  readWalletOwner: vi.fn(),
  verifyEscalationDecisionReceipt: vi.fn(),
}));

vi.mock("../chain", () => chainMocks);

import { escalationsRouter } from "./escalations";

const OWNER = "0x1111111111111111111111111111111111111111" as const;
const WALLET = "0x2222222222222222222222222222222222222222" as const;
const TX_HASH = `0x${"ab".repeat(32)}` as const;
const ESCALATION_KEY = `0x${"cd".repeat(32)}` as const;
const WALLET_ID = "33333333-3333-4333-8333-333333333333";
const FACTORY = "0x4444444444444444444444444444444444444444";

function chainState(status: "rejected" | "denied") {
  return {
    wallet: WALLET,
    toAddress: "0x3333333333333333333333333333333333333333" as const,
    amount: 12_500_000n,
    expiresAt: 4_102_444_800,
    threshold: 2,
    signatures: 2,
    status,
    policyVersion: 1n,
    heldCouncilVersion: 1n,
  };
}

function context(patchRows: NonNullable<ApiContext["supabase"]>["patchRows"]): ApiContext {
  return {
    db: null as never,
    session: {
      walletAddress: OWNER,
      tenantId: "10000000-0000-4000-8000-000000000001",
      role: "viewer",
      expiresAt: Date.now() + 60_000,
    },
    publicClient: {} as never,
    supabase: {
      configured: true,
      selectRows: async () => [
        {
          id: WALLET_ID,
          wallet_address: WALLET,
          owner_address: OWNER,
          wallet_factory_address: FACTORY,
        },
      ],
      insertRows: async () => [],
      upsertRows: async () => [],
      patchRows,
      callFunction: async () => null,
    },
    requestFingerprint: null,
    env: { authConfigured: true, allowDevAuth: false },
  };
}

describe("escalations.recordDecision", () => {
  it.each(["rejected", "denied"] as const)(
    "persists canonical %s without collapsing it into the other outcome",
    async (status) => {
      const patchRows = vi.fn(async () => [{}]);
      chainMocks.readEscalationChainState.mockResolvedValue(chainState(status));
      chainMocks.readWalletOwner.mockResolvedValue(OWNER);
      chainMocks.isEscalationSigner.mockResolvedValue(false);
      chainMocks.verifyEscalationDecisionReceipt.mockResolvedValue(undefined);

      await escalationsRouter.createCaller(context(patchRows)).recordDecision({
        escalationKey: ESCALATION_KEY,
        txHash: TX_HASH,
      });

      expect(patchRows).toHaveBeenCalledWith(
        "escalations",
        expect.objectContaining({
          status,
          approvals_count: 2,
          deny_tx_hash: TX_HASH,
        }),
        { escalation_key: ESCALATION_KEY, governed_wallet_id: WALLET_ID },
      );
    },
  );
});
