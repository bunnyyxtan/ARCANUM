import { z } from "zod";
import arcMainnetManifest from "../../contracts/deployments/arc-mainnet.json";
import arcTestnetManifest from "../../contracts/deployments/arc-testnet.json";
import { ARC_MAINNET_CHAIN_ID, ARC_MAINNET_USDC_ADDRESS } from "./chains/arc-mainnet";
import { ARC_TESTNET_CHAIN_ID, ARC_TESTNET_USDC_ADDRESS } from "./chains/arc-testnet";

const addressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/)
  .transform((value) => value as `0x${string}`);
const hashSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/)
  .transform((value) => value as `0x${string}`);

const deploymentManifestSchema = z.object({
  chainId: z.number().int().positive(),
  network: z.string().min(1),
  startBlock: z.number().int().nonnegative(),
  deployer: addressSchema,
  protocolAdmin: addressSchema,
  oracleSigner: addressSchema,
  create2Salt: hashSchema,
  usdc: addressSchema,
  policyEngine: addressSchema,
  escalationManager: addressSchema,
  anomalyOracle: addressSchema,
  vendorRegistry: addressSchema,
  walletFactory: addressSchema,
  codeHashes: z.object({
    policyEngine: hashSchema,
    escalationManager: hashSchema,
    anomalyOracle: hashSchema,
    vendorRegistry: hashSchema,
    walletFactory: hashSchema,
  }),
  txHashes: z.record(hashSchema).optional(),
  deployedAt: z.string().datetime().optional(),
  compiler: z.string().min(1).optional(),
  evmVersion: z.string().min(1).optional(),
});

export type DeploymentManifest = z.infer<typeof deploymentManifestSchema>;

type DeploymentIdentityInput = Pick<
  DeploymentManifest,
  | "chainId"
  | "network"
  | "startBlock"
  | "usdc"
  | "policyEngine"
  | "escalationManager"
  | "anomalyOracle"
  | "vendorRegistry"
  | "walletFactory"
>;

/**
 * Stable identity for the exact contract deployment an indexer is allowed to
 * read or write. The start block is part of the identity: a replacement
 * deployment can legitimately reuse an address while beginning at a later
 * block, and an old cursor must never be allowed to skip its early events.
 */
export function deploymentIdentity(manifest: DeploymentIdentityInput) {
  return [
    "v1",
    manifest.chainId,
    manifest.network.toLowerCase(),
    manifest.startBlock,
    manifest.usdc,
    manifest.policyEngine,
    manifest.escalationManager,
    manifest.anomalyOracle,
    manifest.vendorRegistry,
    manifest.walletFactory,
  ]
    .map((value) => String(value).toLowerCase())
    .join(":");
}

export function parseDeploymentManifest(json: unknown): DeploymentManifest {
  const result = deploymentManifestSchema.safeParse(json);
  if (!result.success) {
    throw new Error(`Invalid contracts deployment manifest: ${result.error.message}`);
  }
  return result.data;
}

export type ArcNetwork = "testnet" | "mainnet";

const MODULE_KEYS = [
  "policyEngine",
  "escalationManager",
  "anomalyOracle",
  "vendorRegistry",
  "walletFactory",
] as const;

const EXPECTED_DEPLOYMENT = {
  testnet: {
    network: "arc-testnet",
    chainId: ARC_TESTNET_CHAIN_ID,
    usdc: ARC_TESTNET_USDC_ADDRESS,
  },
  mainnet: {
    network: "arc-mainnet",
    chainId: ARC_MAINNET_CHAIN_ID,
    usdc: ARC_MAINNET_USDC_ADDRESS,
  },
} as const;

/**
 * Parses a manifest and checks that it really is the deployment for `network`:
 * the network name, chain id and USDC address must all agree with the chain
 * the app is configured for, so a mislabelled or copied file can never bind a
 * build to another chain's contracts.
 *
 * A mainnet manifest must additionally be finalized. The deploy script's dry
 * run writes a provisional manifest with predicted addresses and no broadcast
 * record; requiring the broadcast metadata means a mainnet build cannot ship
 * against contracts that were never deployed.
 */
export function validateDeploymentManifest(json: unknown, network: ArcNetwork): DeploymentManifest {
  const manifest = parseDeploymentManifest(json);
  const expected = EXPECTED_DEPLOYMENT[network];
  const label = `${expected.network} deployment manifest`;
  if (manifest.network !== expected.network) {
    throw new Error(`${label} names network "${manifest.network}".`);
  }
  if (manifest.chainId !== expected.chainId) {
    throw new Error(`${label} is for chain ${manifest.chainId}, expected ${expected.chainId}.`);
  }
  if (manifest.usdc.toLowerCase() !== expected.usdc.toLowerCase()) {
    throw new Error(`${label} uses USDC ${manifest.usdc}, expected ${expected.usdc}.`);
  }
  if (network === "mainnet") {
    const missingTxHashes = MODULE_KEYS.filter((key) => !manifest.txHashes?.[key]);
    if (!manifest.deployedAt || missingTxHashes.length > 0) {
      throw new Error(
        `${label} is not finalized (run packages/contracts/scripts/finalize-manifest.mjs after the broadcast); missing deployedAt or txHashes for ${missingTxHashes.join(", ") || "none"}.`,
      );
    }
  }
  return manifest;
}

/**
 * The published manifest for a network. Both manifests are bundled so the
 * choice is made by the network switch alone.
 */
export function deploymentManifestFor(network: ArcNetwork): DeploymentManifest {
  return validateDeploymentManifest(
    network === "mainnet" ? arcMainnetManifest : arcTestnetManifest,
    network,
  );
}
