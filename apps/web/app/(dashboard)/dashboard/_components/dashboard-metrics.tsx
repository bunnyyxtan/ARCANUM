import { Reveal } from "@/components/arcanum/reveal";
import type { ReactNode } from "react";
import type { DashboardController } from "../_hooks/use-dashboard-controller";

import { CountUp } from "./count-up";

type Kpi = { label: string; value: ReactNode; note: string; accent?: boolean };

export function DashboardMetrics({ metrics }: Pick<DashboardController, "metrics">) {
  const kpis: Kpi[] = [
    {
      label: "VALUE GOVERNED",
      value: <CountUp target={metrics.valueGoverned} prefix="$" decimals={2} />,
      note: "onchain record",
    },
    {
      label: "ACTIVE AGENTS",
      value: String(metrics.activeAgents).padStart(2, "0"),
      note: "live",
    },
    {
      label: "THREATS BLOCKED",
      value: String(metrics.threatsBlocked),
      note: "policy denials",
    },
    {
      label: "PENDING ESCALATIONS",
      value: String(metrics.pendingEscalations).padStart(2, "0"),
      note: metrics.pendingEscalations > 0 ? "review required" : "no pending reviews",
      accent: metrics.pendingEscalations > 0,
    },
  ];
  return (
    <section
      aria-label="Governance metrics"
      className="grid border-b border-[var(--wl-line)] md:grid-cols-4"
    >
      {kpis.map((kpi, i) => (
        <Reveal key={kpi.label} index={i + 1}>
          <div
            className={`min-h-[142px] border-b border-[var(--wl-line)] py-6 md:border-b-0 ${
              i > 0 ? "md:border-l md:pl-6" : "md:pr-6"
            } ${i < 3 ? "md:pr-6" : ""}`}
          >
            <p className="font-mono text-[9px] uppercase tracking-[.15em] text-[var(--wl-secondary)]">
              {kpi.label}
            </p>
            <p
              className={`font-display mt-5 text-[32px] font-semibold tracking-[-.015em] tabular-nums ${
                kpi.accent ? "text-[var(--wl-signal)]" : "text-[var(--wl-ink)]"
              }`}
            >
              {metrics.isLoading ? (
                <span className="inline-block h-8 w-24 animate-pulse rounded bg-[var(--wl-bg-deep)]" />
              ) : (
                kpi.value
              )}
            </p>
            <p className="mt-2 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
              {metrics.isError ? "record unavailable" : kpi.note}
            </p>
          </div>
        </Reveal>
      ))}
    </section>
  );
}
