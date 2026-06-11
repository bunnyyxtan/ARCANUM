import { createConfig } from "ponder";

export default createConfig({
  database: {
    kind: "pglite",
    directory: "./.ponder/pglite",
  },
  chains: {
    arcTestnet: {
      id: 5_042_002,
      rpc: process.env.PONDER_RPC_URL_5042002 ?? "https://rpc.testnet.arc.network",
      ws: "wss://rpc.testnet.arc.network/ws",
    },
  },
  contracts: {},
});
