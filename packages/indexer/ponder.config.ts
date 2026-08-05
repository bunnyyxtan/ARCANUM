import {
  AnomalyOracleAbi,
  EscalationManagerAbi,
  GuardedWalletAbi,
  VendorRegistryAbi,
  WalletFactoryAbi,
} from "@arcanum/contracts";
import { createConfig } from "ponder";

import { loadDeployment } from "./src/deployment";

const deployment = loadDeployment();

const contracts = {
  WalletFactory: {
    chain: "arcTestnet",
    abi: WalletFactoryAbi,
    address: deployment.walletFactory,
    startBlock: deployment.startBlock,
  },
  EscalationManager: {
    chain: "arcTestnet",
    abi: EscalationManagerAbi,
    address: deployment.escalationManager,
    startBlock: deployment.startBlock,
  },
  AnomalyOracle: {
    chain: "arcTestnet",
    abi: AnomalyOracleAbi,
    address: deployment.anomalyOracle,
    startBlock: deployment.startBlock,
  },
  VendorRegistry: {
    chain: "arcTestnet",
    abi: VendorRegistryAbi,
    address: deployment.vendorRegistry,
    startBlock: deployment.startBlock,
  },
  GuardedWallet: {
    chain: "arcTestnet",
    abi: GuardedWalletAbi,
    factory: {
      address: deployment.walletFactory,
      event: WalletFactoryAbi.find(
        (item) => item.type === "event" && item.name === "WalletCreated",
      ),
      parameter: "wallet",
    },
    startBlock: deployment.startBlock,
  },
} as const;

export default createConfig({
  database: {
    kind: "postgres",
    connectionString:
      process.env.DATABASE_URL ?? "postgresql://arcanum:arcanum@localhost:5432/arcanum",
  },
  chains: {
    arcTestnet: {
      id: 5_042_002,
      // The official public RPC (rpc.testnet.arc.network) rate-limits
      // eth_getLogs so aggressively that a backfill never progresses, so the
      // dRPC public endpoint goes first and the official one is the fallback.
      rpc: [
        process.env.ARC_TESTNET_RPC ?? process.env.PONDER_RPC_URL_5042002,
        "https://arc-testnet.drpc.org",
        "https://rpc.testnet.arc.network",
      ].filter((url): url is string => Boolean(url)),
      pollingInterval: 4_000,
      maxRequestsPerSecond: 10,
      ethGetLogsBlockRange: 2_000,
    },
  },
  contracts: contracts as never,
});
