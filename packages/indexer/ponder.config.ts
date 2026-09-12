import {
  AnomalyOracleAbi,
  EscalationManagerAbi,
  GuardedWalletAbi,
  VendorRegistryAbi,
  WalletFactoryAbi,
} from "@arcanum/contracts";
import { ARC_CHAIN_ID, ARC_RPC_URL, IS_ARC_MAINNET } from "@arcanum/shared";
import { loadBalance, rateLimit } from "@ponder/utils";
import { createConfig } from "ponder";
import { http } from "viem";

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

// The official public RPC (rpc.testnet.arc.network) answers a 10,000 block
// eth_getLogs in ~100ms but returns 429 above roughly two requests per second.
// Ponder's own adaptive limiter never goes below 3 requests per second and
// gives up on a request after ten 429s in a row, which is exactly how a
// backfill against that endpoint used to die a few seconds after starting.
// Every endpoint is therefore wrapped in a fixed-rate queue instead. The free
// dRPC endpoint is no longer listed at all: its plan rejects any eth_getLogs
// range above 100 blocks, and with a fixed block range Ponder does not shrink
// requests on that error, so every request routed there failed and a backfill
// crawled at a few hundred blocks per minute (2026-09-12). An env override,
// when set, is load-balanced with the configured official endpoint.
const rpcUrls = Array.from(
  new Set(
    [
      process.env.ARC_RPC_URL ?? process.env.ARC_TESTNET_RPC ?? process.env.PONDER_RPC_URL_5042002,
      ARC_RPC_URL,
    ].filter((url): url is string => Boolean(url)),
  ),
);

const rpcRequestsPerSecond = Number(process.env.INDEXER_RPC_REQUESTS_PER_SECOND ?? "2");
if (!Number.isInteger(rpcRequestsPerSecond) || rpcRequestsPerSecond < 1) {
  throw new Error(
    `INDEXER_RPC_REQUESTS_PER_SECOND must be a positive integer, got ${JSON.stringify(process.env.INDEXER_RPC_REQUESTS_PER_SECOND)}`,
  );
}

const [firstRpcTransport, ...otherRpcTransports] = rpcUrls.map((url) =>
  rateLimit(http(url), { requestsPerSecond: rpcRequestsPerSecond }),
);
if (!firstRpcTransport) {
  throw new Error("No Arc RPC URL is configured for the indexer");
}
const rpcTransport =
  otherRpcTransports.length === 0
    ? firstRpcTransport
    : loadBalance([firstRpcTransport, ...otherRpcTransports]);

export default createConfig({
  // Run this app with `ponder start --schema ponder_app` (the `start` script /
  // the "ARCANUM Indexer" workflow), NOT `ponder dev`. `ponder dev` drops the
  // schema and re-indexes from the deployment start block on every restart,
  // which grows unboundedly (~86K blocks/day on the configured Arc network).
  // `ponder start` against a persistent DATABASE_URL resumes from its
  // checkpoint in the `ponder_app` schema, returning to live indexing in under
  // a minute.
  database: {
    kind: "postgres",
    connectionString: databaseUrl,
  },
  chains: {
    [chainKey]: {
      id: ARC_CHAIN_ID,
      // See `rpcTransport` above for why the endpoints are rate limited here
      // rather than left to Ponder's adaptive limiter.
      rpc: rpcTransport,
      pollingInterval: 4_000,
      ethGetLogsBlockRange: 10_000,
    },
  },
  contracts: contracts as never,
});
