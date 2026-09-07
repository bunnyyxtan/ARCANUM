"use client";

import { EscalationsHeader } from "./_components/escalations-header";
import { EscalationsNotice } from "./_components/escalations-notice";
import { EscalationsQueue } from "./_components/escalations-queue";
import { EscalationsSummary } from "./_components/escalations-summary";
import { ResolvedEscalations } from "./_components/resolved-escalations";
import { useEscalationsController } from "./_hooks/use-escalations-controller";

export default function EscalationsPage() {
  const controller = useEscalationsController();
  return (
    <div className="mx-auto max-w-[1400px] px-5 py-8 md:px-8 md:py-10">
      <style>{`
        .arc-pill{position:relative;isolation:isolate;overflow:hidden;transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 320ms cubic-bezier(.16,1,.3,1),color 220ms ease,border-color 220ms ease}
        .arc-pill:before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:var(--wl-signal-deep);transform:translateY(102%);transition:transform 320ms cubic-bezier(.16,1,.3,1)}
        .arc-pill:hover{transform:translateY(-2px);box-shadow:0 10px 28px -8px rgba(var(--wl-signal-rgb),.42),0 2px 6px rgba(var(--wl-ink-rgb),.08)}.arc-pill:hover:before{transform:translateY(0)}
        .arc-ghost:before{background:var(--wl-ink)}.arc-ghost:hover{color:var(--wl-bg);border-color:var(--wl-ink);box-shadow:0 10px 28px -10px rgba(var(--wl-ink-rgb),.35)}
        .arc-card{animation:cardIn 420ms cubic-bezier(.16,1,.3,1) calc(var(--card-i) * 110ms) both;transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 220ms ease}.arc-card:hover{transform:translateY(-3px);box-shadow:10px 14px 0 var(--wl-bg-deep2)}
        .arc-card-near{border-left:2px solid var(--wl-signal)}.arc-card-resolved{opacity:.76}.arc-stamp{transform:rotate(-7deg);border:1px solid var(--wl-green);color:var(--wl-green)}
        @keyframes cardIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}@media (prefers-reduced-motion:reduce){.arc-pill,.arc-card{animation:none!important;transition:none!important}.arc-card:hover,.arc-pill:hover{transform:none}}
      `}</style>

      <EscalationsHeader reviewNext={controller.reviewNext} />
      <EscalationsNotice notice={controller.notice} />
      <EscalationsSummary
        pendingCount={controller.pendingCount}
        queueCount={controller.queue.length}
        resolvedCount={controller.resolvedCount}
      />
      <EscalationsQueue
        errored={controller.errored}
        liveEscalations={controller.liveEscalations}
        loading={controller.loading}
        markResolved={controller.markResolved}
        queue={controller.queue}
        readOnly={controller.readOnly}
      />
      <ResolvedEscalations items={controller.resolvedHistory} />
    </div>
  );
}
