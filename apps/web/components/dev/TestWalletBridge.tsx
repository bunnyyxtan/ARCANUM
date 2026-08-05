"use client";

import { ARC_TESTNET_RPC_URL } from "@arcanum/shared";
import { useEffect } from "react";

/**
 * Installs a development-only EIP-1193 provider on `window.ethereum` so an
 * automated browser can connect a wallet and sign SIWE messages and
 * transactions without a browser extension.
 *
 * Private keys never reach the browser: every signing request is forwarded to
 * the dev-only /api/dev/test-wallet route, which signs server side. Read calls
 * go straight to the Arc Testnet RPC.
 *
 * Switch personas with ?testWallet=agent|operator|vendorA|vendorB — the choice
 * is remembered in localStorage so navigation keeps the same identity.
 */

const ROLE_STORAGE_KEY = "arcanum-test-wallet-role";
const ROLES = ["operator", "agent", "vendorA", "vendorB"] as const;
type Role = (typeof ROLES)[number];

type Listener = (payload: unknown) => void;

function currentRole(): Role {
  if (typeof window === "undefined") {
    return "operator";
  }

  const fromQuery = new URLSearchParams(window.location.search).get("testWallet");
  if (fromQuery && (ROLES as readonly string[]).includes(fromQuery)) {
    window.localStorage.setItem(ROLE_STORAGE_KEY, fromQuery);
    return fromQuery as Role;
  }

  const stored = window.localStorage.getItem(ROLE_STORAGE_KEY);
  return stored && (ROLES as readonly string[]).includes(stored) ? (stored as Role) : "operator";
}

async function callTestWallet(method: string, params: unknown[]) {
  const response = await fetch("/api/dev/test-wallet", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ method, params, role: currentRole() }),
  });
  const payload = (await response.json()) as { result?: unknown; error?: string };

  if (!response.ok || payload.error) {
    throw Object.assign(new Error(payload.error ?? "Test wallet request failed."), { code: 4001 });
  }

  return payload.result;
}

async function callRpc(method: string, params: unknown[]) {
  const response = await fetch(ARC_TESTNET_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const payload = (await response.json()) as { result?: unknown; error?: { message?: string } };

  if (payload.error) {
    throw new Error(payload.error.message ?? `RPC call ${method} failed.`);
  }

  return payload.result;
}

function createTestProvider() {
  const listeners = new Map<string, Set<Listener>>();
  let cachedAddress: string | null = null;
  let cachedChainId: string | null = null;

  async function ensureIdentity() {
    if (cachedAddress && cachedChainId) {
      return { address: cachedAddress, chainId: cachedChainId };
    }

    const response = await fetch(`/api/dev/test-wallet?role=${currentRole()}`);
    if (!response.ok) {
      throw new Error("Test wallet is not available.");
    }

    const payload = (await response.json()) as { address: string; chainId: number };
    cachedAddress = payload.address;
    cachedChainId = `0x${payload.chainId.toString(16)}`;
    return { address: cachedAddress, chainId: cachedChainId };
  }

  function emit(event: string, payload: unknown) {
    for (const listener of listeners.get(event) ?? []) {
      listener(payload);
    }
  }

  return {
    isMetaMask: true,
    isArcanumTestWallet: true,
    async request({ method, params = [] }: { method: string; params?: unknown[] }) {
      switch (method) {
        case "eth_requestAccounts":
        case "eth_accounts": {
          const { address, chainId } = await ensureIdentity();
          emit("connect", { chainId });
          return [address];
        }
        case "eth_chainId": {
          const { chainId } = await ensureIdentity();
          return chainId;
        }
        case "net_version": {
          const { chainId } = await ensureIdentity();
          return String(Number.parseInt(chainId, 16));
        }
        case "wallet_switchEthereumChain":
        case "wallet_addEthereumChain":
        case "wallet_requestPermissions":
        case "wallet_revokePermissions":
          return null;
        case "personal_sign":
        case "eth_sign":
        case "eth_signTypedData":
        case "eth_signTypedData_v3":
        case "eth_signTypedData_v4":
        case "eth_sendTransaction":
          return callTestWallet(method, params);
        default:
          return callRpc(method, params);
      }
    },
    on(event: string, listener: Listener) {
      const bucket = listeners.get(event) ?? new Set<Listener>();
      bucket.add(listener);
      listeners.set(event, bucket);
      return this;
    },
    removeListener(event: string, listener: Listener) {
      listeners.get(event)?.delete(listener);
      return this;
    },
    // Some connectors probe for these legacy hooks before using `request`.
    removeAllListeners() {
      listeners.clear();
      return this;
    },
  };
}

function installTestWallet() {
  if (typeof window === "undefined") {
    return;
  }

  const globalWindow = window as typeof window & { ethereum?: unknown };
  const existing = globalWindow.ethereum as { isArcanumTestWallet?: boolean } | undefined;
  const provider = existing?.isArcanumTestWallet ? existing : createTestProvider();

  if (!existing?.isArcanumTestWallet) {
    Object.defineProperty(globalWindow, "ethereum", {
      value: provider,
      writable: true,
      configurable: true,
    });
  }

  const detail = Object.freeze({
    info: {
      uuid: "0f2f9d4a-9f6a-4f27-9c5e-6c6f7f6f6f6f",
      name: "Arcanum Test Wallet",
      icon: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAzMiAzMiI+PHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiBmaWxsPSIjRkY1QTFGIi8+PC9zdmc+",
      rdns: "network.arcanum.testwallet",
    },
    provider,
  });

  const announce = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail }));
  window.addEventListener("eip6963:requestProvider", announce);
  announce();
}

export function TestWalletBridge() {
  useEffect(() => {
    installTestWallet();
    console.info("[Arcanum] Dev test wallet installed. Role:", currentRole());
  }, []);

  return null;
}
