"use client";

import { DashboardEventStream } from "./_components/dashboard-event-stream";
import { DashboardFooter } from "./_components/dashboard-footer";
import { DashboardHeader } from "./_components/dashboard-header";
import { DashboardMetrics } from "./_components/dashboard-metrics";
import { RestraintQueue } from "./_components/restraint-queue";
import { useDashboardController } from "./_hooks/use-dashboard-controller";

export default function DashboardPage() {
  const dashboard = useDashboardController();
  return (
    <div id="top" className="mx-auto max-w-[1400px] px-5 py-9 md:px-8 md:py-10">
      <style>{`
        .stream-row{transition:transform 220ms cubic-bezier(.16,1,.3,1),background-color 220ms ease}
        .stream-row:hover{transform:translateX(3px);background:var(--wl-bg-soft)}
        @media (prefers-reduced-motion:reduce){.stream-row{transition:none}}
      `}</style>
      <DashboardHeader readOnly={dashboard.readOnly} org={dashboard.org} />
      <DashboardMetrics metrics={dashboard.metrics} />
      <section
        id="stream"
        className="grid min-w-0 gap-10 pt-10 xl:grid-cols-[minmax(0,1.65fr)_minmax(350px,.75fr)]"
      >
        <DashboardEventStream readOnly={dashboard.readOnly} events={dashboard.events} />
        <RestraintQueue
          readOnly={dashboard.readOnly}
          escalations={dashboard.escalations}
          anomalies={dashboard.anomalies}
          pendingItem={dashboard.pendingItem}
          attentionSettled={dashboard.attentionSettled}
          needsAttention={dashboard.needsAttention}
        />
      </section>
      <DashboardFooter />
    </div>
  );
}
