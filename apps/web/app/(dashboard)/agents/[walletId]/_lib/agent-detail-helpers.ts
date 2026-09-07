import type { Address } from "viem";

import { isEvmAddress } from "@/lib/format/address";
import type { LedgerEntry, LedgerStatus } from "@/lib/types";

export function resolveGovernedWalletAddress(value: string | string[] | undefined): Address | null {
  const raw = Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
  if (!raw) {
    return null;
  }
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  return isEvmAddress(decoded) ? (decoded as Address) : null;
}

export function ledgerStatusLabel(
  status: LedgerStatus,
): "APPROVED" | "REJECTED" | "ESCALATED" | "FROZEN" {
  if (status === "rejected") return "REJECTED";
  if (status === "escalated") return "ESCALATED";
  if (status === "frozen") return "FROZEN";
  return "APPROVED";
}

export function getBehaviorMetrics(decisions: LedgerEntry[]) {
  const total = decisions.reduce((sum, decision) => sum + decision.amount, 0);
  const peak = decisions.reduce((max, decision) => Math.max(max, decision.amount), 0);
  return {
    total,
    average: decisions.length > 0 ? total / decisions.length : 0,
    peak,
    restraints: decisions.filter(
      (decision) =>
        decision.status === "rejected" ||
        decision.status === "escalated" ||
        decision.status === "frozen",
    ).length,
    bars: decisions.slice(0, 20).reverse(),
    authorizedVendors: Array.from(
      new Set(
        decisions
          .filter((decision) => decision.status === "approved")
          .map((decision) => decision.counterparty)
          .filter(Boolean),
      ),
    ).slice(0, 6),
  };
}
