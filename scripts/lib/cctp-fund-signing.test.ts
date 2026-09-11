import { type Hex, type LocalAccount, createPublicClient, createWalletClient, custom } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { describe, expect, it, vi } from "vitest";

import { type SourcePublicClient, sepolia, simulateAndSend } from "./cctp-fund-signing";

const PRIVATE_KEY = `0x${"11".repeat(32)}` as const;
const RAW_TRANSACTION = "0xdeadbeef" as Hex;
const TRANSACTION_HASH = `0x${"ab".repeat(32)}` as const;
const TO = "0x2222222222222222222222222222222222222222" as const;
const DATA = "0x12345678" as const;

interface RpcCall {
  method: string;
  params: readonly unknown[] | undefined;
}

function rpcTransport(options: { failCall?: boolean } = {}) {
  const calls: RpcCall[] = [];
  const transport = custom({
    request: async ({ method, params }) => {
      calls.push({ method, params });
      switch (method) {
        case "eth_chainId":
          return "0xaa36a7";
        case "eth_call":
          if (options.failCall) throw new Error("simulated preflight revert");
          return "0x";
        case "eth_estimateGas":
          return "0x5208";
        case "eth_gasPrice":
          return "0x3b9aca00";
        case "eth_maxPriorityFeePerGas":
          return "0x3b9aca00";
        case "eth_feeHistory":
          return {
            baseFeePerGas: ["0x3b9aca00", "0x3b9aca00"],
            gasUsedRatio: [0.5],
            oldestBlock: "0x64",
            reward: [["0x3b9aca00"]],
          };
        case "eth_getBlockByNumber":
          return { number: "0x64", baseFeePerGas: "0x3b9aca00" };
        case "eth_getTransactionCount":
          return "0x07";
        case "eth_sendRawTransaction":
          return TRANSACTION_HASH;
        case "eth_sendTransaction":
          throw new Error("unexpected eth_sendTransaction");
        default:
          throw new Error(`unexpected RPC method ${method}`);
      }
    },
  });
  return { calls, transport };
}

function localSigner(onSign: (transaction: unknown) => void): LocalAccount {
  const account = privateKeyToAccount(PRIVATE_KEY);
  vi.spyOn(account, "signTransaction").mockImplementation(async (transaction) => {
    onSign(transaction);
    return RAW_TRANSACTION;
  });
  return account;
}

describe("CCTP signer transport", () => {
  it("locally signs the prepared EIP-1559 request and sends only raw bytes", async () => {
    const rpc = rpcTransport();
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: rpc.transport,
    });
    const signed: { value?: unknown } = {};
    const account = localSigner((transaction) => {
      signed.value = transaction;
    });
    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: rpc.transport,
    });

    const hash = await simulateAndSend(
      publicClient as unknown as SourcePublicClient,
      walletClient,
      account,
      { to: TO, data: DATA },
      () => undefined,
      7,
    );

    expect(hash).toBe(TRANSACTION_HASH);
    expect(signed.value).toMatchObject({
      account,
      chainId: sepolia.id,
      data: DATA,
      nonce: 7,
      to: TO,
      type: "eip1559",
      value: 0n,
    });
    expect(signed.value).toEqual(
      expect.objectContaining({
        maxFeePerGas: expect.any(BigInt),
        maxPriorityFeePerGas: expect.any(BigInt),
      }),
    );
    expect(rpc.calls.map((call) => call.method)).not.toContain("eth_sendTransaction");
    expect(rpc.calls.map((call) => call.method)).toContain("eth_sendRawTransaction");
    expect(rpc.calls.find((call) => call.method === "eth_sendRawTransaction")?.params).toEqual([
      RAW_TRANSACTION,
    ]);
  });

  it("does not sign or broadcast when preflight simulation fails", async () => {
    const rpc = rpcTransport({ failCall: true });
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: rpc.transport,
    });
    let signed = false;
    const account = localSigner(() => {
      signed = true;
    });
    const walletClient = createWalletClient({
      account,
      chain: sepolia,
      transport: rpc.transport,
    });

    await expect(
      simulateAndSend(
        publicClient as unknown as SourcePublicClient,
        walletClient,
        account,
        { to: TO, data: DATA },
        () => undefined,
        7,
      ),
    ).rejects.toThrow("simulated preflight revert");

    expect(signed).toBe(false);
    expect(rpc.calls.map((call) => call.method)).not.toContain("eth_sendRawTransaction");
    expect(rpc.calls.map((call) => call.method)).not.toContain("eth_sendTransaction");
  });
});
