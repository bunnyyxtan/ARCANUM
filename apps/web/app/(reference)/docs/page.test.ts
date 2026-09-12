import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const normalizedSource = source.replace(/\s+/g, " ");

describe("public SDK quickstart copy", () => {
  function extractSnippet(label: string): string {
    const marker = `<CodeBlock label="${label}">{\``;
    const start = source.indexOf(marker);
    if (start < 0) {
      throw new Error(`Unable to find docs snippet: ${label}`);
    }
    const end = source.indexOf("`}</CodeBlock>", start + marker.length);
    if (end <= start) {
      throw new Error(`Unable to find the end of docs snippet: ${label}`);
    }
    const snippet = source.slice(start + marker.length, end);
    if (!snippet.trim()) {
      throw new Error(`Docs snippet is empty: ${label}`);
    }
    return snippet;
  }

  it("parses the exact displayed .mjs snippets with Node", () => {
    const directory = mkdtempSync(join(tmpdir(), "arcanum-docs-"));
    try {
      for (const [filename, label] of [
        ["test.mjs", "test.mjs / run: node test.mjs"],
        ["deploy.mjs", "deploy.mjs / run: node deploy.mjs"],
      ] as const) {
        const path = join(directory, filename);
        writeFileSync(path, extractSnippet(label));
        execFileSync(process.execPath, ["--check", path], { stdio: "pipe" });
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("uses the current Arc Testnet factory from the deployment manifest", () => {
    expect(source).toContain("0xbE1bC48F26e7166D872828d40e82A6407dbD350C");
    expect(source).not.toContain("0x51A560589e23AcD2e57173641267f4583e0e65E7");
  });

  it("distinguishes native gas decimals from token and CCTP decimals", () => {
    expect(source).toContain("Arc native USDC gas uses 18 decimals");
    expect(source).toContain("ERC20/CCTP amounts also use 6");
    expect(source).not.toContain('nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 }');
  });

  it("does not promise an indexed event for reverted policy denials", () => {
    expect(normalizedSource).toMatch(/reverted policy denial leaves no successful DENY event/);
    expect(normalizedSource).toMatch(
      /signed payment decision receipts attest the separate preflight evaluation/i,
    );
  });
});
