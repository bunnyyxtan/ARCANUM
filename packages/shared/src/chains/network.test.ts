import { afterEach, describe, expect, it, vi } from "vitest";
import metadata from "./network-metadata.test.json";

// The switch is read once at module load, so every case imports a fresh copy.
const loadNetwork = () => import("./network");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Arc network switch", () => {
  it("defaults to testnet when neither variable is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_ARC_NETWORK", "");
    vi.stubEnv("ARC_NETWORK", "");
    const network = await loadNetwork();
    expect(network.ARC_NETWORK).toBe("testnet");
    expect(network.IS_ARC_MAINNET).toBe(false);
  });

  it("selects mainnet when both variables agree", async () => {
    vi.stubEnv("NEXT_PUBLIC_ARC_NETWORK", "mainnet");
    vi.stubEnv("ARC_NETWORK", "mainnet");
    const network = await loadNetwork();
    expect(network.ARC_NETWORK).toBe("mainnet");
    expect(network.ARC_CHAIN_ID).toBe(5042);
    expect(network.arcChain.id).toBe(5042);
  });

  it("refuses to start when the public and server switches disagree", async () => {
    vi.stubEnv("NEXT_PUBLIC_ARC_NETWORK", "mainnet");
    vi.stubEnv("ARC_NETWORK", "testnet");
    await expect(loadNetwork()).rejects.toThrow(/disagree/);
  });

  it("rejects an unknown network name", async () => {
    vi.stubEnv("NEXT_PUBLIC_ARC_NETWORK", "");
    vi.stubEnv("ARC_NETWORK", "devnet");
    await expect(loadNetwork()).rejects.toThrow(/Invalid Arc network/);
  });
});

describe("published cross-language network metadata", () => {
  it("matches the shared authoritative defaults without changing TypeScript chain shapes", async () => {
    for (const name of [
      "NEXT_PUBLIC_ARC_MAINNET_RPC_URL",
      "ARC_MAINNET_RPC_URL",
      "NEXT_PUBLIC_ARC_MAINNET_EXPLORER_URL",
      "ARC_MAINNET_EXPLORER_URL",
      "NEXT_PUBLIC_ARC_MAINNET_USDC_ADDRESS",
      "ARC_MAINNET_USDC_ADDRESS",
    ]) {
      vi.stubEnv(name, undefined);
    }
    const mainnet = await import("./arc-mainnet");
    const testnet = await import("./arc-testnet");

    expect({
      chainId: testnet.ARC_TESTNET_CHAIN_ID,
      name: testnet.arcTestnet.name,
      rpcUrl: testnet.ARC_TESTNET_RPC_URL,
      explorerUrl: testnet.ARC_TESTNET_EXPLORER_URL,
      usdcAddress: testnet.ARC_TESTNET_USDC_ADDRESS,
    }).toEqual(metadata.testnet);
    expect({
      chainId: mainnet.ARC_MAINNET_CHAIN_ID,
      name: mainnet.arcMainnet.name,
      rpcUrl: mainnet.ARC_MAINNET_RPC_URL,
      explorerUrl: mainnet.ARC_MAINNET_EXPLORER_URL,
      usdcAddress: mainnet.ARC_MAINNET_USDC_ADDRESS,
    }).toEqual(metadata.mainnet);

    // WebSocket metadata is intentionally TypeScript-only: Python's public
    // ChainConfig has no WebSocket field, so parity must not invent one or
    // normalize either language's published object shape.
    expect(testnet.ARC_TESTNET_WS_URL).toBe("wss://rpc.testnet.arc.network/ws");
  });
});
