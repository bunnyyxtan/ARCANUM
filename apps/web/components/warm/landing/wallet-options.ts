import type { Connector } from "wagmi";

/**
 * Where a wallet can be reached from. Desktop browsers get an injected
 * extension. Phones have no extensions: the wallet app ships its own browser,
 * and the only way to connect a site is to open the site inside it through a
 * deep link. WalletConnect covers the rest, but only when a project id is
 * configured, so it is never assumed here.
 */
export type WalletOption = {
  name: string;
  logo: string;
  match: string[];
  /** Builds the wallet app's in-app-browser link for a dapp URL, if it has one. */
  mobileLink?: (dappUrl: URL) => string;
};

export const WALLET_OPTIONS: WalletOption[] = [
  {
    name: "MetaMask",
    logo: "/wallets/metamask.png",
    match: ["metamask", "io.metamask"],
    mobileLink: (url) => `https://metamask.app.link/dapp/${url.host}${url.pathname}${url.search}`,
  },
  {
    name: "Rabby",
    logo: "/wallets/rabby.png",
    match: ["rabby", "io.rabby"],
  },
  {
    name: "OKX Wallet",
    logo: "/wallets/okx.png",
    match: ["okx", "com.okex.wallet"],
    mobileLink: (url) => {
      const scheme = `okx://wallet/dapp/url?dappUrl=${encodeURIComponent(url.toString())}`;
      return `https://www.okx.com/download?deeplink=${encodeURIComponent(scheme)}`;
    },
  },
  {
    name: "Phantom",
    logo: "/wallets/phantom.png",
    match: ["phantom", "app.phantom"],
    mobileLink: (url) =>
      `https://phantom.app/ul/browse/${encodeURIComponent(url.toString())}?ref=${encodeURIComponent(url.origin)}`,
  },
  {
    name: "Coinbase Wallet",
    logo: "/wallets/coinbase.png",
    match: ["coinbase", "coinbasewalletsdk", "com.coinbase.wallet"],
    mobileLink: (url) => `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(url.toString())}`,
  },
];

export type Environment = {
  /** Phone or tablet browser, judged by the user agent. */
  isMobile: boolean;
  /** Something sits on window.ethereum, announced or not. */
  hasInjectedProvider: boolean;
};

export function detectEnvironment(userAgent: string, hasInjectedProvider: boolean): Environment {
  return {
    isMobile: /android|iphone|ipad|ipod/i.test(userAgent),
    hasInjectedProvider,
  };
}

/** Which surface a wallet option should be presented as, given the visitor. */
export type Availability = "installed" | "extension" | "mobile-app" | "desktop-only";

export function availabilityOf(
  option: WalletOption,
  connectors: readonly Connector[],
  environment: Environment,
): Availability {
  if (isDetected(connectors, option)) return "installed";
  if (!environment.isMobile || environment.hasInjectedProvider) return "extension";
  return option.mobileLink ? "mobile-app" : "desktop-only";
}

export function availabilityHint(availability: Availability): string {
  switch (availability) {
    case "installed":
      return "Installed";
    case "extension":
      return "Browser extension";
    case "mobile-app":
      return "Opens in the wallet app";
    case "desktop-only":
      return "Desktop extension only";
  }
}

/**
 * The URL a wallet app should open this site at. Always the landing page with
 * the connect flag, so the modal reopens by itself once the page loads inside
 * the wallet's browser and the visitor is not left hunting for the button again.
 */
export function dappUrlFor(origin: string): URL {
  const url = new URL("/", origin);
  url.searchParams.set("connect", "1");
  return url;
}

function matchesOption(connector: Connector, option: WalletOption): boolean {
  return option.match.some(
    (needle) =>
      connector.id.toLowerCase().includes(needle) || connector.name.toLowerCase().includes(needle),
  );
}

/**
 * A wallet extension announced through EIP-6963 shows up as its own injected
 * connector with the extension's reverse-DNS id (io.rabby, app.phantom, ...).
 * The generic "injected" connector is wagmi's catch-all, not a detection.
 */
function isAnnouncedExtension(connector: Connector): boolean {
  return connector.type === "injected" && connector.id !== "injected";
}

export function isDetected(connectors: readonly Connector[], option: WalletOption): boolean {
  return connectors.some(
    (connector) => isAnnouncedExtension(connector) && matchesOption(connector, option),
  );
}

export function resolveConnector(
  connectors: readonly Connector[],
  option: WalletOption,
  hasInjectedProvider: boolean,
): Connector | undefined {
  // 1. The extension the user actually asked for, announced via EIP-6963.
  const announced = connectors.find(
    (connector) => isAnnouncedExtension(connector) && matchesOption(connector, option),
  );
  if (announced) return announced;
  // 2. SDK-backed connectors (e.g. Coinbase Wallet) work without an extension.
  const sdk = connectors.find((connector) => matchesOption(connector, option));
  if (sdk) return sdk;
  // 3. Development-only test wallet stands in for every option locally.
  const testWallet = connectors.find(
    (connector) =>
      connector.id.toLowerCase().includes("arcanum") ||
      connector.name.toLowerCase().includes("arcanum"),
  );
  if (testWallet) return testWallet;
  // 4. Legacy browsers and wallet in-app browsers: a wallet sits on
  // window.ethereum without announcing itself. Only use the catch-all when NO
  // extension announced itself, so clicking Phantom can never secretly open
  // MetaMask.
  const anyAnnounced = connectors.some(isAnnouncedExtension);
  if (!anyAnnounced && hasInjectedProvider) {
    return connectors.find(
      (connector) => connector.id === "injected" || connector.type === "injected",
    );
  }
  return undefined;
}
