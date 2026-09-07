import { vi } from "vitest";

vi.mock("@arcanum/shared", async (importOriginal) => {
  const original = await importOriginal<typeof import("@arcanum/shared")>();
  const address = "0x4444444444444444444444444444444444444444";
  const hash = `0x${"11".repeat(32)}` as `0x${string}`;

  return {
    ...original,
    deploymentManifestFor: () => ({
      chainId: original.ARC_CHAIN_ID,
      network: "arc-testnet",
      startBlock: 1,
      deployer: address,
      protocolAdmin: address,
      oracleSigner: address,
      create2Salt: hash,
      usdc: address,
      policyEngine: address,
      escalationManager: address,
      anomalyOracle: address,
      vendorRegistry: address,
      walletFactory: address,
      codeHashes: {
        policyEngine: hash,
        escalationManager: hash,
        anomalyOracle: hash,
        vendorRegistry: hash,
        walletFactory: hash,
      },
    }),
  };
});
