import type { MouseEvent as ReactMouseEvent } from "react";
import { parseUnits } from "viem";

import { type VendorCategoryValue, vendorCategoryOptions } from "@/lib/contracts";

export const vendorCategories = [
  "ALL",
  "API",
  "COMPUTE",
  "DATA",
  "SUBCONTRACTING",
  "OTHER",
] as const;

export function categoryLabel(value: VendorCategoryValue): string {
  return value === "subcontracting" ? "SUBCONTRACTING" : value.toUpperCase();
}

export function vendorCategoryIndex(value: VendorCategoryValue): number {
  return vendorCategoryOptions.findIndex((option) => option.value === value);
}

export function parseUsdcCapInput(value: string, label: string): bigint {
  const trimmed = value.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) {
    throw new Error(`${label} must be a non-negative USDC amount with up to 6 decimals.`);
  }
  return parseUnits(trimmed, 6);
}

export type VendorCapDraftKind = "add" | "edit";

export type VendorCapDraftState = {
  canSubmit: boolean;
  error: string | null;
};

/**
 * Derive the state shown by the cap controls from the same exact parser used
 * by the write paths. Add permits `0` as the intentional unlimited value;
 * editing an existing vendor requires a positive replacement cap.
 */
export function vendorCapDraftState(value: string, kind: VendorCapDraftKind): VendorCapDraftState {
  try {
    const baseUnits = parseUsdcCapInput(value, "Per-payment cap");
    if (kind === "edit" && baseUnits === 0n) {
      throw new Error("Per-payment cap must be greater than zero.");
    }
    return { canSubmit: true, error: null };
  } catch (caught) {
    return {
      canSubmit: false,
      error: caught instanceof Error ? caught.message : "Enter a valid per-payment cap.",
    };
  }
}

/**
 * Keep the controlled cap input faithful to what the user entered.
 *
 * Validation and base-unit conversion happen when the caller submits. Filtering
 * characters in onChange can turn an invalid intent such as "-1" or "1e2"
 * into a different, valid payment amount.
 */
export function preserveRawUsdcCapInput(value: string): string {
  return value;
}

export function vendorCapSyncNotice(
  name: string,
  amount: string,
  syncFailed: string | null,
): string {
  return syncFailed
    ? `${name.toUpperCase()} PER-PAYMENT CAP CONFIRMED · REGISTRY NOT SYNCED`
    : `${name.toUpperCase()} PER-PAYMENT CAP REVISED TO $${amount} · REGISTRY UPDATED`;
}

export function allowTrustedMutation(action: string, event: ReactMouseEvent<HTMLElement>): boolean {
  if (event.nativeEvent.isTrusted) {
    return true;
  }
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[Arcanum] Blocked ${action}: mutations require an explicit trusted click.`);
  }
  return false;
}
