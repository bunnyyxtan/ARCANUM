import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

export function loadDeployment() {
  const path = resolve(process.cwd(), "packages/contracts/deployments/arc-testnet.json");
  const parsed = existsSync(path)
    ? deploymentSchema.parse(JSON.parse(readFileSync(path, "utf8")))
    : {};

  return {
    walletFactory: parsed.walletFactory ?? ZERO_ADDRESS,
    escalationManager: parsed.escalationManager ?? ZERO_ADDRESS,
    anomalyOracle: parsed.anomalyOracle ?? ZERO_ADDRESS,
    vendorRegistry: parsed.vendorRegistry ?? ZERO_ADDRESS,
    startBlock: parsed.startBlock ?? 0,
  };
}
