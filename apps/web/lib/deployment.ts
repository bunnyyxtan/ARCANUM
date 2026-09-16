import { ARC_NETWORK, type DeploymentManifest, validateDeploymentManifest } from "@arcanum/shared";
import arcMainnetManifest from "../../../packages/contracts/deployments/arc-mainnet.json";
import arcTestnetManifest from "../../../packages/contracts/deployments/arc-testnet.json";

/**
 * The manifests are imported statically so Next.js inlines the active one
 * into the client bundle; the network switch decides which, and the shared
 * validator cross-checks network name, chain id and USDC (and, on mainnet,
 * that the manifest is finalized) so a mislabelled manifest can never bind
 * the UI to the wrong chain's contracts.
 */
const deployment: DeploymentManifest = validateDeploymentManifest(
  ARC_NETWORK === "mainnet" ? arcMainnetManifest : arcTestnetManifest,
  ARC_NETWORK,
);

export { deployment };
export const contractAddresses = {
  anomalyOracle: deployment.anomalyOracle,
  escalationManager: deployment.escalationManager,
  policyEngine: deployment.policyEngine,
  usdc: deployment.usdc,
  vendorRegistry: deployment.vendorRegistry,
  walletFactory: deployment.walletFactory,
} as const;
