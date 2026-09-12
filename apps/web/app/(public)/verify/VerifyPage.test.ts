import { readFileSync } from "node:fs";
import {
  RECEIPT_INPUT_MAX_BYTES,
  receiptInputSizeError,
  receiptTextSizeError,
} from "@/lib/receipts";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./VerifyPage.tsx", import.meta.url), "utf8");

describe("offline verifier trust copy", () => {
  it("names the issuer registry as the trust anchor", () => {
    expect(source).toContain("REGISTRY-BASED OFFLINE VERIFICATION");
    expect(source).toContain("published issuer registry is the trust anchor");
    expect(source).toMatch(/registered key\s+attested to those bytes/);
  });

  it("does not imply signatures prove chain settlement", () => {
    expect(source).toContain(
      "do not prove policy correctness, chain inclusion, payment settlement",
    );
    expect(source).toContain("nothing is sent anywhere");
    expect(source).not.toContain("TRUSTLESS VERIFICATION");
  });
});

describe("offline verifier file input safety", () => {
  it("invalidates older readers and reports read failures", () => {
    expect(source).toContain("const fileRead = ++fileReadRef.current");
    expect(source).toContain("const isCurrentRead = () => fileRead === fileReadRef.current");
    expect(source).toContain("fileReadRef.current += 1");
    expect(source).toContain("activeReaderRef.current?.abort()");
    expect(source).toContain("if (!isCurrentRead()) return;");
    expect(source).toContain("reader.onerror");
    expect(source).toContain("The selected file could not be read");
  });

  it("keeps the file input keyboard reachable", () => {
    expect(source).toContain('id="receipt-file"');
    expect(source).toContain('aria-label="Upload receipt JSON file"');
    expect(source).not.toContain('type="file" accept=".json" className="hidden"');
  });

  it("rejects an oversized file before constructing a reader", () => {
    expect(receiptInputSizeError(RECEIPT_INPUT_MAX_BYTES + 1)).toBe(
      "Receipt JSON must be 1 MiB or smaller.",
    );
    expect(source.indexOf("receiptInputSizeError(file.size)")).toBeLessThan(
      source.indexOf("new FileReader()"),
    );
  });

  it("rejects oversized pasted text with the same bound, measured in UTF-8 bytes", () => {
    expect(receiptTextSizeError("a".repeat(RECEIPT_INPUT_MAX_BYTES))).toBeNull();
    expect(receiptTextSizeError("a".repeat(RECEIPT_INPUT_MAX_BYTES + 1))).not.toBeNull();
    // Two-byte characters: half the code units of the limit already exceed it.
    expect(receiptTextSizeError("é".repeat(RECEIPT_INPUT_MAX_BYTES / 2 + 1))).not.toBeNull();
    expect(source).toContain("receiptTextSizeError(value)");
    expect(source).not.toContain("value.length");
  });
});
