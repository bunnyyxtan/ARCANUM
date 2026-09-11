/**
 * Narrow CCTP funding runner for the one approved Sepolia -> Arc route.
 *
 * This command intentionally does not ask for input. `start` is the only
 * write command and requires --confirm; status/watch are recovery commands
 * for a source burn hash and never sign or broadcast anything.
 */

import { quote, start, status, watch } from "./lib/cctp-fund-commands";
import { parseHash, safeError } from "./lib/cctp-fund-io";

export function usage(): string {
  return "Usage: cctp-fund.ts quote <USDC total> | start <USDC total> --confirm | status <burnTxHash> | watch <burnTxHash>";
}

export async function run(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const [command, first, ...rest] = argv;
  if (command === "quote" && first && rest.length === 0) {
    await quote(first);
    return;
  }
  if (command === "start" && first && rest.length === 1 && rest[0] === "--confirm") {
    await start(first, true);
    return;
  }
  if (command === "status" && first && rest.length === 0) {
    await status(parseHash(first));
    return;
  }
  if (command === "watch" && first && rest.length === 0) {
    await watch(parseHash(first));
    return;
  }
  throw new Error(usage());
}

async function main(): Promise<void> {
  await run();
}

main().catch((error: unknown) => {
  console.error(`\ncctp-fund failed: ${safeError(error)}`);
  process.exitCode = 1;
});
