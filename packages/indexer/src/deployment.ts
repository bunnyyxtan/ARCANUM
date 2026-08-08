import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ARC_NETWORK } from "@arcanum/shared";
import { z } from "zod";

const addressSchema = z.custom<`0x${string}`>(
  (value) => typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value),
);

const deploymentSchema = z.object({
  walletFactory: addressSchema.optional(),
  escalationManager: addressSchema.optional(),
  anomalyOracle: addressSchema.optional(),
  vendorRegistry: addressSchema.optional(),
  startBlock: z.number().optional(),
});

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

// One manifest per network: arc-testnet.json today, arc-mainnet.json once the
// mainnet contracts are deployed. The active network picks which one is read.
const DEPLOYMENT_RELATIVE_PATH = `packages/contracts/deployments/arc-${ARC_NETWORK}.json`;

/**
 * Walks up from the working directory (and from this file, for the case where
 * the indexer is started outside the repo) until the monorepo root that holds
 * the deployment manifest is found.
 *
 * Resolving against `process.cwd()` alone silently returns zero addresses and
 * `startBlock: 0` whenever the indexer is started from its own package
 * directory, which makes Ponder scan the chain from genesis for contracts that
 * do not exist — the read model then never receives a single event.
 */
function findDeploymentFile() {
  const startDirs = [process.cwd(), dirname(fileURLToPath(import.meta.url))];

  for (const startDir of startDirs) {
    let dir = startDir;

    while (true) {
      const candidate = resolve(dir, DEPLOYMENT_RELATIVE_PATH);
      if (existsSync(candidate)) {
        return candidate;
      }

      const parent = dirname(dir);
      if (parent === dir) {
        break;
      }
      dir = parent;
    }
  }

  return undefined;
}

export function loadDeployment() {
  const path = findDeploymentFile();
  const parsed = path ? deploymentSchema.parse(JSON.parse(readFileSync(path, "utf8"))) : {};

  if (!path) {
    console.error(
      `[indexer] ${DEPLOYMENT_RELATIVE_PATH} not found from ${process.cwd()} — refusing to index zero addresses from genesis.`,
    );
  }

  return {
    walletFactory: parsed.walletFactory ?? ZERO_ADDRESS,
    escalationManager: parsed.escalationManager ?? ZERO_ADDRESS,
    anomalyOracle: parsed.anomalyOracle ?? ZERO_ADDRESS,
    vendorRegistry: parsed.vendorRegistry ?? ZERO_ADDRESS,
    startBlock: parsed.startBlock ?? 0,
  };
}
