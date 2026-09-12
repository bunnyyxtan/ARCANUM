import { afterEach, describe, expect, it } from "vitest";

import {
  clearWalletLaunch,
  consumeWalletLaunch,
  requestWalletLaunch,
} from "./wallet-launch-intent";

afterEach(() => {
  clearWalletLaunch();
});

describe("wallet launch intent", () => {
  it("survives the connection boundary until the wallet is connected", () => {
    requestWalletLaunch();

    expect(consumeWalletLaunch(false)).toBe(false);
    expect(consumeWalletLaunch(true)).toBe(true);
    expect(consumeWalletLaunch(true)).toBe(false);
  });

  it("can be cleared when connection fails", () => {
    requestWalletLaunch();
    clearWalletLaunch();

    expect(consumeWalletLaunch(true)).toBe(false);
  });
});
