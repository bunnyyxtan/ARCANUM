import { describe, expect, it } from "vitest";

import { describeChainError } from "./chain-errors";

describe("describeChainError", () => {
  it("maps wallet rejection variants", () => {
    expect(describeChainError(new Error("User rejected the request"))).toBe(
      "Request rejected in your wallet.",
    );
    expect(describeChainError({ shortMessage: "Request rejected by user" })).toBe(
      "Request rejected in your wallet.",
    );
  });

  it("maps known insufficient-funds variants", () => {
    expect(describeChainError(new Error("execution failed: OutOfFunds"))).toBe(
      "Not enough USDC in this wallet to cover the transaction and its gas.",
    );
    expect(describeChainError(new Error("gas required exceeds allowance"))).toBe(
      "Not enough USDC in this wallet to cover the transaction and its gas.",
    );
  });

  it("preserves unknown messages and uses a fallback for empty errors", () => {
    expect(describeChainError(new Error("RPC timed out"))).toBe("RPC timed out");
    expect(describeChainError(null, "Chain unavailable")).toBe("Chain unavailable");
  });
});
