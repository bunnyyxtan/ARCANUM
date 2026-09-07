import { categoryLabel, formatUsdCompact } from "@/lib/format";
import { matchesSearch, normalizeSearch } from "@/lib/table-state";
import type { LedgerEntry, LedgerStatus } from "@/lib/types";

export type StatusFilter = "ALL" | LedgerStatus;
export const statusFilters: readonly StatusFilter[] = [
  "ALL",
  "approved",
  "rejected",
  "escalated",
  "frozen",
];
export function timePart(value: string): string {
  return value.length >= 19 ? value.slice(11, 19) : value;
}
export function datePart(value: string): string {
  return value.length >= 10 ? value.slice(0, 10) : "-";
}
export function filterLedgerRows(
  rows: LedgerEntry[],
  search: string,
  status: StatusFilter,
  flaggedOnly: boolean,
  flags: Set<string>,
): LedgerEntry[] {
  const query = normalizeSearch(search);
  return rows.filter(
    (row) =>
      (status === "ALL" || row.status === status) &&
      (!flaggedOnly || flags.has(row.counterpartyAddress.toLowerCase())) &&
      matchesSearch(query, [
        row.agentName,
        row.counterparty,
        categoryLabel(row.category),
        formatUsdCompact(row.amount),
        row.status,
        row.hash,
      ]),
  );
}
export function ledgerTotals(rows: LedgerEntry[]): {
  value: number;
  approved: number;
  rejected: number;
  escalated: number;
} {
  return {
    value: rows.reduce((sum, row) => sum + row.amount, 0),
    approved: rows.filter((row) => row.status === "approved").length,
    rejected: rows.filter((row) => row.status === "rejected").length,
    escalated: rows.filter((row) => row.status === "escalated").length,
  };
}
