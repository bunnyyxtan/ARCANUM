import {
  AnomalyOracleAbi,
  EscalationManagerAbi,
  GuardedWalletAbi,
  VendorRegistryAbi,
  WalletFactoryAbi,
} from "@arcanum/contracts";
import { ARC_CHAIN_ID, ARC_RPC_URL, IS_ARC_MAINNET } from "@arcanum/shared";
import { rateLimit } from "@ponder/utils";
import { createConfig, factory } from "ponder";
import { http, getAbiItem } from "viem";

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
    // Wallets are discovered through the factory's WalletCreated event. This
    // has to be `address: factory(...)`; a top-level `factory:` key is not part
    // of the config schema, and Ponder ignores it silently, which turned the
    // wallet source into an address-less filter that matched any contract on
    // the chain emitting the same event signatures (found 2026-09-12).
    address: factory({
      address: deployment.walletFactory,
      event: getAbiItem({ abi: WalletFactoryAbi, name: "WalletCreated" }),
      parameter: "wallet",
    }),
    startBlock: deployment.startBlock,
  },
} as const;

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

// Which endpoint the backfill runs against decides whether it finishes at
// all, so the constraints measured on 2026-09-12 are written down here:
//
// - rpc.testnet.arc.network (the official public endpoint) answers a 10,000
//   block eth_getLogs in ~100ms but returns 429 above roughly two requests per
//   second, and rejects any query whose topic0 list is longer than about eight
//   entries with "requested range too large" (code -32012), whatever the block
//   range. Ponder >= 0.17 merges every event of a contract into one such query,
//   so the wallet source (12 events) can never be fetched from it.
// - arc-testnet.drpc.org (free plan) rejects eth_getLogs above 100 blocks.
// - arc-testnet.gateway.tenderly.co accepts 100,000 block ranges and long
//   topic lists, and allows roughly 80 requests per minute before answering
//   "rate limit exceeded" for the rest of the minute.
//
// Ponder's own adaptive limiter never goes below 3 requests per second and
// gives up after ten consecutive failures, so the endpoint is wrapped in a
// fixed-rate queue instead of being trusted to back off. A single endpoint is
// used on purpose: the round-robin load balancer would bound throughput by the
// slowest queue, and a fallback to the official endpoint would fail the same
// merged queries again.
const DEFAULT_ARC_TESTNET_INDEXER_RPC_URL = "https://arc-testnet.gateway.tenderly.co";
const DEFAULT_RPC_REQUESTS_PER_SECOND = 1;

// A blank variable is "unset": `.env.example` ships these keys empty, and an
// empty `INDEXER_RPC_URL=` in a copied `.env.local` must fall through to the
// default rather than disable the indexer.
const envValue = (name: string) => {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
};

// INDEXER_RPC_URL is the indexer-only override (a keyed provider goes here),
// ARC_RPC_URL the override shared with the API and web proxy. ARC_TESTNET_RPC
// is deliberately not consulted: it names the official endpoint for the app's
// low-volume reads, which the backfill cannot use.
const rpcUrl =
  envValue("INDEXER_RPC_URL") ??
  envValue("ARC_RPC_URL") ??
  (IS_ARC_MAINNET ? ARC_RPC_URL : DEFAULT_ARC_TESTNET_INDEXER_RPC_URL);
if (!rpcUrl) {
  throw new Error("No Arc RPC URL is configured for the indexer (set INDEXER_RPC_URL)");
}

const rpcRequestsPerSecond = Number(
  envValue("INDEXER_RPC_REQUESTS_PER_SECOND") ?? String(DEFAULT_RPC_REQUESTS_PER_SECOND),
);
if (!Number.isInteger(rpcRequestsPerSecond) || rpcRequestsPerSecond < 1) {
  throw new Error(
    `INDEXER_RPC_REQUESTS_PER_SECOND must be a positive integer, got ${JSON.stringify(process.env.INDEXER_RPC_REQUESTS_PER_SECOND)}`,
  );
}

const rpcTransport = rateLimit(http(rpcUrl), { requestsPerSecond: rpcRequestsPerSecond });

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
      // See `rpcTransport` above for why the endpoint is rate limited here
      // rather than left to Ponder's adaptive limiter.
      rpc: rpcTransport,
      pollingInterval: 4_000,
      ethGetLogsBlockRange: 10_000,
    },
  },
  contracts,
});
