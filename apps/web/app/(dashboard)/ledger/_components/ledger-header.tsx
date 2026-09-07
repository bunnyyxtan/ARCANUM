import { formatUsd } from "@/lib/format";

import type { LedgerController } from "../_hooks/use-ledger-controller";

export function LedgerHeader({ ledger }: { ledger: LedgerController }) {
  const { filters, ledgerExport } = ledger;
  return (
    <>
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
            ref={ledgerExport.exportTriggerRef}
            aria-expanded={ledgerExport.exportOpen}
            onClick={() => ledgerExport.setExportOpen((open) => !open)}
            className="arc-pill group w-fit rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[11px] font-semibold text-[var(--wl-bg)]"
          >
            Export report{" "}
            <span className="ml-2 transition-transform duration-[220ms] group-hover:translate-x-1">
              ↗
            </span>
          </button>
          {ledgerExport.exportOpen && (
            <>
              <button
                type="button"
                aria-label="Close export menu"
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => ledgerExport.setExportOpen(false)}
              />
              <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-[240px] border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] shadow-[0_16px_36px_rgba(var(--wl-ink-rgb),.16)]">
                <button
                  type="button"
                  onClick={ledgerExport.exportCsv}
                  className="block w-full px-4 py-3 text-left text-[12px] hover:bg-[var(--wl-bg-soft)]"
                >
                  Download CSV
                  <span className="mt-0.5 block font-mono text-[9px] tracking-[.12em] text-[var(--wl-mute)]">
                    SPREADSHEET · {filters.visibleRows.length} ROWS
                  </span>
                </button>
                <button
                  type="button"
                  onClick={ledgerExport.exportPrintable}
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
          ["TOTAL VALUE", formatUsd(filters.totals.value), false],
          ["APPROVED", String(filters.totals.approved), false],
          ["REJECTED", String(filters.totals.rejected), false],
          ["ESCALATED", String(filters.totals.escalated), true],
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
              {ledger.liveLedger.isLoading ? (
                <span className="inline-block h-7 w-20 animate-pulse rounded bg-[var(--wl-bg-deep)]" />
              ) : (
                value
              )}
            </p>
          </div>
        ))}
      </section>
    </>
  );
}
