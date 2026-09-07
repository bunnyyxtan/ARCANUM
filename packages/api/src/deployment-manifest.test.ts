import { parseDeploymentManifest } from "@arcanum/shared";
import { describe, expect, it } from "vitest";
import scriptOutput from "./__fixtures__/deployment-manifest.v2.json";

describe("deployment manifest contract", () => {
  it("accepts the exact key set DeployArcBase.s.sol writes", () => {
    const manifest = parseDeploymentManifest(scriptOutput);
    expect(manifest.network).toBe("arc-testnet");
    expect(manifest.walletFactory).toBe(scriptOutput.walletFactory);
    expect(manifest.codeHashes.walletFactory).toBe(scriptOutput.codeHashes.walletFactory);
  });

  it("accepts the fields finalize-manifest.mjs appends", () => {
    const manifest = parseDeploymentManifest({
      ...scriptOutput,
      deployedAt: "2026-09-07T12:00:00.000Z",
      compiler: "0.8.24+commit.e11b9ed9",
      evmVersion: "shanghai",
      txHashes: { walletFactory: scriptOutput.create2Salt },
    });
    expect(manifest.txHashes?.walletFactory).toBe(scriptOutput.create2Salt);
  });

  it.each(["network", "oracleSigner", "create2Salt", "codeHashes", "startBlock"] as const)(
    "rejects a manifest without %s",
    (key) => {
      const { [key]: _omitted, ...incomplete } = scriptOutput;
      expect(() => parseDeploymentManifest(incomplete)).toThrow(
        /Invalid contracts deployment manifest/,
      );
    },
  );
});
