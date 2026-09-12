import { createRequire } from "node:module";
import {
  type CreateConnectorFn,
  connect,
  createConfig,
  disconnect,
  getConnectorClient,
  watchAccount,
  watchChainId,
} from "@wagmi/core";
import { EthereumProvider } from "@walletconnect/ethereum-provider";
import { http, type Chain, type EIP1193Provider } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { injected, walletConnect } from "wagmi/connectors";

type RequestArguments = {
  method: string;
  params?: unknown[] | object;
};

type Listener = (value?: unknown) => void;

class EventHub {
  private readonly listeners = new Map<string, Set<Listener>>();

  on(event: string, listener: Listener) {
    const listeners = this.listeners.get(event) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return this;
  }

  removeListener(event: string, listener: Listener) {
    this.listeners.get(event)?.delete(listener);
    return this;
  }

  emit(event: string, value?: unknown) {
    for (const listener of this.listeners.get(event) ?? []) listener(value);
  }

  setMaxListeners(_count: number) {
    return this;
  }
}

const ARC_CHAIN = {
  id: 5_042_002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://offline.invalid/arc"] },
    public: { http: ["https://offline.invalid/arc"] },
  },
  testnet: true,
} as const satisfies Chain;

const SECOND_CHAIN = {
  id: 5_042_003,
  name: "Arc Testnet Secondary",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://offline.invalid/arc-secondary"] },
    public: { http: ["https://offline.invalid/arc-secondary"] },
  },
  testnet: true,
} as const satisfies Chain;

const CHAINS = [ARC_CHAIN, SECOND_CHAIN] as const;
const TRANSPORTS = {
  [ARC_CHAIN.id]: http(ARC_CHAIN.rpcUrls.default.http[0]),
  [SECOND_CHAIN.id]: http(SECOND_CHAIN.rpcUrls.default.http[0]),
};

const OWNER = "0x1000000000000000000000000000000000000001";
const SECOND_ACCOUNT = "0x2000000000000000000000000000000000000002";
const REJECTED_METHODS = new Set([
  "eth_sendTransaction",
  "eth_sign",
  "eth_signTypedData_v4",
  "personal_sign",
]);

class FakeInjectedProvider extends EventHub {
  accounts = [OWNER];
  chainId: number = ARC_CHAIN.id;
  readonly calls: RequestArguments[] = [];

  async request({ method }: RequestArguments) {
    this.calls.push({ method });
    if (REJECTED_METHODS.has(method)) {
      throw Object.assign(new Error("FAKE_USER_REJECTED"), { code: 4001 });
    }
    if (method === "wallet_requestPermissions") {
      return [{ caveats: [{ type: "filterResponse", value: [...this.accounts] }] }];
    }
    if (method === "eth_accounts" || method === "eth_requestAccounts") {
      return [...this.accounts];
    }
    if (method === "eth_chainId") return `0x${this.chainId.toString(16)}`;
    if (method === "wallet_revokePermissions") return null;
    throw new Error(`UNEXPECTED_OFFLINE_PROVIDER_METHOD: ${method}`);
  }

  setAccounts(accounts: string[]) {
    this.accounts = [...accounts];
  }

  setChainId(chainId: number) {
    this.chainId = chainId;
  }
}

class FakeWalletConnectProvider extends EventHub {
  readonly events = this;
  readonly calls: RequestArguments[] = [];
  readonly connectOptions: unknown[] = [];
  accounts = [OWNER];
  chainId: number = ARC_CHAIN.id;
  session:
    | {
        namespaces: { eip155: { accounts: string[] } };
      }
    | undefined;
  disconnectCalls = 0;

  async connect(options: unknown) {
    this.connectOptions.push(options);
    const requestedChains =
      typeof options === "object" && options !== null && "optionalChains" in options
        ? (options as { optionalChains?: unknown }).optionalChains
        : undefined;
    if (Array.isArray(requestedChains) && typeof requestedChains[0] === "number") {
      this.setChainId(requestedChains[0]);
    }
    this.session = {
      namespaces: {
        eip155: {
          accounts: [`eip155:${this.chainId}:${this.accounts[0]}`],
        },
      },
    };
    this.emit("display_uri", "wc:offline-regression");
  }

  async enable() {
    return [...this.accounts];
  }

  async disconnect() {
    this.disconnectCalls += 1;
    this.session = undefined;
  }

  async request({ method, params }: RequestArguments) {
    this.calls.push({ method });
    if (REJECTED_METHODS.has(method)) {
      throw Object.assign(new Error("FAKE_WALLETCONNECT_USER_REJECTED"), { code: 4001 });
    }
    if (method === "eth_accounts" || method === "eth_requestAccounts") {
      return [...this.accounts];
    }
    if (method === "eth_chainId") return `0x${this.chainId.toString(16)}`;
    if (method === "wallet_switchEthereumChain") {
      const chainParameter = Array.isArray(params) ? params[0] : undefined;
      const requestedChainId =
        typeof chainParameter === "object" && chainParameter !== null && "chainId" in chainParameter
          ? (chainParameter as { chainId?: unknown }).chainId
          : undefined;
      if (typeof requestedChainId !== "string") {
        throw new Error("INVALID_OFFLINE_SWITCH_CHAIN_REQUEST");
      }
      const chainId = Number(requestedChainId);
      if (!Number.isInteger(chainId)) throw new Error("INVALID_OFFLINE_CHAIN_ID");
      this.setChainId(chainId);
      this.emit("chainChanged", `0x${chainId.toString(16)}`);
      return null;
    }
    return "0x";
  }

  setAccounts(accounts: string[]) {
    this.accounts = [...accounts];
  }

  setChainId(chainId: number) {
    this.chainId = chainId;
  }
}

function createOfflineConfig(connector: CreateConnectorFn) {
  return createConfig({
    chains: CHAINS,
    connectors: [connector],
    transports: TRANSPORTS,
    multiInjectedProviderDiscovery: false,
    ssr: true,
  });
}

beforeEach(() => {
  vi.stubGlobal("window", {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("OFFLINE_TEST_FETCH_BLOCKED");
    }),
  );
  vi.stubGlobal(
    "WebSocket",
    class OfflineWebSocket {
      constructor() {
        throw new Error("OFFLINE_TEST_WEBSOCKET_BLOCKED");
      }
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("offline wallet dependency upgrade contracts", () => {
  it("keeps the real injected connector lifecycle and EIP-1193 forwarding", async () => {
    const provider = new FakeInjectedProvider();
    const connector = injected({
      target: {
        id: "offline-injected",
        name: "Offline Injected",
        provider: provider as unknown as EIP1193Provider,
      },
    });
    const config = createOfflineConfig(connector);
    const accountEvents: string[] = [];
    const chainEvents: number[] = [];
    const unwatchAccount = watchAccount(config, {
      onChange(account) {
        if (account.address) accountEvents.push(account.address);
      },
    });
    const unwatchChain = watchChainId(config, {
      onChange(chainId) {
        chainEvents.push(chainId);
      },
    });
    const liveConnector = config.connectors[0];
    if (!liveConnector) throw new Error("Expected the offline injected connector");

    await expect(
      connect(config, { connector: liveConnector, chainId: ARC_CHAIN.id }),
    ).resolves.toEqual({
      accounts: [OWNER],
      chainId: ARC_CHAIN.id,
    });

    const client = await getConnectorClient(config, { connector: liveConnector });
    await expect(client.request({ method: "eth_chainId" })).resolves.toBe(
      `0x${ARC_CHAIN.id.toString(16)}`,
    );
    await expect(
      client.request({ method: "personal_sign", params: ["0xdead", OWNER] }),
    ).rejects.toThrow("FAKE_USER_REJECTED");
    expect(provider.calls.map(({ method }) => method)).toContain("personal_sign");

    provider.setAccounts([SECOND_ACCOUNT]);
    provider.emit("accountsChanged", [SECOND_ACCOUNT]);
    expect(accountEvents.at(-1)).toBe(SECOND_ACCOUNT);

    provider.setChainId(SECOND_CHAIN.id);
    provider.emit("chainChanged", `0x${SECOND_CHAIN.id.toString(16)}`);
    expect(chainEvents.at(-1)).toBe(SECOND_CHAIN.id);

    provider.emit("disconnect", { code: 4900, message: "offline disconnect" });
    await Promise.resolve();
    expect(config.state.status).toBe("disconnected");

    provider.setAccounts([OWNER]);
    await connect(config, { connector: liveConnector, chainId: ARC_CHAIN.id });
    expect(config.state.status).toBe("connected");

    await disconnect(config, { connector: liveConnector });
    expect(provider.calls.map(({ method }) => method)).toContain("wallet_revokePermissions");
    expect(config.state.status).toBe("disconnected");

    await connect(config, { connector: liveConnector, chainId: ARC_CHAIN.id });
    expect(config.state.status).toBe("connected");

    unwatchAccount();
    unwatchChain();
  });

  it("proves EthereumProvider's surface before replacing init", async () => {
    const publicProvider = new EthereumProvider();
    expect(typeof EthereumProvider.init).toBe("function");
    expect(typeof publicProvider.request).toBe("function");
    expect(typeof publicProvider.on).toBe("function");
    expect(typeof publicProvider.disconnect).toBe("function");

    const provider = new FakeWalletConnectProvider();
    const init = vi.spyOn(EthereumProvider, "init").mockImplementation(async () => {
      return provider as unknown as InstanceType<typeof EthereumProvider>;
    });
    const connector = walletConnect({
      projectId: "offline-regression-project",
      showQrModal: false,
      metadata: {
        name: "Offline regression",
        description: "Offline connector contract test",
        url: "https://offline.invalid",
        icons: [],
      },
    });
    const config = createOfflineConfig(connector);
    const accountEvents: string[] = [];
    const chainEvents: number[] = [];
    const messages: unknown[] = [];
    const unwatchAccount = watchAccount(config, {
      onChange(account) {
        if (account.address) accountEvents.push(account.address);
      },
    });
    const unwatchChain = watchChainId(config, {
      onChange(chainId) {
        chainEvents.push(chainId);
      },
    });
    const liveConnector = config.connectors[0];
    if (!liveConnector) throw new Error("Expected the offline WalletConnect connector");
    liveConnector.emitter.on("message", (message) => messages.push(message));

    await expect(
      connect(config, { connector: liveConnector, chainId: ARC_CHAIN.id }),
    ).resolves.toEqual({
      accounts: [OWNER],
      chainId: ARC_CHAIN.id,
    });
    expect(init).toHaveBeenCalledOnce();
    expect(init.mock.calls[0]?.[0]).toMatchObject({
      disableProviderPing: true,
      optionalChains: [ARC_CHAIN.id, SECOND_CHAIN.id],
      projectId: "offline-regression-project",
      showQrModal: false,
    });
    expect(messages).toContainEqual(
      expect.objectContaining({
        type: "display_uri",
        data: "wc:offline-regression",
      }),
    );

    const client = await getConnectorClient(config, { connector: liveConnector });
    await expect(client.request({ method: "eth_chainId" })).resolves.toBe(
      `0x${ARC_CHAIN.id.toString(16)}`,
    );
    await expect(
      client.request({ method: "personal_sign", params: ["0xdead", OWNER] }),
    ).rejects.toThrow("FAKE_WALLETCONNECT_USER_REJECTED");
    expect(provider.calls.map(({ method }) => method)).toContain("personal_sign");

    provider.setAccounts([SECOND_ACCOUNT]);
    provider.emit("accountsChanged", [SECOND_ACCOUNT]);
    expect(accountEvents.at(-1)).toBe(SECOND_ACCOUNT);

    provider.setChainId(SECOND_CHAIN.id);
    provider.emit("chainChanged", `0x${SECOND_CHAIN.id.toString(16)}`);
    expect(chainEvents.at(-1)).toBe(SECOND_CHAIN.id);

    provider.session = undefined;
    provider.emit("disconnect", { code: 4900, message: "offline disconnect" });
    await Promise.resolve();
    expect(config.state.status).toBe("disconnected");

    provider.setAccounts([OWNER]);
    await connect(config, { connector: liveConnector, chainId: ARC_CHAIN.id });
    expect(config.state.status).toBe("connected");

    await disconnect(config, { connector: liveConnector });
    expect(provider.disconnectCalls).toBe(1);
    expect(config.state.status).toBe("disconnected");

    await connect(config, { connector: liveConnector, chainId: ARC_CHAIN.id });
    expect(config.state.status).toBe("connected");
    expect(provider.connectOptions.length).toBeGreaterThanOrEqual(2);
    expect(fetch).not.toHaveBeenCalled();

    await disconnect(config, { connector: liveConnector });
    expect(config.state.status).toBe("disconnected");
    unwatchAccount();
    unwatchChain();
  });

  it("keeps MetaMask's CJS uuid v4 boundary callable without pinning a version", () => {
    const resolver = createRequire(import.meta.url);
    const metaMaskRequire = createRequire(resolver.resolve("@metamask/sdk"));
    const uuid = metaMaskRequire("uuid") as { v4?: () => string };

    expect(typeof uuid.v4).toBe("function");
    expect(uuid.v4?.()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
