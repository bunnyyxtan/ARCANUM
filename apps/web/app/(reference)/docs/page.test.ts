import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { sdkDeploySnippet, sdkTestSnippet } from "./sdk-snippets";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const normalizedSource = source.replace(/\s+/g, " ");
const testnetManifest = JSON.parse(
  readFileSync(
    new URL("../../../../../packages/contracts/deployments/arc-testnet.json", import.meta.url),
    "utf8",
  ),
) as { walletFactory: string };
const MAINNET_FACTORY_PLACEHOLDER = "0x1111111111111111111111111111111111111111";

const renderings = [
  { network: "testnet", walletFactory: testnetManifest.walletFactory },
  { network: "mainnet", walletFactory: MAINNET_FACTORY_PLACEHOLDER },
] as const;

describe("public SDK quickstart copy", () => {
  it("parses the exact displayed .mjs snippets with Node on both networks", () => {
    const directory = mkdtempSync(join(tmpdir(), "arcanum-docs-"));
    try {
      for (const input of renderings) {
        for (const [filename, snippet] of [
          ["test.mjs", sdkTestSnippet(input)],
          ["deploy.mjs", sdkDeploySnippet(input)],
        ] as const) {
          const path = join(directory, `${input.network}-${filename}`);
          writeFileSync(path, snippet);
          execFileSync(process.execPath, ["--check", path], { stdio: "pipe" });
        }
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("takes the factory address from the active deployment manifest", () => {
    expect(source).toContain("walletFactory: contractAddresses.walletFactory");
    expect(source).not.toMatch(/0x[0-9a-fA-F]{40}/);
    expect(sdkDeploySnippet(renderings[0])).toContain(testnetManifest.walletFactory);
    expect(sdkDeploySnippet(renderings[1])).toContain(MAINNET_FACTORY_PLACEHOLDER);
  });

  it("binds each network to its own chain export and manifest", () => {
    const testnet = sdkDeploySnippet(renderings[0]);
    const mainnet = sdkDeploySnippet(renderings[1]);
    expect(testnet).toContain("arcTestnet");
    expect(testnet).toContain("deployments/arc-testnet.json");
    expect(testnet).not.toContain("arcMainnet");
    expect(mainnet).toContain("arcMainnet");
    expect(mainnet).toContain("deployments/arc-mainnet.json");
    expect(mainnet).not.toContain("arcTestnet");
  });

  it("distinguishes native gas decimals from token and CCTP decimals", () => {
    expect(source).toContain("ERC20/CCTP amounts also use 6");
    expect(sdkTestSnippet(renderings[0])).toContain(
      "Arc's native USDC gas balance uses 18 decimals",
    );
    expect(sdkDeploySnippet(renderings[0])).toContain("Arc native USDC gas uses 18 decimals");
    expect(source).not.toContain('nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 }');
  });

  it("does not promise an indexed event for reverted policy denials", () => {
    expect(normalizedSource).toMatch(/reverted policy denial leaves no successful DENY event/);
    expect(normalizedSource).toMatch(
      /signed payment decision receipts attest the separate preflight evaluation/i,
    );
  });
});
