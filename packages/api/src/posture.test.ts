import { describe, expect, it } from "vitest";

import { computePostureScore, type PostureInputs } from "./posture";

const strict: PostureInputs = {
  requireVendorAllowlist: true,
  quorum: 2,
  councilSize: 3,
  perTxCapUsd: 2,
  dailyCapUsd: 60,
  monthlyCapUsd: 500,
  escalateAboveUsd: 1,
  doctrineVersion: 4,
  frozen: false,
};

const bare: PostureInputs = {
  requireVendorAllowlist: false,
  quorum: 0,
  councilSize: 0,
  perTxCapUsd: 0,
  dailyCapUsd: 0,
  monthlyCapUsd: 0,
  escalateAboveUsd: 0,
  doctrineVersion: 1,
  frozen: false,
};

describe("computePostureScore", () => {
  it("rewards strict doctrines and punishes bare ones", () => {
    const strictScore = computePostureScore(strict);
    const bareScore = computePostureScore(bare);
    expect(strictScore).toBeGreaterThan(bareScore);
    expect(bareScore).toBe(30);
    expect(strictScore).toBeGreaterThanOrEqual(80);
  });

  it("is deterministic for identical doctrines", () => {
    expect(computePostureScore(strict)).toBe(computePostureScore({ ...strict }));
  });

  it("differentiates doctrines with different controls", () => {
    const withoutAllowlist = computePostureScore({
      ...strict,
      requireVendorAllowlist: false,
    });
    const withoutQuorum = computePostureScore({ ...strict, quorum: 0 });
    const looseCaps = computePostureScore({
      ...strict,
      perTxCapUsd: 60,
      escalateAboveUsd: 100,
    });
    const full = computePostureScore(strict);
    expect(new Set([full, withoutAllowlist, withoutQuorum, looseCaps]).size).toBe(4);
  });

  it("docks frozen wallets", () => {
    expect(computePostureScore({ ...strict, frozen: true })).toBe(
      computePostureScore(strict) - 15
    );
  });

  it("credits doctrine maturity but caps it", () => {
    const v1 = computePostureScore({ ...strict, doctrineVersion: 1 });
    const v4 = computePostureScore(strict);
    const v99 = computePostureScore({ ...strict, doctrineVersion: 99 });
    expect(v4).toBe(v1 + 3);
    expect(v99).toBe(v1 + 5);
  });

  it("clamps to the 5-95 band", () => {
    expect(
      computePostureScore({ ...bare, frozen: true })
    ).toBeGreaterThanOrEqual(5);
    expect(computePostureScore(strict)).toBeLessThanOrEqual(95);
  });
});
