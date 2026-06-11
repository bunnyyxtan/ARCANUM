import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { z } from "zod";

const addressSchema = z.custom<`0x${string}`>(
  (value) => typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value),
);

const deploymentSchema = z.object({
  chainId: z.number().optional(),
  policyEngine: addressSchema.optional(),
  escalationManager: addressSchema.optional(),
  anomalyOracle: addressSchema.optional(),
  vendorRegistry: addressSchema.optional(),
  walletFactory: addressSchema.optional(),
  startBlock: z.number().optional(),
});

export type ArcDeployment = z.infer<typeof deploymentSchema>;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export function loadArcDeployment(): Required<ArcDeployment> {
  const deploymentPath = resolve(process.cwd(), "packages/contracts/deployments/arc-testnet.json");
  const parsed = existsSync(deploymentPath)
    ? deploymentSchema.parse(JSON.parse(readFileSync(deploymentPath, "utf8")))
    : {};

  return {
    chainId: parsed.chainId ?? 5_042_002,
    policyEngine: parsed.policyEngine ?? ZERO_ADDRESS,
    escalationManager: parsed.escalationManager ?? ZERO_ADDRESS,
    anomalyOracle: parsed.anomalyOracle ?? ZERO_ADDRESS,
    vendorRegistry: parsed.vendorRegistry ?? ZERO_ADDRESS,
    walletFactory: parsed.walletFactory ?? ZERO_ADDRESS,
    startBlock: parsed.startBlock ?? 0,
  };
}
