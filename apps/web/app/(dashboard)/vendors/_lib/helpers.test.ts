import { describe, expect, it } from "vitest";

import {
  parseUsdcCapInput,
  preserveRawUsdcCapInput,
  vendorCapDraftState,
  vendorCapSyncNotice,
} from "./helpers";

describe("parseUsdcCapInput", () => {
  it("keeps large decimal strings exact instead of routing them through Number", () => {
    expect(parseUsdcCapInput("9007199254740993", "Per-payment cap")).toBe(9007199254740993000000n);
    expect(parseUsdcCapInput("9007199254740993.123456", "Per-payment cap")).toBe(
      9007199254740993123456n,
    );
  });

  it.each(["1e3", "1E3", "1.2e2"])("rejects scientific notation: %s", (value) => {
    expect(() => parseUsdcCapInput(value, "Per-payment cap")).toThrow(
      "non-negative USDC amount with up to 6 decimals",
    );
  });

  it.each(["-1", "-0.01"])("rejects negative caps: %s", (value) => {
    expect(() => parseUsdcCapInput(value, "Per-payment cap")).toThrow(
      "non-negative USDC amount with up to 6 decimals",
    );
  });

  it("rejects more than six decimal places", () => {
    expect(() => parseUsdcCapInput("1.1234567", "Per-payment cap")).toThrow(
      "non-negative USDC amount with up to 6 decimals",
    );
  });

  it("allows zero for the add/edit form's no-cap value", () => {
    expect(parseUsdcCapInput("0", "Per-payment cap")).toBe(0n);
  });
});

describe("vendor cap input boundary", () => {
  it.each(["-1", "1e2", "1E2", "1..2", "$1.25", "1.1234567"])(
    "preserves %s until validation rejects it",
    (value) => {
      const captured = preserveRawUsdcCapInput(value);

      expect(captured).toBe(value);
      expect(() => parseUsdcCapInput(captured, "Per-payment cap")).toThrow(
        "non-negative USDC amount with up to 6 decimals",
      );
    },
  );

  it.each([
    ["", ""],
    ["0", "0"],
    ["12.5", "12.5"],
    ["12.500000", "12.500000"],
  ])("preserves exact cap text for %s", (value, expected) => {
    expect(preserveRawUsdcCapInput(value)).toBe(expected);
  });

  it.each(["", "-1", "1e2", "1.1234567", "1..2"])(
    "renders edit draft %s as invalid and not submittable",
    (value) => {
      const state = vendorCapDraftState(value, "edit");

      expect(state.canSubmit).toBe(false);
      expect(state.error).toBeTruthy();
    },
  );

  it.each(["1", "1.25", "1.123456"])("renders valid edit draft %s as submittable", (value) => {
    expect(vendorCapDraftState(value, "edit")).toEqual({ canSubmit: true, error: null });
  });

  it("keeps add zero as the unlimited, submittable value while rejecting invalid raw text", () => {
    expect(vendorCapDraftState("0", "add")).toEqual({ canSubmit: true, error: null });
    expect(vendorCapDraftState("1e2", "add")).toEqual({
      canSubmit: false,
      error: "Per-payment cap must be a non-negative USDC amount with up to 6 decimals.",
    });
  });

  it("keeps a mirror failure visibly partial instead of claiming registry update", () => {
    expect(vendorCapSyncNotice("Exact vendor", "123.45", "mirror failed")).toBe(
      "EXACT VENDOR PER-PAYMENT CAP CONFIRMED · REGISTRY NOT SYNCED",
    );
    expect(vendorCapSyncNotice("Exact vendor", "123.45", null)).toBe(
      "EXACT VENDOR PER-PAYMENT CAP REVISED TO $123.45 · REGISTRY UPDATED",
    );
  });
});
