import { describe, expect, it } from "vitest";

import {
  ESCALATION_TERMINAL_STATUSES,
  cancellationTargetFromChain,
  compareEscalationTerms,
  escalationChainTermsFromDetail,
  escalationExpiryState,
  escalationStatusLabel,
  escalationVotePreflightError,
  formatBaseUnits,
  isEscalationTerminalStatus,
} from "./escalation-truth";

const wallet = "0x1111111111111111111111111111111111111111" as const;
const counterparty = "0x2222222222222222222222222222222222222222" as const;

function detail(status: number, amount = 9007199254740993000001n) {
  return [
    wallet,
    counterparty,
    amount,
    "0x",
    1n,
    1_900_000_000n,
    2n,
    1n,
    BigInt(status),
    4n,
    1n,
  ] as const;
}

describe("escalation chain truth helpers", () => {
  it("keeps uint256 amounts exact and rejects tampered displayed terms", () => {
    const chain = escalationChainTermsFromDetail(detail(0));
    expect(chain.amountBaseUnits).toBe("9007199254740993000001");
    expect(
      compareEscalationTerms(
        {
          walletAddress: wallet,
          counterpartyAddress: counterparty,
          amountBaseUnits: "9007199254740993000002",
        },
        chain,
      ),
    ).toEqual({ ok: false, reason: "amount" });
    expect(
      compareEscalationTerms(
        {
          walletAddress: counterparty,
          counterpartyAddress: counterparty,
          amountBaseUnits: chain.amountBaseUnits,
        },
        chain,
      ),
    ).toEqual({ ok: false, reason: "wallet" });
    expect(
      compareEscalationTerms(
        {
          walletAddress: wallet,
          counterpartyAddress: wallet,
          amountBaseUnits: chain.amountBaseUnits,
        },
        chain,
      ),
    ).toEqual({ ok: false, reason: "counterparty" });
    expect(formatBaseUnits(chain.amountBaseUnits)).toBe("$9,007,199,254,740,993.000001");
  });

  it.each(ESCALATION_TERMINAL_STATUSES)("labels settled %s from actual status", (status) => {
    const chain = escalationChainTermsFromDetail(
      detail(ESCALATION_TERMINAL_STATUSES.indexOf(status) + 1),
    );
    expect(isEscalationTerminalStatus(chain.status)).toBe(true);
    expect(escalationStatusLabel(chain.status)).toContain(status === "DENIED" ? "DENIED" : status);
  });

  it("keeps a quorum vote pending instead of inferring execution", () => {
    const chain = escalationChainTermsFromDetail(detail(0));
    expect(isEscalationTerminalStatus(chain.status)).toBe(false);
    expect(escalationStatusLabel(chain.status)).toBe("VOTE RECORDED / QUORUM PENDING");
  });

  it("allows a prior approver to reject while quorum is still pending", () => {
    const chain = escalationChainTermsFromDetail(detail(0));
    expect(chain.threshold).toBe(2);
    expect(chain.signaturesCount).toBe(1);
    expect(
      escalationVotePreflightError({
        action: "approve",
        status: chain.status,
        alreadySigned: true,
      }),
    ).toBe("This approver has already voted on this escalation.");
    expect(
      escalationVotePreflightError({
        action: "reject",
        status: chain.status,
        alreadySigned: true,
      }),
    ).toBeNull();
  });

  it.each(["approve", "reject"] as const)("allows an unsigned approver to %s", (action) => {
    expect(
      escalationVotePreflightError({
        action,
        status: "PENDING",
        alreadySigned: false,
      }),
    ).toBeNull();
  });

  it.each(["approve", "reject"] as const)("blocks %s after resolution", (action) => {
    expect(
      escalationVotePreflightError({
        action,
        status: "REJECTED",
        alreadySigned: false,
      }),
    ).toBe("Escalation is already rejected.");
  });

  it("treats the expiry boundary as unswept until the chain status is finalized", () => {
    expect(
      escalationExpiryState({
        status: "PENDING",
        expiresAt: 100n,
        nowSeconds: 99n,
      }),
    ).toBe("ACTIVE");
    expect(
      escalationExpiryState({
        status: "PENDING",
        expiresAt: 100n,
        nowSeconds: 100n,
      }),
    ).toBe("UNSWEPT");
    expect(
      escalationExpiryState({
        status: "EXPIRED",
        expiresAt: 100n,
        nowSeconds: 100n,
      }),
    ).toBe("SETTLED");
  });

  it("returns the governed contract target only for the current chain owner", () => {
    expect(
      cancellationTargetFromChain({
        displayedWalletAddress: wallet,
        chainWalletAddress: wallet,
        chainOwnerAddress: wallet,
        connectedAddress: wallet,
      }),
    ).toBe(wallet);
    expect(
      cancellationTargetFromChain({
        displayedWalletAddress: "supabase-wallet-uuid",
        chainWalletAddress: wallet,
        chainOwnerAddress: wallet,
        connectedAddress: wallet,
      }),
    ).toBeNull();
    expect(
      cancellationTargetFromChain({
        displayedWalletAddress: wallet,
        chainWalletAddress: wallet,
        chainOwnerAddress: wallet,
        connectedAddress: counterparty,
      }),
    ).toBeNull();
  });
});
