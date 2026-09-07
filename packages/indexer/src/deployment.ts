import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ARC_CHAIN_ID, ARC_NETWORK } from "@arcanum/shared";
import { z } from "zod";

const addressSchema = z.custom<`0x${string}`>(
  (value) =>
    typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value) && !/^0x0{40}$/i.test(value),
);

const deploymentSchema = z.object({
  chainId: z.number().int().positive(),
  network: z.string().min(1),
  usdc: addressSchema,
  walletFactory: addressSchema,
  policyEngine: addressSchema,
  escalationManager: addressSchema,
  anomalyOracle: addressSchema,
  vendorRegistry: addressSchema,
  startBlock: z.number().int().nonnegative(),
});

const DEPLOYMENT_RELATIVE_PATH = `packages/contracts/deployments/arc-${ARC_NETWORK}.json`;

/**
 * Walks up from the working directory (and from this file, for the case where
 * the indexer is started outside the repo) until the monorepo root that holds
 * the deployment manifest is found.
 *
 * Resolving against `process.cwd()` alone silently returns zero addresses and
 * `startBlock: 0` whenever the indexer is started from its own package
 * directory, which makes Ponder scan the chain from genesis for contracts that
 * do not exist - the read model then never receives a single event.
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

  throw new Error(
    `[indexer] deployment manifest ${DEPLOYMENT_RELATIVE_PATH} was not found from ${process.cwd()}`,
  );
}

export function loadDeployment() {
  const path = findDeploymentFile();
  let parsed: z.infer<typeof deploymentSchema>;
  try {
    parsed = deploymentSchema.parse(JSON.parse(readFileSync(path, "utf8")));
  } catch (error) {
    throw new Error(`[indexer] invalid deployment manifest ${path}: ${String(error)}`, {
      cause: error,
    });
  }

  if (parsed.chainId !== ARC_CHAIN_ID) {
    throw new Error(
      `[indexer] deployment manifest ${path} has chainId ${parsed.chainId}; configured ${ARC_NETWORK} network requires ${ARC_CHAIN_ID}`,
    );
  }
  if (parsed.network !== `arc-${ARC_NETWORK}`) {
    throw new Error(
      `[indexer] deployment manifest ${path} identifies network ${parsed.network}; configured network is arc-${ARC_NETWORK}`,
    );
  }

  return parsed;
}
