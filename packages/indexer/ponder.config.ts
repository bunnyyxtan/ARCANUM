import {
  AnomalyOracleAbi,
  EscalationManagerAbi,
  GuardedWalletAbi,
  VendorRegistryAbi,
  WalletFactoryAbi,
} from "@arcanum/contracts";
import { ARC_CHAIN_ID, ARC_RPC_URL, IS_ARC_MAINNET } from "@arcanum/shared";
import { createConfig } from "ponder";

import { loadDeployment } from "./src/deployment";

const deployment = loadDeployment();

// On testnet the key stays "arcTestnet" to preserve the existing sync
// checkpoint. Mainnet gets its own key so Ponder starts a fresh checkpoint
// namespace instead of resuming testnet sync state against a different chain.
const chainKey = IS_ARC_MAINNET ? "arcMainnet" : "arcTestnet";

const contracts = {
  WalletFactory: {
    chain: chainKey,
    abi: WalletFactoryAbi,
    address: deployment.walletFactory,
    startBlock: deployment.startBlock,
  },
  EscalationManager: {
    chain: chainKey,
    abi: EscalationManagerAbi,
    address: deployment.escalationManager,
    startBlock: deployment.startBlock,
  },
  AnomalyOracle: {
    chain: chainKey,
    abi: AnomalyOracleAbi,
    address: deployment.anomalyOracle,
    startBlock: deployment.startBlock,
  },
  VendorRegistry: {
    chain: chainKey,
    abi: VendorRegistryAbi,
    address: deployment.vendorRegistry,
    startBlock: deployment.startBlock,
  },
  GuardedWallet: {
    chain: chainKey,
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

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

export default createConfig({
  // Run this app with `ponder start --schema ponder_app` (the `start` script /
  // the "ARCANUM Indexer" workflow), NOT `ponder dev`. `ponder dev` drops the
  // schema and re-indexes from the deployment start block on every restart,
  // which grows unboundedly (~86K Arc Testnet blocks/day). `ponder start`
  // against a persistent DATABASE_URL resumes from its checkpoint in the
  // `ponder_app` schema, returning to live indexing in under a minute.
  database: {
    kind: "postgres",
    connectionString: databaseUrl,
  },
  chains: {
    [chainKey]: {
      id: ARC_CHAIN_ID,
      // The official public RPC (rpc.testnet.arc.network) rate-limits
      // eth_getLogs so aggressively that a backfill never progresses, so the
      // dRPC public endpoint goes first and the official one is the fallback.
      // Mainnet mirrors are unknown until launch, so mainnet uses only the
      // env override plus the configured official endpoint.
      rpc: [
        process.env.ARC_RPC_URL ??
          process.env.ARC_TESTNET_RPC ??
          process.env.PONDER_RPC_URL_5042002,
        ...(IS_ARC_MAINNET ? [] : ["https://arc-testnet.drpc.org"]),
        ARC_RPC_URL,
      ].filter((url): url is string => Boolean(url)),
      pollingInterval: 4_000,
      maxRequestsPerSecond: 10,
      ethGetLogsBlockRange: 2_000,
    },
  },
  contracts: contracts as never,
});
