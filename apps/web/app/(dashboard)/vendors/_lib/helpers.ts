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

export function allowTrustedMutation(action: string, event: ReactMouseEvent<HTMLElement>): boolean {
  if (event.nativeEvent.isTrusted) {
    return true;
  }
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[Arcanum] Blocked ${action}: mutations require an explicit trusted click.`);
  }
  return false;
}
