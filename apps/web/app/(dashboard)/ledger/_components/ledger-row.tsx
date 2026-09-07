import type { CSSProperties } from "react";

import { categoryLabel, formatUsdCompact } from "@/lib/format";
import type { LedgerEntry } from "@/lib/types";

import { StatusPill } from "@/components/arcanum/status-pill";
import { timePart } from "../_lib/helpers";

type LedgerRowProps = {
  row: LedgerEntry;
  index: number;
  selected: boolean;
  flagged: boolean;
  onSelect: () => void;
};

function VendorFlag({ flagged }: { flagged: boolean }) {
  return flagged ? (
    <span title="Counterparty flagged for review" className="mr-1.5 text-[var(--wl-signal)]">
      ⚑
    </span>
  ) : null;
}

export function LedgerRow({ row, index, selected, flagged, onSelect }: LedgerRowProps) {
  return (
    <button
      onClick={onSelect}
      style={{ "--row-i": index } as CSSProperties}
      className={`arc-row grid w-full grid-cols-[1fr_auto] items-center gap-3 border-b border-[var(--wl-line-faint)] px-4 py-4 text-left last:border-b-0 md:grid-cols-[1.05fr_1.2fr_1fr_1fr_.9fr_90px] md:gap-4 md:px-5 ${
        selected ? "arc-row-selected" : ""
      }`}
    >
      <div className="md:hidden">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
            Time
          </span>
          <span className="font-mono text-[10px] tabular-nums text-[var(--wl-body)]">
            {timePart(row.timestamp)} UTC
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
          <span className="min-w-0">
            <span className="block font-mono text-[8px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
              Agent
            </span>
            <span className="mt-1 block truncate text-[12px] font-medium">{row.agentName}</span>
          </span>
          <span className="min-w-0">
            <span className="block font-mono text-[8px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
              Counterparty
            </span>
            <span className="mt-1 block truncate text-[12px] text-[var(--wl-body)]">
              <VendorFlag flagged={flagged} />
              {row.counterparty}
            </span>
          </span>
          <span>
            <span className="block font-mono text-[8px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
              Category
            </span>
            <span className="mt-1 block font-mono text-[10px] uppercase tracking-[.08em] text-[var(--wl-secondary2)]">
              {categoryLabel(row.category)}
            </span>
          </span>
          <span>
            <span className="block font-mono text-[8px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
              Amount
            </span>
            <span className="mt-1 block font-mono text-[12px] tabular-nums">
              {formatUsdCompact(row.amount)}
            </span>
          </span>
        </div>
      </div>
      <div className="hidden md:block">
        <span className="font-mono text-[10px] tabular-nums text-[var(--wl-body)]">
          {timePart(row.timestamp)}
        </span>
        <span className="ml-2 font-mono text-[9px] text-[var(--wl-mute)] md:hidden">UTC</span>
      </div>
      <span className="hidden text-[12px] font-medium md:block">{row.agentName}</span>
      <span className="hidden truncate text-[12px] text-[var(--wl-body)] md:block">
        <VendorFlag flagged={flagged} />
        {row.counterparty}
      </span>
      <span className="hidden font-mono text-[10px] uppercase tracking-[.08em] text-[var(--wl-secondary2)] md:block">
        {categoryLabel(row.category)}
      </span>
      <span className="hidden font-mono text-[12px] tabular-nums md:block">
        {formatUsdCompact(row.amount)}
      </span>
      <span className="flex flex-col items-end gap-1 md:block">
        <span className="font-mono text-[8px] uppercase tracking-[.12em] text-[var(--wl-mute)] md:hidden">
          Status
        </span>
        <StatusPill status={row.status} tone={row.status} />
      </span>
    </button>
  );
}
