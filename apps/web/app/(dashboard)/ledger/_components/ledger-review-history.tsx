import { vendorFlagEventLabel } from "@/lib/live-data";

import type { LedgerController } from "../_hooks/use-ledger-controller";

export function LedgerReviewHistory({
  history,
}: {
  history: LedgerController["flagHistory"];
}) {
  return (
    <div className="border-t border-[var(--wl-line)] pb-5">
      <div className="flex items-center justify-between border-b border-[var(--wl-line)] py-4">
        <span className="font-mono text-[10px] uppercase tracking-[.16em] text-[var(--wl-secondary)]">
          Review history
        </span>
        <span className="font-mono text-[9px] text-[var(--wl-mute)]">
          {history.entries.length > 0 ? `${history.entries.length} EVENTS` : "AUDIT TRAIL"}
        </span>
      </div>
      {history.isLoading ? (
        <p className="py-4 font-mono text-[9px] tracking-[.1em] text-[var(--wl-mute)]">
          LOADING REVIEW TRAIL…
        </p>
      ) : history.isError ? (
        <p className="py-4 font-mono text-[9px] tracking-[.1em] text-[var(--wl-signal)]">
          REVIEW TRAIL UNAVAILABLE · RETRY SHORTLY
        </p>
      ) : history.entries.length === 0 ? (
        <p className="py-4 font-mono text-[9px] tracking-[.1em] text-[var(--wl-mute)]">
          NO REVIEW EVENTS RECORDED FOR THIS COUNTERPARTY
        </p>
      ) : (
        <ol className="divide-y divide-[var(--wl-line)]">
          {history.entries.map((entry) => (
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
  );
}
