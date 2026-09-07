import { createHash } from "node:crypto";
import type { Agent } from "@arcanum/db/schema";
import { decimalUsdcToBaseUnits } from "@arcanum/shared";
import type { SupabaseRow } from "./client";

export function stableUuid(seed: string) {
  const hex = createHash("sha256").update(seed).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(
    13,
    16,
  )}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function stableHash(seed: string) {
  return `0x${createHash("sha256").update(seed).digest("hex")}`;
}

export function stringField(
  row: SupabaseRow | undefined,
  keys: string[],
  fallback?: string,
): string;
export function stringField(
  row: SupabaseRow | undefined,
  keys: string[],
  fallback: null,
): string | null;
export function stringField(
  row: SupabaseRow | undefined,
  keys: string[],
  fallback: string | null = "",
) {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
    if (typeof value === "number" || typeof value === "bigint") {
      return String(value);
    }
  }

  return fallback;
}

export function numberField(row: SupabaseRow | undefined, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return fallback;
}

export function numberOrNull(row: SupabaseRow | undefined, keys: string[]) {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

export function booleanField(row: SupabaseRow | undefined, keys: string[], fallback: boolean) {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string") {
      return value === "true";
    }
  }

  return fallback;
}

export function arrayField(row: SupabaseRow | undefined, keys: string[]) {
  for (const key of keys) {
    const value = row?.[key];
    if (Array.isArray(value)) {
      return value.map((item) => String(item));
    }
  }

  return [];
}

export function dateField(row: SupabaseRow | undefined, keys: string[], fallback = new Date()) {
  for (const key of keys) {
    const value = row?.[key];
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === "string" || typeof value === "number") {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }
  }

  return fallback;
}

export function moneyBaseUnits(
  row: SupabaseRow | undefined,
  keys: string[],
  fallback: string | number = "0",
) {
  for (const key of keys) {
    const value = row?.[key];
    if (typeof value === "number") {
      if (!Number.isSafeInteger(value * 1_000_000)) {
        throw new Error(`USDC amount ${String(value)} cannot be represented exactly.`);
      }
      return BigInt(Math.round(value * 1_000_000)).toString();
    }
    if (typeof value === "string" && value.trim()) {
      if (/^\d+$/.test(value) && value.length > 6) {
        return value;
      }
      if (/^(0|[1-9]\d*)(\.\d{1,6})?$/.test(value)) {
        return decimalUsdcToBaseUnits(value).toString();
      }
    }
  }

  if (typeof fallback !== "number") {
    return fallback;
  }
  if (!Number.isSafeInteger(fallback * 1_000_000)) {
    throw new Error(`USDC fallback ${String(fallback)} cannot be represented exactly.`);
  }
  return BigInt(Math.round(fallback * 1_000_000)).toString();
}
