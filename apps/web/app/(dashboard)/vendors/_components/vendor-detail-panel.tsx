import { shortAddress } from "@/lib/format/address";
import {
  type VendorFlagDetail,
  type VendorFlagHistoryEntry,
  type VendorUnflagDetail,
  vendorFlagEventLabel,
} from "@/lib/live-data";
import type { Vendor } from "@/lib/types";

import { categoryLabel } from "../_lib/helpers";
import { VendorReviewControls, type VendorReviewControlsProps } from "./vendor-review-controls";
import { StatePill } from "./vendor-row";

interface VendorDetailPanelProps {
  controls: Omit<VendorReviewControlsProps, "selected">;
  flagHistory: {
    entries: readonly VendorFlagHistoryEntry[];
    isError: boolean;
    isLoading: boolean;
  };
  isVendorFlagged: (address: string) => boolean;
  selected: Vendor | null;
  vendorFlagDetail: (address: string) => VendorFlagDetail | undefined;
  vendorUnflagDetail: (address: string) => VendorUnflagDetail | undefined;
}

export function VendorDetailPanel(props: VendorDetailPanelProps) {
  const { selected } = props;
  if (!selected) return null;
  const flag = props.vendorFlagDetail(selected.address);
  const unflag = props.vendorUnflagDetail(selected.address);
  const flagged = props.isVendorFlagged(selected.address);
  return (
    <aside className="mt-8 grid gap-7 border-t-2 border-[var(--wl-ink)] bg-[var(--wl-bg-soft)] p-6 sm:p-8 lg:grid-cols-[.7fr_1.3fr]">
      <div>
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.17em] text-[var(--wl-signal)]">
              SELECTED / COUNTERPARTY
            </p>
            <h3 className="font-display mt-4 text-3xl font-semibold tracking-[-.015em]">
              {selected.name}
            </h3>
            <p className="mt-2 font-mono text-[10px] text-[var(--wl-secondary)]">
              {shortAddress(selected.address)} · {categoryLabel(selected.category)}
            </p>
          </div>
          <span className="flex flex-col items-end gap-2">
            <StatePill blocked={selected.trust === "blocked"} />
            {flagged && (
              <span
                title={
                  flag
                    ? `Flagged by ${flag.flaggedBy} · ${flag.flaggedAt}${
                        flag.note ? ` · ${flag.note}` : ""
                      }${
                        flag.noteEditedBy
                          ? ` · Note last edited by ${flag.noteEditedBy} · ${flag.noteEditedAt}`
                          : ""
                      }`
                    : undefined
                }
                className="rounded-full border border-[var(--wl-signal)] px-2.5 py-1 text-right font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-signal)]"
              >
                ⚑ Review
                {flag && (
                  <span className="block text-[8px] normal-case tracking-[.08em] text-[var(--wl-secondary)]">
                    by {flag.flaggedByShort} · {flag.flaggedAt}
                    {flag.note && (
                      <span className="block max-w-[180px] truncate">“{flag.note}”</span>
                    )}
                    {flag.noteEditedBy && (
                      <span className="block">
                        note edited by {flag.noteEditedByShort} · {flag.noteEditedAt}
                      </span>
                    )}
                  </span>
                )}
              </span>
            )}
            {!flagged && unflag && (
              <span
                title={`Review flag removed by ${unflag.removedBy} · ${unflag.removedAt}`}
                className="rounded-full border border-[var(--wl-line)] px-2.5 py-1 text-right font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)]"
              >
                Unflagged
                <span className="block text-[8px] normal-case tracking-[.08em]">
                  by {unflag.removedByShort} · {unflag.removedAt}
                </span>
              </span>
            )}
          </span>
        </div>
        <div className="mt-10">
          <div className="flex justify-between font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-secondary)]">
            <span>PER-VENDOR CAP</span>
            <span>{selected.confidential ? "SET" : "NONE"}</span>
          </div>
          <div className="mt-3 flex justify-between font-mono text-[9px] text-[var(--wl-mute)]">
            <span>Last used {selected.lastUsed}</span>
            <span>Added {selected.createdAt ?? "N/A"}</span>
          </div>
        </div>
        <VendorReviewControls
          detail={props.controls.detail}
          flagToggling={props.controls.flagToggling}
          isConnected={props.controls.isConnected}
          isVendorFlagged={props.controls.isVendorFlagged}
          saveNoteEdit={props.controls.saveNoteEdit}
          selected={selected}
          setVendorStatusRemote={props.controls.setVendorStatusRemote}
          submitCap={props.controls.submitCap}
          toggleVendorFlag={props.controls.toggleVendorFlag}
          vendorFlagDetail={props.controls.vendorFlagDetail}
          vendorSaving={props.controls.vendorSaving}
        />
      </div>
      <VendorFactsAndHistory flagHistory={props.flagHistory} selected={selected} />
    </aside>
  );
}

function VendorFactsAndHistory({
  flagHistory,
  selected,
}: {
  flagHistory: VendorDetailPanelProps["flagHistory"];
  selected: Vendor | null;
}) {
  if (!selected) return null;
  return (
    <div>
      <div className="flex items-center justify-between border-b border-[var(--wl-line)] pb-4">
        <span className="font-mono text-[10px] uppercase tracking-[.16em] text-[var(--wl-secondary)]">
          Counterparty detail
        </span>
        <span className="font-mono text-[9px] text-[var(--wl-mute)]">
          {selected.trust.toUpperCase()}
        </span>
      </div>
      <div className="divide-y divide-[var(--wl-line)]">
        <div className="flex items-center justify-between gap-4 py-4">
          <span className="text-[12px] text-[var(--wl-body)]">Full address</span>
          <span className="font-mono text-[11px] tabular-nums">{selected.address}</span>
        </div>
        <div className="flex items-center justify-between gap-4 py-4">
          <span className="text-[12px] text-[var(--wl-body)]">Approved by</span>
          <span className="font-mono text-[11px]">
            {selected.approvedBy.map((by) => shortAddress(by)).join(", ") || "-"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 py-4">
          <span className="text-[12px] text-[var(--wl-body)]">Confidential</span>
          <span className="font-mono text-[11px]">{selected.confidential ? "YES" : "NO"}</span>
        </div>
      </div>
      <p className="mt-8 max-w-[390px] font-mono text-[9px] leading-[1.6] tracking-[.08em] text-[var(--wl-mute)]">
        Every payment is evaluated against this cap before it reaches the governed wallet.
      </p>
      <div className="mt-10">
        <div className="flex items-center justify-between border-b border-[var(--wl-line)] pb-4">
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
            NO REVIEW EVENTS RECORDED FOR THIS VENDOR
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
  );
}
