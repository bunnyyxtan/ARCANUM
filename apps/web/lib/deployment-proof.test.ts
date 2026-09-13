import { encodeAbiParameters, encodeEventTopics } from "viem";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";

import { WalletFactoryAbi } from "@arcanum/contracts";

import { walletCreatedFromVerifiedReceipt } from "./deployment-proof";

const FACTORY = "0x4444444444444444444444444444444444444444" as const;
const OTHER_FACTORY = "0x5555555555555555555555555555555555555555" as const;
const OWNER = "0x1111111111111111111111111111111111111111" as const;
const OTHER_OWNER = "0x2222222222222222222222222222222222222222" as const;
const WALLET = "0x3333333333333333333333333333333333333333" as const;

function creationLog(address: string, owner: Address = OWNER) {
  return {
    address,
    topics: encodeEventTopics({
      abi: WalletFactoryAbi,
      eventName: "WalletCreated",
      args: { wallet: WALLET, owner },
    }) as readonly string[],
    data: encodeAbiParameters(
      [{ type: "string" }, { type: "uint256" }, { type: "uint256" }],
      ["Agent", 1n, 1n],
    ),
  };
}

describe("wallet deployment proof", () => {
  it("requires a successful receipt and matching configured-factory owner event", () => {
    expect(() =>
      walletCreatedFromVerifiedReceipt(
        { status: "reverted", logs: [] },
        { factoryAddress: FACTORY, ownerAddress: OWNER },
      ),
    ).toThrow(/reverted/);
    expect(() =>
      walletCreatedFromVerifiedReceipt(
        { status: "success", logs: [] },
        { factoryAddress: FACTORY, ownerAddress: OWNER },
      ),
    ).toThrow(/WalletCreated/);
  });

  it("rejects wrong factory, wrong owner, and predicted identity mismatch", () => {
    expect(() =>
      walletCreatedFromVerifiedReceipt(
        { status: "success", logs: [creationLog(OTHER_FACTORY)] },
        { factoryAddress: FACTORY, ownerAddress: OWNER },
      ),
    ).toThrow(/WalletCreated/);
    expect(() =>
      walletCreatedFromVerifiedReceipt(
        { status: "success", logs: [creationLog(FACTORY, OTHER_OWNER)] },
        { factoryAddress: FACTORY, ownerAddress: OWNER },
      ),
    ).toThrow(/WalletCreated/);
    expect(() =>
      walletCreatedFromVerifiedReceipt(
        { status: "success", logs: [creationLog(FACTORY)] },
        {
          factoryAddress: FACTORY,
          ownerAddress: OWNER,
          predictedWallet: OTHER_FACTORY,
        },
      ),
    ).toThrow(/WalletCreated/);
  });

  it("returns only the owner-bound wallet from the verified event", () => {
    expect(
      walletCreatedFromVerifiedReceipt(
        { status: "success", logs: [creationLog(FACTORY)] },
        { factoryAddress: FACTORY, ownerAddress: OWNER, predictedWallet: WALLET },
      ),
    ).toBe(WALLET);
  });
});
