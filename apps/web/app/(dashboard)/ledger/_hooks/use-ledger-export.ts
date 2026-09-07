import { useEffect, useMemo, useRef, useState } from "react";

import {
  type LedgerReportContext,
  downloadLedgerCsv,
  openLedgerReport,
} from "@/lib/export/ledger-report";
import { categoryLabel, formatUsd } from "@/lib/format";
import { normalizeSearch } from "@/lib/table-state";
import type { LedgerEntry } from "@/lib/types";

import type { StatusFilter } from "../_lib/helpers";

export type LedgerExport = {
  notice: string;
  exportOpen: boolean;
  setExportOpen: React.Dispatch<React.SetStateAction<boolean>>;
  exportTriggerRef: React.RefObject<HTMLButtonElement | null>;
  exportCsv: () => void;
  exportPrintable: () => void;
  showNotice: (message: string) => void;
};

export function useLedgerExport(
  rows: LedgerEntry[],
  status: StatusFilter,
  flaggedOnly: boolean,
  search: string,
): LedgerExport {
  const [notice, setNotice] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const noticeTimer = useRef<number | null>(null);
  const exportTriggerRef = useRef<HTMLButtonElement | null>(null);
  const showNotice = (message: string) => {
    setNotice(message);
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2600);
  };

  useEffect(
    () => () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    },
    [],
  );
  useEffect(() => {
    if (!exportOpen) return undefined;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExportOpen(false);
        exportTriggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [exportOpen]);

  const report = useMemo<LedgerReportContext>(() => {
    const filterParts = [status === "ALL" ? "All statuses" : `Status ${status.toUpperCase()}`];
    if (flaggedOnly) filterParts.push("Flagged only");
    const query = normalizeSearch(search);
    if (query) filterParts.push(`Search "${query}"`);
    return {
      rows,
      filtersLabel: filterParts.join(" · "),
      totals: {
        valueLabel: formatUsd(rows.reduce((sum, row) => sum + row.amount, 0)),
        approved: rows.filter((row) => row.status === "approved").length,
        rejected: rows.filter((row) => row.status === "rejected").length,
        escalated: rows.filter((row) => row.status === "escalated").length,
      },
      formatAmount: formatUsd,
      formatCategory: categoryLabel,
    };
  }, [rows, status, flaggedOnly, search]);

  const exportCsv = () => {
    setExportOpen(false);
    if (report.rows.length === 0) {
      showNotice("Nothing to export for the current filters.");
      return;
    }
    downloadLedgerCsv(report);
    showNotice(`CSV exported: ${report.rows.length} movements.`);
  };
  const exportPrintable = () => {
    setExportOpen(false);
    if (report.rows.length === 0) {
      showNotice("Nothing to export for the current filters.");
      return;
    }
    if (!openLedgerReport(report)) {
      showNotice("The report window was blocked. Allow pop-ups and retry.");
    }
  };

  return {
    notice,
    exportOpen,
    setExportOpen,
    exportTriggerRef,
    exportCsv,
    exportPrintable,
    showNotice,
  };
}
