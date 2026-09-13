import { parseUnits } from "viem";

import type { CctpQuote } from "../../packages/sdk/src/cctp";

export interface CctpSafetyCaps {
  /** Absolute maximum CCTP fee in USDC base units. */
  maxFeeBaseUnits?: string;
  /** Absolute combined approval+burn source gas budget in wei. */
  maxSourceGasWei?: string;
}

export interface CctpGasEstimate {
  gasLimit: bigint;
  maxFeePerGasWei: bigint;
  maxCostWei: bigint;
}

export interface CctpStartFlags {
  confirm: boolean;
  caps: CctpSafetyCaps;
}

function parseCap(value: string, decimals: number, label: string): string {
  if (!value || value.startsWith("-") || value.startsWith("+") || value.trim() !== value) {
    throw new Error(`${label} must be a non-negative decimal amount.`);
  }
  let units: bigint;
  try {
    units = parseUnits(value, decimals);
  } catch {
    throw new Error(`${label} must be an exact decimal amount with at most ${decimals} decimals.`);
  }
  if (units < 0n) throw new Error(`${label} must be non-negative.`);
  return units.toString();
}

export function parseMaxFeeCap(value: string): string {
  return parseCap(value, 6, "Maximum CCTP fee");
}

export function parseMaxSourceGasCap(value: string): string {
  return parseCap(value, 18, "Maximum source gas");
}

/**
 * Parses only opt-in start flags. Existing `start <amount> --confirm` remains
 * valid and returns an empty cap set.
 */
export function parseCctpStartFlags(args: readonly string[]): CctpStartFlags {
  let confirm = false;
  let maxFeeBaseUnits: string | undefined;
  let maxSourceGasWei: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index];
    if (flag === "--confirm") {
      if (confirm) throw new Error("The --confirm flag may only be provided once.");
      confirm = true;
      continue;
    }
    if (flag === "--max-fee" || flag === "--max-source-gas") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`${flag} requires a decimal value.`);
      }
      index += 1;
      if (flag === "--max-fee") {
        if (maxFeeBaseUnits !== undefined) {
          throw new Error("The --max-fee cap may only be provided once.");
        }
        maxFeeBaseUnits = parseMaxFeeCap(value);
      } else {
        if (maxSourceGasWei !== undefined) {
          throw new Error("The --max-source-gas cap may only be provided once.");
        }
        maxSourceGasWei = parseMaxSourceGasCap(value);
      }
      continue;
    }
    throw new Error(`Unsupported CCTP start flag: ${flag}`);
  }

  return {
    confirm,
    caps: {
      ...(maxFeeBaseUnits === undefined ? {} : { maxFeeBaseUnits }),
      ...(maxSourceGasWei === undefined ? {} : { maxSourceGasWei }),
    },
  };
}

export function hasCctpSafetyCaps(caps: CctpSafetyCaps | undefined): boolean {
  return Boolean(caps?.maxFeeBaseUnits !== undefined || caps?.maxSourceGasWei !== undefined);
}

export function assertFeeWithinCctpCap(
  maxFeeBaseUnits: string,
  capBaseUnits: string | undefined,
): void {
  if (capBaseUnits === undefined) return;
  if (BigInt(maxFeeBaseUnits) > BigInt(capBaseUnits)) {
    throw new Error(
      `CCTP quote max fee ${maxFeeBaseUnits} base units exceeds the approved cap of ${capBaseUnits} base units.`,
    );
  }
}

export function assertRefreshedCctpQuote(
  initial: CctpQuote,
  refreshed: CctpQuote,
  capBaseUnits: string | undefined,
  now = Date.now(),
): void {
  if (refreshed.amountBaseUnits !== initial.amountBaseUnits) {
    throw new Error("Refreshed CCTP quote changed the approved burn amount; refusing to burn.");
  }
  if (!Number.isSafeInteger(refreshed.expiresAt) || refreshed.expiresAt <= now) {
    throw new Error("Refreshed CCTP quote is already expired; refusing to burn.");
  }
  assertFeeWithinCctpCap(refreshed.maxFeeBaseUnits, capBaseUnits);
}

export function assertCombinedSourceGasWithinCap(
  approval: CctpGasEstimate,
  burn: CctpGasEstimate,
  capWei: string | undefined,
): string {
  const combined = approval.maxCostWei + burn.maxCostWei;
  if (capWei !== undefined && combined > BigInt(capWei)) {
    throw new Error(
      `Combined approval and burn source gas exposure ${combined} wei exceeds the approved cap of ${capWei} wei.`,
    );
  }
  return combined.toString();
}

/**
 * When the token allowance is zero, a pre-approval burn estimate is expected
 * to revert. Reserve an affordable burn gas ceiling from the remaining cap
 * using the already prepared approval's fee bound; the actual burn estimate
 * must be obtained after approval confirms.
 */
export function deriveBurnGasCeiling(
  approval: CctpGasEstimate,
  capWei: string | undefined,
): string {
  if (capWei === undefined) {
    throw new Error("A source-gas cap is required to reserve a burn gas ceiling.");
  }
  const cap = BigInt(capWei);
  if (approval.maxCostWei > cap) {
    throw new Error(
      `Approval source gas exposure ${approval.maxCostWei} wei already exceeds the approved cap of ${capWei} wei.`,
    );
  }
  if (approval.maxFeePerGasWei <= 0n) {
    throw new Error("Approval gas fee bound is zero; refusing to derive a burn gas ceiling.");
  }
  const ceiling = (cap - approval.maxCostWei) / approval.maxFeePerGasWei;
  if (ceiling <= 0n) {
    throw new Error("Approved source-gas cap leaves no affordable burn gas ceiling.");
  }
  return ceiling.toString();
}

/**
 * A capped run reserves the next nonce for the burn while approval is pending.
 * Any changed pending nonce is an external/retry condition, never an automatic
 * opportunity to choose another nonce.
 */
export function assertSequentialSourceNonces(approvalNonce: number, burnNonce: number): void {
  if (
    !Number.isSafeInteger(approvalNonce) ||
    approvalNonce < 0 ||
    !Number.isSafeInteger(burnNonce) ||
    burnNonce < 0 ||
    burnNonce !== approvalNonce + 1
  ) {
    throw new Error(
      `Capped CCTP run requires consecutive approval/burn nonces; got ${approvalNonce} and ${burnNonce}.`,
    );
  }
}
