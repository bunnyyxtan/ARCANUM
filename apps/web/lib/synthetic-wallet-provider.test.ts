import { createRequire } from "node:module";
import { afterEach, describe, expect, it, vi } from "vitest";

type Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (name: string, listener: (value: unknown) => void) => void;
};
type Fixture = {
  address: string;
  chainId?: number;
  transactions?: { to: string; data: string; hash: string; value?: string }[];
};
const { installSyntheticWallet } = createRequire(import.meta.url)(
  "../test-fixtures/synthetic-wallet-provider.cjs",
) as { installSyntheticWallet: (options: Fixture) => Provider };
const OWNER = "0x1000000000000000000000000000000000000001";
const WALLET = "0x2000000000000000000000000000000000000002";
const HASH = `0x${"a".repeat(64)}`;
const ARC_CHAIN_ID = "0x4cef52";

function setup(options: Partial<Fixture> = {}) {
  vi.stubGlobal("window", new EventTarget());
  return installSyntheticWallet({ address: OWNER, ...options });
}

function walletControl() {
  return (
    window as unknown as {
      __syntheticWalletAudit: {
        setChainId: (chainId: number) => void;
      };
    }
  ).__syntheticWalletAudit;
}

afterEach(() => vi.unstubAllGlobals());

describe("network-free synthetic browser wallet", () => {
  it("supports the real injected connector account and permission requests", async () => {
    const provider = setup();
    await expect(provider.request({ method: "eth_requestAccounts" })).resolves.toEqual([OWNER]);
    await expect(provider.request({ method: "eth_accounts" })).resolves.toEqual([OWNER]);
    await expect(provider.request({ method: "eth_chainId" })).resolves.toBe("0x4cef52");
    await expect(provider.request({ method: "wallet_requestPermissions" })).resolves.toEqual([
      { parentCapability: "eth_accounts" },
    ]);
  });

  it("never signs or sends an unlisted transaction", async () => {
    const provider = setup();
    for (const method of [
      "personal_sign",
      "eth_sign",
      "eth_signTypedData_v4",
      "eth_sendTransaction",
    ]) {
      await expect(provider.request({ method })).rejects.toThrow("SYNTHETIC_WALLET_BLOCKED");
    }
  });

  it("returns a synthetic hash only for an exact explicitly allowed transaction", async () => {
    const provider = setup({ transactions: [{ to: WALLET, data: "0x1234", hash: HASH }] });
    await expect(
      provider.request({
        method: "eth_sendTransaction",
        params: [{ from: OWNER, to: WALLET, data: "0x1234" }],
      }),
    ).resolves.toBe(HASH);
    await expect(
      provider.request({
        method: "eth_sendTransaction",
        params: [{ from: OWNER, to: WALLET, data: "0x1234", value: "0x1" }],
      }),
    ).rejects.toThrow("SYNTHETIC_WALLET_BLOCKED");
  });

  it("uses the provider control API for offline chain events and Arc-only sends", async () => {
    const provider = setup({ transactions: [{ to: WALLET, data: "0x1234", hash: HASH }] });
    const chainChanges: unknown[] = [];
    provider.on("chainChanged", (chain) => chainChanges.push(chain));

    walletControl().setChainId(1);
    expect(chainChanges).toEqual(["0x1"]);
    await expect(provider.request({ method: "eth_chainId" })).resolves.toBe("0x1");
    await expect(
      provider.request({
        method: "eth_sendTransaction",
        params: [{ from: OWNER, to: WALLET, data: "0x1234" }],
      }),
    ).rejects.toThrow("SYNTHETIC_WALLET_BLOCKED");

    await expect(
      provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x1" }],
      }),
    ).rejects.toThrow("SYNTHETIC_WALLET_BLOCKED");
    await expect(
      provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARC_CHAIN_ID }],
      }),
    ).resolves.toBeNull();
    expect(chainChanges).toEqual(["0x1", ARC_CHAIN_ID]);
    await expect(provider.request({ method: "eth_chainId" })).resolves.toBe(ARC_CHAIN_ID);
    await expect(
      provider.request({
        method: "eth_sendTransaction",
        params: [{ from: OWNER, to: WALLET, data: "0x1234" }],
      }),
    ).resolves.toBe(HASH);
  });

  it("announces its provider through EIP-6963", () => {
    setup();
    const listener = vi.fn();
    window.addEventListener("eip6963:announceProvider", listener);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    expect(listener).toHaveBeenCalledOnce();
  });
});
