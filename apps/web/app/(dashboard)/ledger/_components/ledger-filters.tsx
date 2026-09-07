import type { LedgerController } from "../_hooks/use-ledger-controller";
import { statusFilters } from "../_lib/helpers";

export function LedgerFilters({
  filters,
}: {
  filters: LedgerController["filters"];
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-[var(--wl-line)] py-5 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-wrap gap-2">
        {statusFilters.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => filters.setStatusFilter(item)}
            aria-pressed={filters.statusFilter === item}
            className={`arc-filter rounded-full border px-3.5 py-2 font-mono text-[9px] uppercase tracking-[.14em] ${
              filters.statusFilter === item
                ? "arc-filter-on border-[var(--wl-ink)] bg-[var(--wl-ink)] text-[var(--wl-bg)]"
                : "border-[var(--wl-line)] text-[var(--wl-secondary2)] hover:border-[var(--wl-ink)] hover:text-[var(--wl-ink)]"
            }`}
          >
            {item}
          </button>
        ))}
        <button
          type="button"
          onClick={() => filters.setFlaggedOnly((value) => !value)}
          aria-pressed={filters.flaggedOnly}
          title="Only show payments to counterparties currently flagged for review"
          className={`arc-filter arc-filter-flag rounded-full border px-3.5 py-2 font-mono text-[9px] uppercase tracking-[.14em] ${
            filters.flaggedOnly
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
          value={filters.search}
          onChange={(event) => filters.setSearch(event.target.value)}
          placeholder="filter ledger rows..."
          className="min-w-0 flex-1 bg-transparent text-[12px] text-[var(--wl-ink)] outline-none placeholder:text-[var(--wl-mute)]"
        />
      </label>
    </div>
  );
}
