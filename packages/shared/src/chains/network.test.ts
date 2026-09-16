import { afterEach, describe, expect, it, vi } from "vitest";

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
