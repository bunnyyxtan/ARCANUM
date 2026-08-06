"use client";

import { type CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";

import { ConnectCta } from "@/components/warm/ConnectCta";
import { getArcscanTxUrl } from "@/lib/arcscan";
import {
  type LedgerReportContext,
  downloadLedgerCsv,
  openLedgerReport,
} from "@/lib/export/ledger-report";
import { categoryLabel, formatUsd, formatUsdCompact } from "@/lib/format";
import {
  useLiveLedger,
  useVendorFlagHistory,
  useVendorFlags,
  vendorFlagEventLabel,
} from "@/lib/live-data";
import { matchesSearch, normalizeSearch } from "@/lib/table-state";
import { trpc } from "@/lib/trpc";
import type { LedgerEntry, LedgerStatus } from "@/lib/types";

type StatusFilter = "ALL" | LedgerStatus;

const statusFilters: readonly StatusFilter[] = [
  "ALL",
  "approved",
  "rejected",
  "escalated",
  "frozen",
];

const statusClasses: Record<LedgerStatus, string> = {
  approved: "bg-[var(--wl-green-tint)] text-[var(--wl-green)]",
  rejected: "bg-[var(--wl-signal)] text-[var(--wl-bg)]",
  escalated: "border border-[var(--wl-signal)] text-[var(--wl-signal)]",
  frozen: "bg-[var(--wl-ink)] text-[var(--wl-bg)]",
};

function StatusPill({ status }: { status: LedgerStatus }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.12em] ${statusClasses[status]}`}
    >
      {status}
    </span>
  );
}

function timePart(timestamp: string) {
  return timestamp.length >= 19 ? timestamp.slice(11, 19) : timestamp;
}

function datePart(timestamp: string) {
  return timestamp.length >= 10 ? timestamp.slice(0, 10) : "-";
}

export default function LedgerPage() {
  const liveLedger = useLiveLedger();
  const { isConnected, isConnecting, isReconnecting } = useAccount();
  const readOnly = !isConnected && !isConnecting && !isReconnecting;
  const vendorFlags = useVendorFlags();
  const utils = trpc.useUtils();
  const flagMutation = trpc.vendorFlags.flag.useMutation();
  const unflagMutation = trpc.vendorFlags.unflag.useMutation();
  const updateNoteMutation = trpc.vendorFlags.updateNote.useMutation();
  const flagPending =
    flagMutation.isPending || unflagMutation.isPending || updateNoteMutation.isPending;
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [flagNoteOpen, setFlagNoteOpen] = useState(false);
  const [flagNote, setFlagNote] = useState("");
  const [noteEditOpen, setNoteEditOpen] = useState(false);
  const [noteEditValue, setNoteEditValue] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const baseRows = liveLedger.data;
  const flaggedAddresses = vendorFlags.flaggedAddresses;

  const visibleRows = useMemo(() => {
    const query = normalizeSearch(search);
    return baseRows.filter((row) => {
      const statusMatches = statusFilter === "ALL" || row.status === statusFilter;
      const flaggedMatches =
        !flaggedOnly || flaggedAddresses.has(row.counterpartyAddress.toLowerCase());
      const queryMatches = matchesSearch(query, [
        row.agentName,
        row.counterparty,
        categoryLabel(row.category),
        formatUsdCompact(row.amount),
        row.status,
        row.hash,
      ]);
      return statusMatches && flaggedMatches && queryMatches;
    });
  }, [baseRows, search, statusFilter, flaggedOnly, flaggedAddresses]);

  const selected: LedgerEntry | null = useMemo(() => {
    if (!baseRows.length) return null;
    return baseRows.find((row) => row.id === selectedId) ?? null;
  }, [baseRows, selectedId]);

  // Deep link from the dashboard event stream: /ledger?focus=<tx hash or id>
  // arrives with that movement already selected, detail panel open.
  const [focusHandled, setFocusHandled] = useState(false);
  useEffect(() => {
    if (focusHandled || baseRows.length === 0) {
      return;
    }
    const focus = new URLSearchParams(window.location.search).get("focus");
    if (focus) {
      const match = baseRows.find((row) => row.hash === focus || row.id === focus);
      if (match) {
        setSelectedId(match.id);
      }
    }
    setFocusHandled(true);
  }, [focusHandled, baseRows]);

  const totals = useMemo(() => {
    return {
      value: baseRows.reduce((sum, row) => sum + row.amount, 0),
      approved: baseRows.filter((row) => row.status === "approved").length,
      rejected: baseRows.filter((row) => row.status === "rejected").length,
      escalated: baseRows.filter((row) => row.status === "escalated").length,
    };
  }, [baseRows]);

  useEffect(() => {
    if (!selected) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<number | null>(null);
  const showNotice = (message: string) => {
    setNotice(message);
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2600);
  };
  useEffect(() => {
    return () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    };
  }, []);

  const [exportOpen, setExportOpen] = useState(false);
  const exportTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!exportOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExportOpen(false);
        exportTriggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [exportOpen]);

  const reportContext = useMemo<LedgerReportContext>(() => {
    const filterParts = [
      statusFilter === "ALL" ? "All statuses" : `Status ${statusFilter.toUpperCase()}`,
    ];
    if (flaggedOnly) filterParts.push("Flagged only");
    const query = normalizeSearch(search);
    if (query) filterParts.push(`Search "${query}"`);
    return {
      rows: visibleRows,
      filtersLabel: filterParts.join(" · "),
      totals: {
        valueLabel: formatUsd(visibleRows.reduce((sum, row) => sum + row.amount, 0)),
        approved: visibleRows.filter((row) => row.status === "approved").length,
        rejected: visibleRows.filter((row) => row.status === "rejected").length,
        escalated: visibleRows.filter((row) => row.status === "escalated").length,
      },
      formatAmount: formatUsd,
      formatCategory: categoryLabel,
    };
  }, [visibleRows, statusFilter, flaggedOnly, search]);

  const exportCsv = () => {
    setExportOpen(false);
    if (reportContext.rows.length === 0) {
      showNotice("Nothing to export for the current filters.");
      return;
    }
    downloadLedgerCsv(reportContext);
    showNotice(`CSV exported: ${reportContext.rows.length} movements.`);
  };

  const exportPrintable = () => {
    setExportOpen(false);
    if (reportContext.rows.length === 0) {
      showNotice("Nothing to export for the current filters.");
      return;
    }
    if (!openLedgerReport(reportContext)) {
      showNotice("The report window was blocked. Allow pop-ups and retry.");
    }
  };

  const toggleVendorFlag = async (entry: LedgerEntry) => {
    if (!isConnected || flagPending) return;
    const vendorAddress = entry.counterpartyAddress.toLowerCase();
    const flagged = vendorFlags.flaggedAddresses.has(vendorAddress);
    if (!flagged && !flagNoteOpen) {
      setFlagNote("");
      setFlagNoteOpen(true);
      return;
    }
    try {
      if (flagged) {
        await unflagMutation.mutateAsync({ vendorAddress });
        showNotice(`${entry.counterparty} unflagged / review marker cleared`);
      } else {
        const note = flagNote.trim();
        await flagMutation.mutateAsync(note ? { vendorAddress, note } : { vendorAddress });
        setFlagNoteOpen(false);
        setFlagNote("");
        showNotice(`${entry.counterparty} flagged / review marker saved for all approvers`);
      }
      await Promise.all([
        utils.vendorFlags.list.invalidate(),
        utils.vendorFlags.history.invalidate({ vendorAddress }),
      ]);
    } catch (caught) {
      showNotice(caught instanceof Error ? caught.message : "Vendor flag update failed.");
    }
  };

  const saveNoteEdit = async (entry: LedgerEntry) => {
    if (!isConnected || flagPending) return;
    const vendorAddress = entry.counterpartyAddress.toLowerCase();
    const note = noteEditValue.trim();
    try {
      await updateNoteMutation.mutateAsync({ vendorAddress, note: note ? note : null });
      setNoteEditOpen(false);
      setNoteEditValue("");
      showNotice(
        note
          ? `${entry.counterparty} review note updated / flag preserved`
          : `${entry.counterparty} review note cleared / flag preserved`,
      );
      await Promise.all([
        utils.vendorFlags.list.invalidate(),
        utils.vendorFlags.history.invalidate({ vendorAddress }),
      ]);
    } catch (caught) {
      showNotice(caught instanceof Error ? caught.message : "Review note update failed.");
    }
  };

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset note editors whenever the selected row changes
  useEffect(() => {
    setFlagNoteOpen(false);
    setFlagNote("");
    setNoteEditOpen(false);
    setNoteEditValue("");
  }, [selectedId]);

  const selectedFlagged = selected
    ? vendorFlags.flaggedAddresses.has(selected.counterpartyAddress.toLowerCase())
    : false;
  const selectedFlagDetail = selected
    ? vendorFlags.flagDetails.get(selected.counterpartyAddress.toLowerCase())
    : undefined;
  const selectedUnflagDetail = selected
    ? vendorFlags.unflagDetails.get(selected.counterpartyAddress.toLowerCase())
    : undefined;
  const flagHistory = useVendorFlagHistory(selected?.counterpartyAddress ?? null);

  const openArcscan = (hash: string) => {
    const url = getArcscanTxUrl(hash);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      showNotice("Transaction hash is not yet available on Arcscan.");
    }
  };

  return (
    <div className="arc-ledger">
      <style>{`
        .arc-pill{position:relative;isolation:isolate;overflow:hidden;transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 320ms cubic-bezier(.16,1,.3,1),color 220ms ease,border-color 220ms ease}
        .arc-pill:before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:var(--wl-signal-deep);transform:translateY(102%);transition:transform 320ms cubic-bezier(.16,1,.3,1)}
        .arc-pill:hover{transform:translateY(-2px);box-shadow:0 10px 28px -8px rgba(var(--wl-signal-rgb),.42),0 2px 6px rgba(var(--wl-ink-rgb),.08)}.arc-pill:hover:before{transform:translateY(0)}
        .arc-ghost:before{background:var(--wl-ink)}.arc-ghost:hover{color:var(--wl-bg);border-color:var(--wl-ink);box-shadow:0 10px 28px -10px rgba(var(--wl-ink-rgb),.35)}
        .arc-row{animation:arcRowIn 420ms cubic-bezier(.16,1,.3,1) calc(var(--row-i) * 55ms) both;transition:transform 220ms cubic-bezier(.16,1,.3,1),background-color 220ms ease,box-shadow 220ms ease}
        .arc-row:hover{transform:translate3d(3px,-1px,0);background:var(--wl-bg-raised);box-shadow:inset 2px 0 0 var(--wl-signal)}.arc-row-selected{background:var(--wl-bg-soft);box-shadow:inset 2px 0 0 var(--wl-signal)}
        @keyframes arcRowIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .arc-drawer{animation:drawerIn 420ms cubic-bezier(.16,1,.3,1) both}@keyframes drawerIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        .arc-filter{position:relative;isolation:isolate;overflow:hidden;-webkit-tap-highlight-color:transparent;transition:transform 200ms cubic-bezier(.16,1,.3,1),color 200ms ease,border-color 200ms ease,box-shadow 240ms ease}
        .arc-filter:before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:var(--wl-bg-soft);opacity:0;transform:scale(.55);transition:transform 240ms cubic-bezier(.16,1,.3,1),opacity 180ms ease}
        .arc-filter:hover{transform:translateY(-1px)}.arc-filter:hover:before{opacity:1;transform:scale(1)}
        .arc-filter:active{transform:translateY(0) scale(.94);transition-duration:90ms}
        .arc-filter:focus-visible{outline:1px solid var(--wl-signal);outline-offset:2px}
        .arc-filter-on{animation:filterPop 300ms cubic-bezier(.34,1.56,.64,1)}.arc-filter-on:before{display:none}
        .arc-filter-on:hover{box-shadow:0 8px 20px -8px rgba(var(--wl-ink-rgb),.4)}
        .arc-filter-flag.arc-filter-on:hover{box-shadow:0 8px 20px -8px rgba(var(--wl-signal-rgb),.5)}
        @keyframes filterPop{0%{transform:scale(.9)}55%{transform:scale(1.05)}100%{transform:scale(1)}}
        @media (prefers-reduced-motion:reduce){.arc-pill,.arc-row,.arc-drawer,.arc-filter,.arc-filter-on{animation:none!important;transition:none!important}.arc-row:hover,.arc-pill:hover,.arc-filter:hover,.arc-filter:active{transform:none}}
      `}</style>

      <main className="mx-auto max-w-[1400px] px-5 py-8 md:px-8 md:py-10">
        <div className="flex flex-col justify-between gap-7 border-b border-[var(--wl-line)] pb-9 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
              RECORD / LAST 24H
            </p>
            <h1 className="font-display mt-4 text-[clamp(2.7rem,5vw,4.8rem)] font-semibold leading-[.9] tracking-[-.015em]">
              Governed ledger
            </h1>
            <p className="mt-4 max-w-[550px] text-[14px] leading-[1.45] text-[var(--wl-secondary2)]">
              A complete decision record for every governed movement across your fleet.
            </p>
          </div>
          <div className="relative w-fit">
            <button
              type="button"
              ref={exportTriggerRef}
              aria-expanded={exportOpen}
              onClick={() => setExportOpen((open) => !open)}
              className="arc-pill group w-fit rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[11px] font-semibold text-[var(--wl-bg)]"
            >
              Export report{" "}
              <span className="ml-2 transition-transform duration-[220ms] group-hover:translate-x-1">
                ↗
              </span>
            </button>
            {exportOpen && (
              <>
                <button
                  type="button"
                  aria-label="Close export menu"
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setExportOpen(false)}
                />
                <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-[240px] border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] shadow-[0_16px_36px_rgba(var(--wl-ink-rgb),.16)]">
                  <button
                    type="button"
                    onClick={exportCsv}
                    className="block w-full px-4 py-3 text-left text-[12px] hover:bg-[var(--wl-bg-soft)]"
                  >
                    Download CSV
                    <span className="mt-0.5 block font-mono text-[9px] tracking-[.12em] text-[var(--wl-mute)]">
                      SPREADSHEET · {visibleRows.length} ROWS
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={exportPrintable}
                    className="block w-full border-t border-[var(--wl-line-soft)] px-4 py-3 text-left text-[12px] hover:bg-[var(--wl-bg-soft)]"
                  >
                    Print / save as PDF
                    <span className="mt-0.5 block font-mono text-[9px] tracking-[.12em] text-[var(--wl-mute)]">
                      FORMATTED DECISION REPORT
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <section className="grid grid-cols-2 border-b border-[var(--wl-line)] md:grid-cols-4">
          {[
            ["TOTAL VALUE", formatUsd(totals.value), false],
            ["APPROVED", String(totals.approved), false],
            ["REJECTED", String(totals.rejected), false],
            ["ESCALATED", String(totals.escalated), true],
          ].map(([label, value, accent], index) => (
            <div
              key={label as string}
              className={`py-6 ${index > 0 ? "border-l border-[var(--wl-line)] pl-5 md:pl-7" : ""} ${
                index > 1 ? "border-t md:border-t-0" : ""
              }`}
            >
              <p className="font-mono text-[9px] tracking-[.15em] text-[var(--wl-mute)]">{label}</p>
              <p
                className={`font-display mt-3 text-[clamp(1.5rem,3vw,2.15rem)] font-medium tabular-nums tracking-[-.015em] ${
                  accent ? "text-[var(--wl-signal)]" : ""
                }`}
              >
                {liveLedger.isLoading ? (
                  <span className="inline-block h-7 w-20 animate-pulse rounded bg-[var(--wl-bg-deep)]" />
                ) : (
                  value
                )}
              </p>
            </div>
          ))}
        </section>

        <div className="flex flex-col gap-4 border-b border-[var(--wl-line)] py-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setStatusFilter(item)}
                aria-pressed={statusFilter === item}
                className={`arc-filter rounded-full border px-3.5 py-2 font-mono text-[9px] uppercase tracking-[.14em] ${
                  statusFilter === item
                    ? "arc-filter-on border-[var(--wl-ink)] bg-[var(--wl-ink)] text-[var(--wl-bg)]"
                    : "border-[var(--wl-line)] text-[var(--wl-secondary2)] hover:border-[var(--wl-ink)] hover:text-[var(--wl-ink)]"
                }`}
              >
                {item}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFlaggedOnly((value) => !value)}
              aria-pressed={flaggedOnly}
              title="Only show payments to counterparties currently flagged for review"
              className={`arc-filter arc-filter-flag rounded-full border px-3.5 py-2 font-mono text-[9px] uppercase tracking-[.14em] ${
                flaggedOnly
                  ? "arc-filter-on border-[var(--wl-signal)] bg-[var(--wl-signal)] text-[var(--wl-bg)]"
                  : "border-[var(--wl-line)] text-[var(--wl-secondary2)] hover:border-[var(--wl-signal)] hover:text-[var(--wl-signal)]"
              }`}
            >
              ⚑ Flagged
            </button>
          </div>
          <label className="flex min-w-0 items-center gap-3 border-b border-[var(--wl-faint)] pb-2 text-[var(--wl-mute)] xl:w-[260px]">
            <span className="font-mono text-[10px]">⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="filter ledger rows..."
              className="min-w-0 flex-1 bg-transparent text-[12px] text-[var(--wl-ink)] outline-none placeholder:text-[var(--wl-mute)]"
            />
          </label>
        </div>

        <div className="mt-7 flex flex-col gap-7 xl:flex-row">
          <section className="min-w-0 flex-1 overflow-hidden border border-[var(--wl-line)] bg-[var(--wl-bg-raised)]">
            <div className="hidden grid-cols-[1.05fr_1.2fr_1fr_1fr_.9fr_90px] gap-4 border-b border-[var(--wl-line)] px-5 py-3 font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-mute)] md:grid">
              <span>Time</span>
              <span>Agent</span>
              <span>Counterparty</span>
              <span>Category</span>
              <span>Amount</span>
              <span>Status</span>
            </div>
            <div>
              {readOnly ? (
                <ConnectCta />
              ) : liveLedger.isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="border-b border-[var(--wl-line-faint)] px-5 py-4">
                    <div className="h-4 w-full animate-pulse rounded bg-[var(--wl-bg-soft)]" />
                  </div>
                ))
              ) : liveLedger.isError ? (
                <div className="px-6 py-16 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
                    RECORD UNAVAILABLE
                  </p>
                  <p className="mt-3 text-[13px] text-[var(--wl-secondary2)]">
                    The governed ledger could not be loaded.
                  </p>
                </div>
              ) : visibleRows.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
                    {baseRows.length === 0 ? "NO ACTIVITY YET" : "NO MATCHING RECORDS"}
                  </p>
                  <p className="mt-3 text-[13px] text-[var(--wl-secondary2)]">
                    {baseRows.length === 0
                      ? "Governed movements will appear here once your wallet is active."
                      : "Try another policy status or search term."}
                  </p>
                </div>
              ) : (
                visibleRows.map((row, index) => (
                  <button
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    style={{ "--row-i": index } as CSSProperties}
                    className={`arc-row grid w-full grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--wl-line-faint)] px-5 py-4 text-left last:border-b-0 md:grid-cols-[1.05fr_1.2fr_1fr_1fr_.9fr_90px] md:gap-4 ${
                      selectedId === row.id ? "arc-row-selected" : ""
                    }`}
                  >
                    <div>
                      <span className="font-mono text-[10px] tabular-nums text-[var(--wl-body)]">
                        {timePart(row.timestamp)}
                      </span>
                      <span className="ml-2 font-mono text-[9px] text-[var(--wl-mute)] md:hidden">
                        UTC
                      </span>
                    </div>
                    <span className="text-[12px] font-medium">{row.agentName}</span>
                    <span className="hidden truncate text-[12px] text-[var(--wl-body)] md:block">
                      {flaggedAddresses.has(row.counterpartyAddress.toLowerCase()) && (
                        <span
                          title="Counterparty flagged for review"
                          className="mr-1.5 text-[var(--wl-signal)]"
                        >
                          ⚑
                        </span>
                      )}
                      {row.counterparty}
                    </span>
                    <span className="hidden font-mono text-[10px] uppercase tracking-[.08em] text-[var(--wl-secondary2)] md:block">
                      {categoryLabel(row.category)}
                    </span>
                    <span className="font-mono text-[12px] tabular-nums">
                      {formatUsdCompact(row.amount)}
                    </span>
                    <StatusPill status={row.status} />
                  </button>
                ))
              )}
            </div>
            <div className="flex justify-between border-t border-[var(--wl-line)] px-5 py-3 font-mono text-[9px] uppercase tracking-[.1em] text-[var(--wl-mute)]">
              <span>{visibleRows.length} visible records</span>
              <span>live record · ARC / USDC</span>
            </div>
          </section>

          {selected && (
            <aside className="arc-drawer w-full shrink-0 border border-[var(--wl-line-bold)] bg-[var(--wl-bg-soft)] xl:w-[360px]">
              <div className="flex items-start justify-between border-b border-[var(--wl-line)] px-5 py-5">
                <div>
                  <p className="font-mono text-[9px] tracking-[.16em] text-[var(--wl-signal)]">
                    DECISION RECORD
                  </p>
                  <h2 className="mt-2 text-[18px] font-medium tracking-[-.04em]">
                    {selected.agentName}
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  {selectedFlagged && (
                    <span
                      title={
                        selectedFlagDetail
                          ? `Flagged by ${selectedFlagDetail.flaggedBy} · ${selectedFlagDetail.flaggedAt}${
                              selectedFlagDetail.note ? ` · ${selectedFlagDetail.note}` : ""
                            }${
                              selectedFlagDetail.noteEditedBy
                                ? ` · Note last edited by ${selectedFlagDetail.noteEditedBy} · ${selectedFlagDetail.noteEditedAt}`
                                : ""
                            }`
                          : undefined
                      }
                      className="rounded-full border border-[var(--wl-signal)] px-2.5 py-1 text-right font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-signal)]"
                    >
                      ⚑ Flagged
                      {selectedFlagDetail && (
                        <span className="block text-[8px] normal-case tracking-[.08em] text-[var(--wl-secondary)]">
                          by {selectedFlagDetail.flaggedByShort} · {selectedFlagDetail.flaggedAt}
                          {selectedFlagDetail.note && (
                            <span className="block max-w-[160px] truncate">
                              “{selectedFlagDetail.note}”
                            </span>
                          )}
                          {selectedFlagDetail.noteEditedBy && (
                            <span className="block">
                              note edited by {selectedFlagDetail.noteEditedByShort} ·{" "}
                              {selectedFlagDetail.noteEditedAt}
                            </span>
                          )}
                        </span>
                      )}
                    </span>
                  )}
                  {!selectedFlagged && selectedUnflagDetail && (
                    <span
                      title={`Review flag removed by ${selectedUnflagDetail.removedBy} · ${selectedUnflagDetail.removedAt}`}
                      className="rounded-full border border-[var(--wl-line)] px-2.5 py-1 text-right font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)]"
                    >
                      Unflagged
                      <span className="block text-[8px] normal-case tracking-[.08em]">
                        by {selectedUnflagDetail.removedByShort} · {selectedUnflagDetail.removedAt}
                      </span>
                    </span>
                  )}
                  <StatusPill status={selected.status} />
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="font-mono text-[10px] uppercase tracking-[.12em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="px-5">
                <div className="border-b border-[var(--wl-line)] py-4">
                  <p className="text-[13px] leading-[1.45] text-[var(--wl-body)]">
                    {selected.reason || "No decision narrative recorded."}
                  </p>
                </div>
                <dl className="divide-y divide-[var(--wl-line)] font-mono text-[10px]">
                  {[
                    ["STATUS", selected.status.toUpperCase()],
                    [
                      "TIME / UTC",
                      `${timePart(selected.timestamp)} · ${datePart(selected.timestamp)}`,
                    ],
                    ["AMOUNT", formatUsd(selected.amount)],
                    ["CATEGORY", categoryLabel(selected.category)],
                    ["AGENT", selected.agentName],
                    ["COUNTERPARTY", selected.counterparty],
                    [
                      "BLOCK HEIGHT",
                      selected.block > 0 ? selected.block.toLocaleString("en-US") : "PENDING",
                    ],
                    ["GAS USED", selected.gasUsed],
                    ["TX HASH", selected.hash],
                  ].map(([label, value]) => (
                    <div key={label} className="grid grid-cols-[1fr_1.2fr] gap-3 py-3">
                      <dt className="text-[var(--wl-mute)]">{label}</dt>
                      <dd className="break-words text-right text-[var(--wl-body)]">{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="flex flex-wrap gap-2 py-5">
                  <button
                    type="button"
                    onClick={() => openArcscan(selected.hash)}
                    className="arc-pill arc-ghost rounded-full border border-[var(--wl-line)] px-3.5 py-2.5 text-[10px] font-semibold"
                  >
                    View on Arcscan ↗
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleVendorFlag(selected)}
                    disabled={flagPending || !isConnected}
                    title={!isConnected ? "Connect wallet first." : undefined}
                    className="rounded-full border border-[var(--wl-signal)] px-3.5 py-2.5 text-[10px] font-semibold text-[var(--wl-signal)] transition-colors duration-[220ms] hover:bg-[var(--wl-signal)] hover:text-[var(--wl-bg)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {selectedFlagged ? "Unflag vendor" : flagNoteOpen ? "Save flag" : "Flag vendor"}
                  </button>
                  {selectedFlagged && (
                    <button
                      type="button"
                      onClick={() => {
                        if (noteEditOpen) {
                          void saveNoteEdit(selected);
                        } else {
                          setNoteEditValue(selectedFlagDetail?.note ?? "");
                          setNoteEditOpen(true);
                        }
                      }}
                      disabled={flagPending || !isConnected}
                      title={!isConnected ? "Connect wallet first." : undefined}
                      className="arc-pill arc-ghost rounded-full border border-[var(--wl-line)] px-3.5 py-2.5 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {noteEditOpen
                        ? "Save note"
                        : selectedFlagDetail?.note
                          ? "Edit note"
                          : "Add note"}
                    </button>
                  )}
                  {selectedFlagged && noteEditOpen && (
                    <div className="w-full">
                      <input
                        autoFocus
                        value={noteEditValue}
                        maxLength={200}
                        onChange={(event) => setNoteEditValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void saveNoteEdit(selected);
                        }}
                        placeholder="Review note (leave empty to clear it)"
                        className="w-full border-b border-[var(--wl-faint)] bg-transparent py-1.5 text-[11px] text-[var(--wl-ink)] outline-none placeholder:text-[var(--wl-mute)] focus:border-[var(--wl-signal)]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setNoteEditOpen(false);
                          setNoteEditValue("");
                        }}
                        className="mt-1.5 font-mono text-[9px] uppercase tracking-[.1em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {!selectedFlagged && flagNoteOpen && (
                    <div className="w-full">
                      <input
                        autoFocus
                        value={flagNote}
                        maxLength={200}
                        onChange={(event) => setFlagNote(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void toggleVendorFlag(selected);
                        }}
                        placeholder="Optional note: why flag this vendor?"
                        className="w-full border-b border-[var(--wl-faint)] bg-transparent py-1.5 text-[11px] text-[var(--wl-ink)] outline-none placeholder:text-[var(--wl-mute)] focus:border-[var(--wl-signal)]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setFlagNoteOpen(false);
                          setFlagNote("");
                        }}
                        className="mt-1.5 font-mono text-[9px] uppercase tracking-[.1em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {!isConnected && (
                    <p className="w-full font-mono text-[9px] tracking-[.1em] text-[var(--wl-mute)]">
                      CONNECT WALLET FIRST
                    </p>
                  )}
                </div>
                <div className="border-t border-[var(--wl-line)] pb-5">
                  <div className="flex items-center justify-between border-b border-[var(--wl-line)] py-4">
                    <span className="font-mono text-[10px] uppercase tracking-[.16em] text-[var(--wl-secondary)]">
                      Review history
                    </span>
                    <span className="font-mono text-[9px] text-[var(--wl-mute)]">
                      {flagHistory.entries.length > 0
                        ? `${flagHistory.entries.length} EVENTS`
                        : "AUDIT TRAIL"}
                    </span>
                  </div>
                  {flagHistory.isLoading ? (
                    <p className="py-4 font-mono text-[9px] tracking-[.1em] text-[var(--wl-mute)]">
                      LOADING REVIEW TRAIL…
                    </p>
                  ) : flagHistory.isError ? (
                    <p className="py-4 font-mono text-[9px] tracking-[.1em] text-[var(--wl-signal)]">
                      REVIEW TRAIL UNAVAILABLE · RETRY SHORTLY
                    </p>
                  ) : flagHistory.entries.length === 0 ? (
                    <p className="py-4 font-mono text-[9px] tracking-[.1em] text-[var(--wl-mute)]">
                      NO REVIEW EVENTS RECORDED FOR THIS COUNTERPARTY
                    </p>
                  ) : (
                    <ol className="divide-y divide-[var(--wl-line)]">
                      {flagHistory.entries.map((entry) => (
                        <li key={entry.id} className="flex items-start justify-between gap-4 py-3">
                          <span className="min-w-0">
                            <span
                              className={`block text-[11px] ${
                                entry.eventType === "unflagged"
                                  ? "text-[var(--wl-secondary2)]"
                                  : "text-[var(--wl-body)]"
                              }`}
                            >
                              {entry.eventType === "flagged" && (
                                <span className="mr-1.5 text-[var(--wl-signal)]">⚑</span>
                              )}
                              {vendorFlagEventLabel(entry.eventType)}
                            </span>
                            {entry.note && (
                              <span className="mt-1 block truncate font-mono text-[9px] text-[var(--wl-secondary)]">
                                “{entry.note}”
                              </span>
                            )}
                            {!entry.note && entry.eventType === "note_updated" && (
                              <span className="mt-1 block font-mono text-[9px] text-[var(--wl-mute)]">
                                note cleared
                              </span>
                            )}
                          </span>
                          <span
                            title={entry.actor}
                            className="shrink-0 text-right font-mono text-[9px] text-[var(--wl-mute)]"
                          >
                            {entry.actorShort}
                            <span className="block">{entry.at}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              </div>
            </aside>
          )}
        </div>
        {notice && (
          <div
            role="status"
            className="fixed bottom-5 left-1/2 z-20 -translate-x-1/2 border border-[var(--wl-ink)] bg-[var(--wl-ink)] px-4 py-3 font-mono text-[10px] text-[var(--wl-bg)] shadow-[0_12px_28px_rgba(var(--wl-ink-rgb),.18)]"
          >
            {notice}
          </div>
        )}
      </main>
    </div>
  );
}
