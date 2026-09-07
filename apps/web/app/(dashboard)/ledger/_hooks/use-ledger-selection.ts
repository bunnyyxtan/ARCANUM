import { useEffect, useMemo, useState } from "react";

import type { LedgerEntry } from "@/lib/types";

export type LedgerSelection = {
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  selected: LedgerEntry | null;
};

export function useLedgerSelection(rows: LedgerEntry[]): LedgerSelection {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusHandled, setFocusHandled] = useState(false);
  const selected = useMemo(
    () => rows.find((row) => row.id === selectedId) ?? null,
    [rows, selectedId],
  );

  // Deep links from the dashboard event stream arrive with the movement selected.
  useEffect(() => {
    if (focusHandled || rows.length === 0) return;
    const focus = new URLSearchParams(window.location.search).get("focus");
    const match = focus ? rows.find((row) => row.hash === focus || row.id === focus) : undefined;
    if (match) setSelectedId(match.id);
    setFocusHandled(true);
  }, [focusHandled, rows]);

  useEffect(() => {
    if (!selected) return undefined;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [selected]);

  return { selectedId, setSelectedId, selected };
}
