"use client";

import { ContractsSection } from "./_components/contracts-section";
import { HealthGrid } from "./_components/health-grid";
import { StatusGuide } from "./_components/status-guide";
import { StatusHeader } from "./_components/status-header";
import { useStatusController } from "./_hooks/use-status-controller";

export default function StatusPage() {
  const controller = useStatusController();
  return (
    <main className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]">
      <style>{`
        .health-card{transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 220ms ease}
        .health-card:hover{transform:translateY(-2px);box-shadow:0 12px 24px -20px rgba(var(--wl-ink-rgb),.5)}
        .health-card:hover .card-rule{transform:scaleX(1)}
        .card-rule{transform:scaleX(.25);transform-origin:left;transition:transform 420ms cubic-bezier(.16,1,.3,1)}
        @media (prefers-reduced-motion:reduce){.health-card,.card-rule{transition:none!important;transform:none!important}}
      `}</style>
      <div className="mx-auto max-w-[1400px] px-5 py-10 md:px-8">
        <StatusHeader
          isFetching={controller.isFetching}
          runCheck={() => void controller.runCheck()}
        />
        <section aria-label="Service readiness" className="mt-8 border border-[var(--wl-line)] p-5">
          <p className="font-mono text-sm">SERVICE {controller.overallState}</p>
          <p className="mt-2 text-sm">
            Confirmed catch-up SLO: {controller.freshnessSeconds / 60} minutes. Last catch-up:{" "}
            {controller.lastCatchupAt ?? "unknown"}. Event activity is not a freshness signal.
          </p>
          <p className="mt-2 text-sm">
            Identity: {controller.readiness?.identity.status ?? "unknown"} · Sessions:{" "}
            {controller.readiness?.sessions.status ?? "unknown"} · Rate limiting:{" "}
            {controller.readiness?.rateLimit.status ?? "unknown"} (
            {controller.readiness?.rateLimit.backend ?? "unknown"})
          </p>
        </section>
        <HealthGrid
          indexer={controller.indexer}
          readModel={controller.readModel}
          rpc={controller.rpc}
        />
        <ContractsSection />
        <StatusGuide checkedAt={controller.checkedAt} refreshError={controller.refreshError} />
      </div>
    </main>
  );
}
