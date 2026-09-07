"use client";

import { AnomaliesFooter } from "./_components/anomalies-footer";
import { AnomaliesHeader } from "./_components/anomalies-header";
import { AnomaliesSummary } from "./_components/anomalies-summary";
import { AnomalyRegister } from "./_components/anomaly-register";
import { useAnomaliesController } from "./_hooks/use-anomalies-controller";

export default function AnomaliesPage() {
  const controller = useAnomaliesController();
  return (
    <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8 sm:py-10">
      <style>{`
        .anomaly-row{animation:rowIn 420ms cubic-bezier(.16,1,.3,1) both;animation-delay:calc(var(--row) * 90ms);transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 220ms ease}
        .anomaly-row:hover{transform:translate3d(3px,-2px,0);box-shadow:inset 2px 0 0 var(--wl-signal)}
        @keyframes rowIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @media (prefers-reduced-motion:reduce){.anomaly-row{animation:none;transition:none}.anomaly-row:hover{transform:none}}
      `}</style>
      <AnomaliesHeader />
      <AnomaliesSummary
        critical={controller.critical}
        elevated={controller.elevated}
        peakScore={controller.peakScore}
      />
      <AnomalyRegister
        anomalies={controller.anomalies}
        errored={controller.errored}
        investigated={controller.investigated}
        loading={controller.loading}
        notice={controller.notice}
        readOnly={controller.readOnly}
        onInvestigate={(item) => {
          const opening = controller.investigated !== item.id;
          controller.setInvestigated(opening ? item.id : null);
          if (opening) {
            controller.setNotice(
              `${item.agentName.toUpperCase()} INVESTIGATION OPEN · ${item.flaggedPoint} TRANSACTIONS FLAGGED`,
            );
          }
        }}
        onNotice={controller.setNotice}
        onRetry={() => void controller.refetch()}
      />
      <AnomaliesFooter />
    </div>
  );
}
