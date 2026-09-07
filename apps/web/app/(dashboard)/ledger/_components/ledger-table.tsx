import { ConnectCta } from "@/components/warm/ConnectCta";

import type { LedgerController } from "../_hooks/use-ledger-controller";
import { LedgerRow } from "./ledger-row";

const skeletonRows = ["one", "two", "three", "four", "five", "six"] as const;

export function LedgerTable({ ledger }: { ledger: LedgerController }) {
  const { filters, liveLedger, selection, vendorFlags } = ledger;
  return (
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
        {ledger.readOnly ? (
          <ConnectCta />
        ) : liveLedger.isLoading ? (
          skeletonRows.map((key) => (
            <div key={key} className="border-b border-[var(--wl-line-faint)] px-5 py-4">
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
        ) : filters.visibleRows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
              {liveLedger.data.length === 0 ? "NO ACTIVITY YET" : "NO MATCHING RECORDS"}
            </p>
            <p className="mt-3 text-[13px] text-[var(--wl-secondary2)]">
              {liveLedger.data.length === 0
                ? "Governed movements will appear here once your wallet is active."
                : "Try another policy status or search term."}
            </p>
          </div>
        ) : (
          filters.visibleRows.map((row, index) => (
            <LedgerRow
              key={row.id}
              row={row}
              index={index}
              selected={selection.selectedId === row.id}
              flagged={vendorFlags.flaggedAddresses.has(row.counterpartyAddress.toLowerCase())}
              onSelect={() => selection.setSelectedId(row.id)}
            />
          ))
        )}
      </div>
      <div className="flex justify-between border-t border-[var(--wl-line)] px-5 py-3 font-mono text-[9px] uppercase tracking-[.1em] text-[var(--wl-mute)]">
        <span>{filters.visibleRows.length} visible records</span>
        <span>live record · ARC / USDC</span>
      </div>
    </section>
  );
}
