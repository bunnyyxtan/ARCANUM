import type { CSSProperties } from "react";

import type { HealthState } from "../_hooks/use-status-controller";

export function HealthCard({
  index,
  label,
  detail,
  metric,
  metricLabel,
  state = "OPERATIONAL",
}: {
  index: number;
  label: string;
  detail: string;
  metric: string;
  metricLabel: string;
  state?: HealthState;
}) {
  return (
    <article
      className="health-card warm-reveal is-visible relative border-r border-[var(--wl-line)] px-7 py-7 first:pl-0 last:border-r-0 last:pr-0 max-lg:border-b max-lg:border-r-0 max-lg:px-0 max-lg:py-6"
      style={{ "--i": index } as CSSProperties}
    >
      <span className="card-rule absolute left-0 right-7 top-0 h-[2px] bg-[var(--wl-signal)]" />
      <div className="flex items-start justify-between gap-5">
        <span className="font-mono text-[10px] uppercase tracking-[.16em] text-[var(--wl-body)]">
          {label}
        </span>
        <span
          className={`font-mono text-[10px] tracking-[.12em] ${
            state === "OPERATIONAL" ? "text-[var(--wl-ink)]" : "text-[var(--wl-signal)]"
          }`}
        >
          {state}
        </span>
      </div>
      <p className="mt-12 max-w-[290px] text-[13px] leading-[1.45] text-[var(--wl-secondary2)]">
        {detail}
      </p>
      <div className="mt-8 border-t border-[var(--wl-line-soft)] pt-4">
        <strong className="block font-mono text-[20px] font-medium tabular-nums tracking-[-.04em]">
          {metric}
        </strong>
        <span className="mt-1 block font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-mute)]">
          {metricLabel}
        </span>
      </div>
    </article>
  );
}
