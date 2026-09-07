import { useMemo, useState } from "react";

import type { LedgerEntry } from "@/lib/types";

import { type StatusFilter, filterLedgerRows, ledgerTotals } from "../_lib/helpers";

export type LedgerFiltersState = {
  statusFilter: StatusFilter;
  setStatusFilter: (value: StatusFilter) => void;
  flaggedOnly: boolean;
  setFlaggedOnly: React.Dispatch<React.SetStateAction<boolean>>;
  search: string;
  setSearch: (value: string) => void;
  visibleRows: LedgerEntry[];
  totals: ReturnType<typeof ledgerTotals>;
};

export function useLedgerFilters(rows: LedgerEntry[], flags: Set<string>): LedgerFiltersState {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [search, setSearch] = useState("");
  const visibleRows = useMemo(
    () => filterLedgerRows(rows, search, statusFilter, flaggedOnly, flags),
    [rows, search, statusFilter, flaggedOnly, flags],
  );
  const totals = useMemo(() => ledgerTotals(rows), [rows]);
  return {
    statusFilter,
    setStatusFilter,
    flaggedOnly,
    setFlaggedOnly,
    search,
    setSearch,
    visibleRows,
    totals,
  };
}
