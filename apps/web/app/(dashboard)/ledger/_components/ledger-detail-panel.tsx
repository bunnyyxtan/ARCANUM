import { categoryLabel, formatUsd } from "@/lib/format";

import type { LedgerController } from "../_hooks/use-ledger-controller";
import { datePart, timePart } from "../_lib/helpers";
import { LedgerFlagState } from "./ledger-flag-state";
import { LedgerNoteEditor } from "./ledger-note-editor";
import { LedgerReviewHistory } from "./ledger-review-history";
import { StatusPill } from "./status-pill";

export function LedgerDetailPanel({ ledger }: { ledger: LedgerController }) {
  const { selection, notes, vendorFlags } = ledger;
  const selected = selection.selected;
  if (!selected) return null;
  const flagDetail = ledger.selectedAddress
    ? vendorFlags.flagDetails.get(ledger.selectedAddress)
    : undefined;
  const unflagDetail = ledger.selectedAddress
    ? vendorFlags.unflagDetails.get(ledger.selectedAddress)
    : undefined;

  return (
    <aside className="arc-drawer w-full shrink-0 border border-[var(--wl-line-bold)] bg-[var(--wl-bg-soft)] xl:w-[360px]">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--wl-line)] px-4 py-5 md:px-5">
        <div>
          <p className="font-mono text-[9px] tracking-[.16em] text-[var(--wl-signal)]">
            DECISION RECORD
          </p>
          <h2 className="mt-2 text-[18px] font-medium tracking-[-.04em]">{selected.agentName}</h2>
        </div>
        <div className="flex items-center gap-3">
          <LedgerFlagState
            flagged={ledger.selectedFlagged}
            flagDetail={flagDetail}
            unflagDetail={unflagDetail}
          />
          <StatusPill status={selected.status} />
          <button
            type="button"
            onClick={() => selection.setSelectedId(null)}
            className="min-h-11 md:min-h-0 min-w-11 md:min-w-0 px-2 font-mono text-[10px] uppercase tracking-[.12em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
          >
            Close
          </button>
        </div>
      </div>
      <div className="px-4 md:px-5">
        <div className="border-b border-[var(--wl-line)] py-4">
          <p className="text-[13px] leading-[1.45] text-[var(--wl-body)]">
            {selected.reason || "No decision narrative recorded."}
          </p>
        </div>
        <dl className="divide-y divide-[var(--wl-line)] font-mono text-[10px]">
          {[
            ["STATUS", selected.status.toUpperCase()],
            ["TIME / UTC", `${timePart(selected.timestamp)} · ${datePart(selected.timestamp)}`],
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
              <dd className="min-w-0 break-all text-right text-[var(--wl-body)]">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-2 py-5">
          <button
            type="button"
            onClick={() => ledger.openArcscan(selected.hash)}
            className="arc-pill arc-ghost rounded-full border border-[var(--wl-line)] px-3.5 py-2.5 text-[10px] font-semibold"
          >
            View on Arcscan ↗
          </button>
          <button
            type="button"
            onClick={() => void notes.toggleVendorFlag(selected)}
            disabled={notes.flagPending || !ledger.isConnected}
            title={!ledger.isConnected ? "Connect wallet first." : undefined}
            className="rounded-full border border-[var(--wl-signal)] px-3.5 py-2.5 text-[10px] font-semibold text-[var(--wl-signal)] transition-colors duration-[220ms] hover:bg-[var(--wl-signal)] hover:text-[var(--wl-bg)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {ledger.selectedFlagged
              ? "Unflag vendor"
              : notes.flagNoteOpen
                ? "Save flag"
                : "Flag vendor"}
          </button>
          {ledger.selectedFlagged && (
            <button
              type="button"
              onClick={() =>
                notes.noteEditOpen
                  ? void notes.saveNoteEdit(selected)
                  : notes.beginNoteEdit(flagDetail?.note)
              }
              disabled={notes.flagPending || !ledger.isConnected}
              title={!ledger.isConnected ? "Connect wallet first." : undefined}
              className="arc-pill arc-ghost rounded-full border border-[var(--wl-line)] px-3.5 py-2.5 text-[10px] font-semibold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {notes.noteEditOpen ? "Save note" : flagDetail?.note ? "Edit note" : "Add note"}
            </button>
          )}
          {ledger.selectedFlagged && notes.noteEditOpen && (
            <LedgerNoteEditor
              value={notes.noteEditValue}
              onChange={notes.setNoteEditValue}
              onSave={() => void notes.saveNoteEdit(selected)}
              onCancel={notes.cancelNoteEdit}
              placeholder="Review note (leave empty to clear it)"
            />
          )}
          {!ledger.selectedFlagged && notes.flagNoteOpen && (
            <LedgerNoteEditor
              value={notes.flagNote}
              onChange={notes.setFlagNote}
              onSave={() => void notes.toggleVendorFlag(selected)}
              onCancel={notes.cancelFlagNote}
              placeholder="Optional note: why flag this vendor?"
            />
          )}
          {!ledger.isConnected && (
            <p className="w-full font-mono text-[9px] tracking-[.1em] text-[var(--wl-mute)]">
              CONNECT WALLET FIRST
            </p>
          )}
        </div>
        <LedgerReviewHistory history={ledger.flagHistory} />
      </div>
    </aside>
  );
}
