import { stringToHex } from "viem";
import { describe, expect, it } from "vitest";
import { transferReasonText } from "../src/reason-text";

describe("transferReasonText", () => {
  it("decodes the agent's UTF-8 reason bytes", () => {
    expect(transferReasonText(stringToHex("Annual data licence (demo, expected escalate)"))).toBe(
      "Annual data licence (demo, expected escalate)",
    );
    expect(transferReasonText(stringToHex("Facture n°42 — données"))).toBe(
      "Facture n°42 — données",
    );
  });

  it("keeps bytes that are not readable text as hex", () => {
    expect(transferReasonText("0x00ff01")).toBe("0x00ff01");
    expect(transferReasonText("0xff")).toBe("0xff");
  });

  it("returns empty text for empty bytes and non-strings", () => {
    expect(transferReasonText("0x")).toBe("");
    expect(transferReasonText(undefined)).toBe("");
    expect(transferReasonText(12n)).toBe("");
  });

  it("passes plain strings through", () => {
    expect(transferReasonText("already text")).toBe("already text");
  });
});
