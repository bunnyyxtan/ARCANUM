import { formatUsd, formatUsdCompact } from "@/lib/format/money";

import type { AgentDetailController } from "../_hooks/use-agent-detail-controller";

export function AgentBehavior({ controller }: { controller: AgentDetailController }) {
  const { average, bars, peak, restraints, total } = controller.behavior;
  return (
    <>
      <div className="flex items-end justify-between border-b border-[var(--wl-line)] pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.17em] text-[var(--wl-signal)]">
            BEHAVIOR / ON RECORD
          </p>
          <h2 className="font-display mt-2 text-[22px] font-medium tracking-[-.015em]">
            Spending behavior
          </h2>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-mute)]">
          USD · UTC
        </span>
      </div>
      <div className="grid grid-cols-2 border-b border-[var(--wl-line)] py-6 sm:grid-cols-4">
        {(
          [
            ["RECORDED TOTAL", formatUsd(total)],
            ["AVG. TX", formatUsd(average)],
            ["PEAK TX", formatUsd(peak)],
            ["RESTRAINTS", restraints.toString().padStart(2, "0")],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="mb-4 sm:mb-0">
            <p className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
              {label}
            </p>
            <p className="mt-2 font-mono text-[14px] tabular-nums">{value}</p>
          </div>
        ))}
      </div>
      {bars.length > 0 ? (
        <>
          <div className="flex h-[180px] items-end gap-2 border-b border-[var(--wl-line)] px-2 py-6">
            {bars.map((row) => {
              const ratio = peak > 0 ? row.amount / peak : 0;
              const restrained =
                row.status === "rejected" || row.status === "escalated" || row.status === "frozen";
              return (
                <div
                  key={row.id}
                  // biome-ignore lint/a11y/noNoninteractiveTabindex: focus reveals the bar's value tooltip for keyboard users
                  tabIndex={0}
                  aria-label={`${formatUsd(row.amount)} · ${row.status} · ${row.timestamp}`}
                  className="group relative flex h-full flex-1 flex-col items-center justify-end outline-none"
                >
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap border border-[var(--wl-line)] bg-[var(--wl-bg-raised)] px-2.5 py-1.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 max-md:opacity-100 max-sm:left-auto max-sm:right-0 max-sm:translate-x-0">
                    <p className="font-mono text-[11px] tabular-nums text-[var(--wl-ink)]">
                      {formatUsd(row.amount)}
                    </p>
                    <p className="mt-0.5 font-mono text-[8px] uppercase tracking-[.1em] text-[var(--wl-mute)]">
                      {row.status} · {row.timestamp}
                    </p>
                  </div>
                  <span className="mb-1.5 hidden font-mono text-[8px] tabular-nums text-[var(--wl-mute)] transition-colors group-hover:text-[var(--wl-ink)] sm:block">
                    {formatUsdCompact(row.amount)}
                  </span>
                  <span
                    className={`behavior-bar w-full origin-bottom transition-transform duration-[420ms] group-hover:scale-y-105 ${restrained ? "bg-[var(--wl-signal)]" : "bg-[var(--wl-ink)]"}`}
                    style={{ height: `${Math.max(4, ratio * 82)}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between pt-3 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
            <span>{bars[0]?.timestamp ?? "-"}</span>
            <span className="hidden items-center gap-4 sm:flex">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 bg-[var(--wl-ink)]" />
                settled
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 bg-[var(--wl-signal)]" />
                restrained
              </span>
            </span>
            <span>{bars[bars.length - 1]?.timestamp ?? "-"}</span>
          </div>
        </>
      ) : (
        <div className="border-b border-[var(--wl-line)] py-10 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
            No spend recorded yet
          </p>
          <p className="mx-auto mt-3 max-w-[360px] text-[12px] leading-[1.5] text-[var(--wl-body)]">
            Behavior charts populate once this governed wallet settles payments on Arc Testnet.
          </p>
        </div>
      )}
    </>
  );
}
