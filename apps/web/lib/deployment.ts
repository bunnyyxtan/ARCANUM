import { ARC_NETWORK, type DeploymentManifest, parseDeploymentManifest } from "@arcanum/shared";
import arcTestnetManifest from "../../../packages/contracts/deployments/arc-testnet.json";

function activeDeploymentManifest(): DeploymentManifest {
  if (ARC_NETWORK === "mainnet") {
    throw new Error("The Arc mainnet contracts deployment manifest is not published.");
  }
  return parseDeploymentManifest(arcTestnetManifest);
}

export const deployment = activeDeploymentManifest();
export const contractAddresses = {
  anomalyOracle: deployment.anomalyOracle,
  escalationManager: deployment.escalationManager,
  policyEngine: deployment.policyEngine,
  usdc: deployment.usdc,
  vendorRegistry: deployment.vendorRegistry,
  walletFactory: deployment.walletFactory,
} as const;
