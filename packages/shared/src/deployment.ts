import { z } from "zod";
import arcTestnetManifest from "../../contracts/deployments/arc-testnet.json";

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

export function deploymentManifestFor(network: "testnet" | "mainnet"): DeploymentManifest {
  if (network === "mainnet") {
    throw new Error(
      "Arc mainnet is configured, but packages/contracts/deployments/arc-mainnet.json is not published.",
    );
  }
  return parseDeploymentManifest(arcTestnetManifest);
}
