import { describe, expect, it } from "vitest";
import type { Connector } from "wagmi";

import {
  WALLET_OPTIONS,
  availabilityOf,
  dappUrlFor,
  detectEnvironment,
  resolveConnector,
} from "./wallet-options";

function connector(id: string, name: string, type = "injected"): Connector {
  return { id, name, type } as unknown as Connector;
}

const option = (name: string) => {
  const found = WALLET_OPTIONS.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`no option named ${name}`);
  return found;
};

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1";
const DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/126.0 Safari/537.36";

describe("detectEnvironment", () => {
  it("treats phones and tablets as mobile", () => {
    expect(detectEnvironment(IPHONE, false).isMobile).toBe(true);
    expect(detectEnvironment("Mozilla/5.0 (Linux; Android 14)", false).isMobile).toBe(true);
    expect(detectEnvironment(DESKTOP, false).isMobile).toBe(false);
  });
});

describe("availabilityOf", () => {
  const catchAll = [connector("injected", "Injected")];

  it("offers the wallet app on a phone browser without an injected provider", () => {
    const env = detectEnvironment(IPHONE, false);
    expect(availabilityOf(option("MetaMask"), catchAll, env)).toBe("mobile-app");
    expect(availabilityOf(option("Coinbase Wallet"), catchAll, env)).toBe("mobile-app");
  });

  it("marks wallets without an in-app browser as desktop only on a phone", () => {
    const env = detectEnvironment(IPHONE, false);
    expect(availabilityOf(option("Rabby"), catchAll, env)).toBe("desktop-only");
  });

  it("falls back to the extension surface once a wallet app injects a provider", () => {
    const env = detectEnvironment(IPHONE, true);
    expect(availabilityOf(option("MetaMask"), catchAll, env)).toBe("extension");
  });

  it("reports announced extensions as installed regardless of device", () => {
    const connectors = [...catchAll, connector("io.metamask", "MetaMask")];
    expect(availabilityOf(option("MetaMask"), connectors, detectEnvironment(DESKTOP, true))).toBe(
      "installed",
    );
  });
});

describe("mobile links", () => {
  const dapp = dappUrlFor("https://arcanum.example");

  it("targets the landing page with the connect flag", () => {
    expect(dapp.toString()).toBe("https://arcanum.example/?connect=1");
  });

  it("builds a link for every option that claims one", () => {
    for (const candidate of WALLET_OPTIONS) {
      if (!candidate.mobileLink) continue;
      const link = candidate.mobileLink(dapp);
      expect(link.startsWith("https://")).toBe(true);
      expect(decodeURIComponent(link)).toContain("arcanum.example");
    }
  });

  it("keeps the connect flag inside the MetaMask path", () => {
    expect(option("MetaMask").mobileLink?.(dapp)).toBe(
      "https://metamask.app.link/dapp/arcanum.example/?connect=1",
    );
  });
});

describe("resolveConnector", () => {
  const catchAll = connector("injected", "Injected");

  it("prefers the announced extension the user asked for", () => {
    const metamask = connector("io.metamask", "MetaMask");
    const rabby = connector("io.rabby", "Rabby");
    expect(resolveConnector([catchAll, metamask, rabby], option("Rabby"), true)).toBe(rabby);
  });

  it("never routes one wallet's click to another announced wallet", () => {
    const metamask = connector("io.metamask", "MetaMask");
    expect(resolveConnector([catchAll, metamask], option("Phantom"), true)).toBeUndefined();
  });

  it("uses the catch-all only when a provider is injected and nothing announced itself", () => {
    expect(resolveConnector([catchAll], option("MetaMask"), true)).toBe(catchAll);
    expect(resolveConnector([catchAll], option("MetaMask"), false)).toBeUndefined();
  });

  it("accepts SDK connectors that need no extension", () => {
    const coinbase = connector("coinbaseWalletSDK", "Coinbase Wallet", "coinbaseWallet");
    expect(resolveConnector([catchAll, coinbase], option("Coinbase Wallet"), false)).toBe(coinbase);
  });
});
