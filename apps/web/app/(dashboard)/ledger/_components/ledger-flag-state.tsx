import type { VendorFlagDetail, VendorUnflagDetail } from "@/lib/live-data";

type LedgerFlagStateProps = {
  flagged: boolean;
  flagDetail?: VendorFlagDetail;
  unflagDetail?: VendorUnflagDetail;
};

export function LedgerFlagState({ flagged, flagDetail, unflagDetail }: LedgerFlagStateProps) {
  if (flagged) {
    return (
      <span
        title={
          flagDetail
            ? `Flagged by ${flagDetail.flaggedBy} · ${flagDetail.flaggedAt}${
                flagDetail.note ? ` · ${flagDetail.note}` : ""
              }${
                flagDetail.noteEditedBy
                  ? ` · Note last edited by ${flagDetail.noteEditedBy} · ${flagDetail.noteEditedAt}`
                  : ""
              }`
            : undefined
        }
        className="rounded-full border border-[var(--wl-signal)] px-2.5 py-1 text-right font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-signal)]"
      >
        ⚑ Flagged
        {flagDetail && (
          <span className="block text-[8px] normal-case tracking-[.08em] text-[var(--wl-secondary)]">
            by {flagDetail.flaggedByShort} · {flagDetail.flaggedAt}
            {flagDetail.note && (
              <span className="block max-w-[160px] truncate">“{flagDetail.note}”</span>
            )}
            {flagDetail.noteEditedBy && (
              <span className="block">
                note edited by {flagDetail.noteEditedByShort} · {flagDetail.noteEditedAt}
              </span>
            )}
          </span>
        )}
      </span>
    );
  }
  return unflagDetail ? (
    <span
      title={`Review flag removed by ${unflagDetail.removedBy} · ${unflagDetail.removedAt}`}
      className="rounded-full border border-[var(--wl-line)] px-2.5 py-1 text-right font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)]"
    >
      Unflagged
      <span className="block text-[8px] normal-case tracking-[.08em]">
        by {unflagDetail.removedByShort} · {unflagDetail.removedAt}
      </span>
    </span>
  ) : null;
}
