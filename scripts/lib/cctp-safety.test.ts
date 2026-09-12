import { describe, expect, it } from "vitest";

import {
  assertCombinedSourceGasWithinCap,
  assertFeeWithinCctpCap,
  assertRefreshedCctpQuote,
  assertSequentialSourceNonces,
  deriveBurnGasCeiling,
  parseCctpStartFlags,
  parseMaxFeeCap,
  parseMaxSourceGasCap,
} from "./cctp-safety";

const quote = {
  amountBaseUnits: "1000000",
  maxFeeBaseUnits: "18704",
  minimumReceivedBaseUnits: "981296",
  expiresAt: 2_000_000,
} as const;

describe("capped CCTP preflight guards", () => {
  it("parses opt-in absolute fee and source-gas caps without changing bare confirm", () => {
    expect(parseCctpStartFlags(["--confirm"])).toEqual({
      confirm: true,
      caps: {},
    });
    expect(
      parseCctpStartFlags(["--confirm", "--max-fee", "0.10", "--max-source-gas", "0.001"]),
    ).toEqual({
      confirm: true,
      caps: { maxFeeBaseUnits: "100000", maxSourceGasWei: "1000000000000000" },
    });
    expect(parseMaxFeeCap("0.100000")).toBe("100000");
    expect(parseMaxSourceGasCap("0.001")).toBe("1000000000000000");
  });

  it("refuses a fresh quote over the approved absolute fee cap", () => {
    expect(() => assertFeeWithinCctpCap(quote.maxFeeBaseUnits, "10000")).toThrow(
      "exceeds the approved cap",
    );
    expect(() => assertRefreshedCctpQuote(quote, quote, "10000", 1_000_000)).toThrow(
      "exceeds the approved cap",
    );
  });

  it("aborts post-approval when the remaining combined gas budget is insufficient", () => {
    const approval = {
      gasLimit: 50_000n,
      maxFeePerGasWei: 2_000_000_000n,
      maxCostWei: 100_000_000_000_000n,
    };
    const burn = {
      gasLimit: 150_000n,
      maxFeePerGasWei: 2_000_000_000n,
      maxCostWei: 300_000_000_000_000n,
    };
    expect(assertCombinedSourceGasWithinCap(approval, burn, "500000000000000")).toBe(
      "400000000000000",
    );
    expect(() => assertCombinedSourceGasWithinCap(approval, burn, "399999999999999")).toThrow(
      "exceeds the approved cap",
    );
  });

  it("reserves an affordable post-approval burn ceiling when allowance is zero", () => {
    const approval = {
      gasLimit: 50_000n,
      maxFeePerGasWei: 2_000_000_000n,
      maxCostWei: 100_000_000_000_000n,
    };
    expect(deriveBurnGasCeiling(approval, "500000000000000")).toBe("200000");
    expect(() => deriveBurnGasCeiling(approval, "99999999999999")).toThrow(
      "already exceeds the approved cap",
    );
  });

  it("requires the refreshed quote to retain amount and live expiry after approval", () => {
    const refreshed = { ...quote, maxFeeBaseUnits: "25000", expiresAt: 2_000_100 };
    expect(() => assertRefreshedCctpQuote(quote, refreshed, "100000", 2_000_000)).not.toThrow();
    expect(() =>
      assertRefreshedCctpQuote(
        quote,
        { ...refreshed, amountBaseUnits: "2000000" },
        "100000",
        2_000_000,
      ),
    ).toThrow("changed the approved burn amount");
    expect(() =>
      assertRefreshedCctpQuote(quote, { ...refreshed, expiresAt: 2_000_000 }, "100000", 2_000_000),
    ).toThrow("already expired");
  });

  it("rejects nonce drift instead of selecting a retry nonce", () => {
    expect(() => assertSequentialSourceNonces(12, 13)).not.toThrow();
    expect(() => assertSequentialSourceNonces(12, 14)).toThrow("consecutive");
    expect(() => assertSequentialSourceNonces(12, 12)).toThrow("consecutive");
  });
});
