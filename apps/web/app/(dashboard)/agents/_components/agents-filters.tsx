import type { AgentsController } from "../_hooks/use-agents-controller";
import type { AgentFilterStatus } from "../_lib/agent-status";

type AgentsFiltersProps = Pick<AgentsController, "filter" | "setFilter" | "query" | "setQuery">;

const FILTERS: readonly AgentFilterStatus[] = ["ALL", "ACTIVE", "FROZEN", "IDLE"];

export function AgentsFilters({ filter, setFilter, query, setQuery }: AgentsFiltersProps) {
  return (
    <section className="flex flex-col justify-between gap-4 py-7 sm:flex-row sm:items-center">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={`rounded-full px-3.5 py-2 font-mono text-[9px] uppercase tracking-[.14em] transition-colors ${
              filter === item
                ? "bg-[var(--wl-ink)] text-[var(--wl-bg)]"
                : "border border-[var(--wl-line)] text-[var(--wl-secondary)] hover:border-[var(--wl-ink)] hover:text-[var(--wl-ink)]"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      <label className="flex w-full items-center gap-2 rounded-full border border-[var(--wl-line)] px-4 py-2.5 text-[var(--wl-secondary)] focus-within:border-[var(--wl-ink)] sm:w-auto">
        <span className="font-mono text-[10px]">⌕</span>
        <input
          aria-label="Search agents"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search agents"
          className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[var(--wl-mute)] sm:w-[170px] sm:flex-none"
        />
      </label>
    </section>
  );
}
