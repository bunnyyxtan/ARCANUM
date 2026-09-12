/*
 * Browser-test fixture only. Never imported by app code.
 * Install with addInitScript before navigation, with all API/RPC traffic mocked.
 * No private key, signing implementation, network transport, or real wallet is used.
 */
function installSyntheticWallet(options) {
  const address = options.address;
  const ARC_CHAIN_ID = 5042002;
  const arcChain = `0x${ARC_CHAIN_ID.toString(16)}`;
  const chainId = options.chainId || ARC_CHAIN_ID;
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error("Synthetic wallet requires a valid fixture address");
  }
  let accounts = [address];
  let activeChain = `0x${chainId.toString(16)}`;
  const listeners = new Map();
  const calls = [];
  const permission = [{ parentCapability: "eth_accounts" }];
  const denied = (method) => {
    const error = new Error(`SYNTHETIC_WALLET_BLOCKED: ${method}`);
    error.code = 4001;
    return error;
  };
  const emit = (name, value) => {
    for (const listener of listeners.get(name) || []) listener(value);
  };
  const provider = {
    isMetaMask: true,
    isSyntheticAuditWallet: true,
    get selectedAddress() {
      return accounts[0] || null;
    },
    get chainId() {
      return activeChain;
    },
    isConnected: () => accounts.length > 0,
    on(name, listener) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(listener);
      return provider;
    },
    removeListener(name, listener) {
      listeners.get(name)?.delete(listener);
      return provider;
    },
    removeAllListeners(name) {
      if (name) listeners.delete(name);
      else listeners.clear();
      return provider;
    },
    async request({ method, params }) {
      calls.push({ method, params: params || [] });
      switch (method) {
        case "eth_accounts":
          return [...accounts];
        case "eth_requestAccounts":
          accounts = [address];
          emit("connect", { chainId: activeChain });
          return [...accounts];
        case "eth_chainId":
          return activeChain;
        case "net_version":
          return String(Number.parseInt(activeChain, 16));
        case "wallet_getPermissions":
        case "wallet_requestPermissions":
          return permission;
        case "wallet_revokePermissions":
          return null;
        case "wallet_addEthereumChain": {
          const next = params?.[0]?.chainId;
          if (next !== `0x${chainId.toString(16)}`) throw denied(method);
          activeChain = next;
          emit("chainChanged", activeChain);
          return null;
        }
        case "wallet_switchEthereumChain": {
          const next = params?.[0]?.chainId;
          if (next !== arcChain) throw denied(method);
          activeChain = next;
          emit("chainChanged", activeChain);
          return null;
        }
        // Optional transaction simulation is an exact fixture lookup, not a send.
        // Unknown transactions and all signature methods always reject.
        case "eth_sendTransaction": {
          if (activeChain !== arcChain) throw denied(method);
          const tx = params?.[0];
          const fixture = options.transactions?.find(
            (item) =>
              item.to.toLowerCase() === tx?.to?.toLowerCase() &&
              item.data.toLowerCase() === tx?.data?.toLowerCase() &&
              (item.value || "0x0").toLowerCase() === (tx?.value || "0x0").toLowerCase(),
          );
          if (!fixture || tx?.from?.toLowerCase() !== address.toLowerCase()) {
            throw denied(method);
          }
          return fixture.hash;
        }
        default:
          throw denied(method);
      }
    },
  };
  const info = {
    uuid: "7f6de325-55cc-4b52-bafb-985f699bc90a",
    name: "MetaMask",
    rdns: "io.metamask",
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%234c6fff'/%3E%3Cpath d='M8 9h16v14H8z' fill='white'/%3E%3C/svg%3E",
  };
  const announce = () =>
    window.dispatchEvent(
      new CustomEvent("eip6963:announceProvider", { detail: { info, provider } }),
    );
  Object.defineProperty(window, "ethereum", {
    configurable: true,
    value: provider,
    writable: false,
  });
  window.addEventListener("eip6963:requestProvider", announce);
  announce();
  window.__syntheticWalletAudit = {
    provider,
    calls,
    disconnect() {
      accounts = [];
      emit("accountsChanged", []);
    },
    changeAccount(next) {
      if (!/^0x[0-9a-fA-F]{40}$/.test(next)) throw new Error("Invalid fixture address");
      accounts = [next];
      emit("accountsChanged", [...accounts]);
    },
    setChainId(next) {
      if (!Number.isInteger(next) || next < 0) {
        throw new Error("Invalid fixture chain ID");
      }
      activeChain = `0x${next.toString(16)}`;
      emit("chainChanged", activeChain);
    },
  };
  return provider;
}

module.exports = { installSyntheticWallet };
