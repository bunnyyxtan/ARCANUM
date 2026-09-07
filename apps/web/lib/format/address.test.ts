import { describe, expect, it } from "vitest";

import { ZERO_ADDRESS, isEvmAddress, isSameAddress, isZeroAddress, shortAddress } from "./address";

const ADDRESS = "0x1234567890abcdef1234567890abcdef12345678";

describe("address formatting", () => {
  it("recognizes complete hexadecimal EVM addresses", () => {
    expect(isEvmAddress(ADDRESS)).toBe(true);
    expect(isEvmAddress("0x1234")).toBe(false);
    expect(isEvmAddress(`0x${"g".repeat(40)}`)).toBe(false);
  });

  it("compares addresses without case or surrounding whitespace", () => {
    expect(isSameAddress(` ${ADDRESS.toUpperCase()} `, ADDRESS)).toBe(true);
    expect(isSameAddress(null, null)).toBe(false);
  });

  it("recognizes the zero address", () => {
    expect(isZeroAddress(ZERO_ADDRESS.toUpperCase())).toBe(true);
    expect(isZeroAddress(ADDRESS)).toBe(false);
  });

  it("shortens addresses and honors formatting options", () => {
    expect(shortAddress(ADDRESS)).toBe("0x1234...5678");
    expect(shortAddress(ADDRESS, { head: 4, tail: 2 })).toBe("0x12...78");
    expect(shortAddress(null, { fallback: "Unknown" })).toBe("Unknown");
    expect(shortAddress("0x12...5678")).toBe("0x12...5678");
  });
});
