export function AnomaliesSummary({
  critical,
  elevated,
  peakScore,
}: {
  critical: number;
  elevated: number;
  peakScore: string;
}) {
  return (
    <section className="mt-8 grid gap-5 lg:grid-cols-[1.35fr_.9fr]">
      <div className="border border-[var(--wl-line)] bg-[var(--wl-bg-soft)] p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.17em] text-[var(--wl-secondary)]">
              DEVIATION INDEX
            </p>
            <div className="mt-8 flex items-end gap-3">
              <span className="font-display text-[clamp(4.5rem,9vw,7.8rem)] font-semibold leading-[.72] tracking-[-.015em] text-[var(--wl-signal)]">
                {peakScore}
              </span>
              <span className="mb-1 font-mono text-[10px] tracking-[.14em] text-[var(--wl-signal)]">
                {critical > 0 ? "CRITICAL" : "NOMINAL"}
              </span>
            </div>
          </div>
          <span className="font-mono text-[9px] tracking-[.15em] text-[var(--wl-mute)]">
            LIVE / 24H
          </span>
        </div>
        <p className="mt-5 font-mono text-[9px] uppercase tracking-[.15em] text-[var(--wl-secondary)]">
          peak deviation / 24h
        </p>
        <div className="mt-10">
          <div className="relative h-4 border-t border-[var(--wl-ink)]">
            <span className="absolute left-0 top-2 font-mono text-[9px] text-[var(--wl-secondary)]">
              0
            </span>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((tick) => (
              <span
                key={tick}
                className="absolute top-[-4px] h-2 w-px bg-[var(--wl-ink)]"
                style={{ left: `${tick * 12.5}%` }}
              />
            ))}
            <span
              className="absolute top-[-5px] h-3 w-[2px] bg-[var(--wl-signal)]"
              style={{ left: `${Math.min(100, (Number(peakScore) / 8) * 100)}%` }}
            />
            <span className="absolute right-0 top-2 font-mono text-[9px] text-[var(--wl-secondary)]">
              8
            </span>
          </div>
          <div className="mt-4 flex justify-between font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-mute)]">
            <span>nominal</span>
            <span>attention</span>
            <span>critical</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 divide-x divide-[var(--wl-line)] border border-[var(--wl-line)] bg-[var(--wl-bg-raised)]">
        <div className="p-4 sm:p-6">
          <span className="font-mono text-[9px] tracking-[.14em] text-[var(--wl-secondary)]">
            CRITICAL
          </span>
          <strong className="font-display mt-9 block text-4xl font-semibold tracking-[-.015em] text-[var(--wl-signal)]">
            {critical}
          </strong>
          <span className="mt-2 block font-mono text-[9px] text-[var(--wl-mute)]">NOW</span>
        </div>
        <div className="p-4 sm:p-6">
          <span className="font-mono text-[9px] tracking-[.14em] text-[var(--wl-secondary)]">
            ELEVATED
          </span>
          <strong className="font-display mt-9 block text-4xl font-semibold tracking-[-.015em]">
            {elevated}
          </strong>
          <span className="mt-2 block font-mono text-[9px] text-[var(--wl-mute)]">OPEN</span>
        </div>
        <div className="p-4 sm:p-6">
          <span className="font-mono text-[9px] leading-[1.3] tracking-[.14em] text-[var(--wl-secondary)]">
            RESOLVED / 30D
          </span>
          <strong className="font-display mt-9 block text-4xl font-semibold tracking-[-.015em]">
            -
          </strong>
          <span className="mt-2 block font-mono text-[9px] text-[var(--wl-mute)]">CLOSED</span>
        </div>
      </div>
    </section>
  );
}
