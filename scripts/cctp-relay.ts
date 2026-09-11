/**
 * Operator-only recovery for the one approved Sepolia -> Arc CCTP burn.
 *
 * This command never invokes source approval or burn code. It only submits the
 * already-attested Arc MessageTransmitter receiveMessage call after all
 * durable identity and fee/nonce guards pass.
 */

import { parseHash, safeError } from "./lib/cctp-fund-io";
import { approvedRelayUsage, runManualRelay } from "./lib/cctp-relay";

export function usage(): string {
  return approvedRelayUsage();
}

export async function run(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const [hash, confirm, ...rest] = argv;
  if (!hash || confirm !== "--confirm" || rest.length !== 0) {
    throw new Error(usage());
  }
  const status = await runManualRelay(parseHash(hash), true);
  console.log(JSON.stringify(status, null, 2));
}

run().catch((error: unknown) => {
  console.error(`\ncctp-relay failed: ${safeError(error)}`);
  process.exitCode = 1;
});
