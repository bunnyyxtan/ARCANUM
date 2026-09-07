import type { HealthState } from "../_hooks/use-status-controller";
import { healthCardContent } from "../_lib/status-content";
import { HealthCard } from "./health-card";

type HealthMetric = {
  metric: string;
  metricLabel: string;
  state: HealthState;
};

export function HealthGrid({
  indexer,
  readModel,
  rpc,
}: {
  indexer: HealthMetric;
  readModel: HealthMetric;
  rpc: HealthMetric;
}) {
  const metrics = { indexer, readModel, rpc };
  return (
    <section className="mt-16 border-y border-[var(--wl-line)]" aria-label="Infrastructure health">
      <div className="grid grid-cols-3 max-lg:grid-cols-1">
        {healthCardContent.map((card) => (
          <HealthCard
            key={card.key}
            index={card.index}
            label={card.label}
            detail={card.detail}
            metric={metrics[card.key].metric}
            metricLabel={metrics[card.key].metricLabel}
            state={metrics[card.key].state}
          />
        ))}
      </div>
    </section>
  );
}
