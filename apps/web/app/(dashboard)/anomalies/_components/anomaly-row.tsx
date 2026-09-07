import type { CSSProperties } from "react";

import { StatusPill } from "@/components/arcanum/status-pill";
import { shortAddress } from "@/lib/format/address";
import type { Anomaly } from "@/lib/types";

import { useAnomalyAction } from "../_hooks/use-anomaly-action";
import { AnomalyActionControls } from "./anomaly-action-controls";
import { Sparkline } from "./sparkline";

export function AnomalyRow({
  item,
  index,
  investigated,
  onInvestigate,
  onNotice,
}: {
  item: Anomaly;
  index: number;
  investigated: boolean;
  onInvestigate: () => void;
  onNotice: (message: string) => void;
}) {
  const action = useAnomalyAction(item, onNotice);
  const severity = item.score >= 5 ? "CRITICAL" : "ELEVATED";

  if (action.state === "dismissed") {
    return null;
  }

  return (
    <div
      style={{ "--row": index } as CSSProperties}
      className={`anomaly-row grid gap-4 px-4 py-5 md:grid-cols-[1.08fr_1fr_.72fr_.55fr_1.4fr_.75fr_1.55fr] md:items-center ${
        action.isPending ? "opacity-60" : ""
      }`}
    >
      <div>
        <span className="mb-1 block font-mono text-[8px] uppercase tracking-[.12em] text-[var(--wl-mute)] md:hidden">
          Agent
        </span>
        <div className="text-[13px] font-medium">{item.agentName}</div>
        <div className="mt-1 font-mono text-[9px] text-[var(--wl-mute)]">
          agent wallet · {shortAddress(item.agentId)}
        </div>
      </div>
      <span className="font-mono text-[10px] tabular-nums text-[var(--wl-body)]">
        <span className="mr-2 md:hidden">Observed</span>
        {item.timestamp}
      </span>
      <div>
        <span className="mb-1 block font-mono text-[8px] uppercase tracking-[.12em] text-[var(--wl-mute)] md:hidden">
          Status
        </span>
        <StatusPill
          status={action.frozen ? "FROZEN" : "WATCH"}
          tone={action.frozen ? "frozen" : "escalated"}
        />
        <span className="ml-2 font-mono text-[9px] tracking-[.1em] text-[var(--wl-secondary)] md:hidden">
          {severity}
        </span>
      </div>
      <span className="font-mono text-[14px] tabular-nums text-[var(--wl-signal)]">
        <span className="mr-2 md:hidden">Score</span>
        {item.score.toFixed(1)}
      </span>
      <span className="text-[12px] text-[var(--wl-body)]">
        <span className="mr-2 md:hidden">Deviation</span>
        {item.narrative}
      </span>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[8px] uppercase tracking-[.12em] text-[var(--wl-mute)] md:hidden">
          Trend
        </span>
        <Sparkline points={item.points} />
        <span className="hidden font-mono text-[9px] tracking-[.12em] text-[var(--wl-secondary)] lg:inline">
          {severity}
        </span>
      </div>
      <AnomalyActionControls
        acknowledgePending={action.acknowledgePending}
        dismissPending={action.dismissPending}
        frozen={action.frozen}
        investigated={investigated}
        isConnected={action.isConnected}
        onInvestigate={onInvestigate}
        onSettle={(next, event) => void action.settle(next, event)}
      />
      {investigated && (
        <div className="border-l-2 border-[var(--wl-signal)] bg-[var(--wl-bg-soft)] px-5 py-4 md:col-span-7">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-signal)]">
              INVESTIGATION TRACE / {item.agentName.toUpperCase()}
            </p>
            <span className="font-mono text-[8.5px] tracking-[.1em] text-[var(--wl-mute)]">
              OPENED {item.timestamp}
            </span>
          </div>
          <div className="mt-3 grid gap-x-8 gap-y-2 text-[11px] text-[var(--wl-body)] sm:grid-cols-2">
            <div className="flex justify-between border-b border-[var(--wl-line-soft)] pb-1.5">
              <span>Baseline comparison</span>
              <span className="font-mono text-[9px] tracking-[.08em] text-[var(--wl-signal)]">
                DEVIATION {item.score.toFixed(1)}σ
              </span>
            </div>
            <div className="flex justify-between border-b border-[var(--wl-line-soft)] pb-1.5">
              <span>Vendor path</span>
              <span className="font-mono text-[9px] tracking-[.08em] text-[var(--wl-green)]">
                3 HOPS VERIFIED
              </span>
            </div>
            <div className="flex justify-between border-b border-[var(--wl-line-soft)] pb-1.5">
              <span>Wallet history · 30d</span>
              <span className="font-mono text-[9px] tracking-[.08em] text-[var(--wl-body)]">
                {item.flaggedPoint} TX FLAGGED
              </span>
            </div>
            <div className="flex justify-between border-b border-[var(--wl-line-soft)] pb-1.5">
              <span>Policy doctrine check</span>
              <span className="font-mono text-[9px] tracking-[.08em] text-[var(--wl-signal)]">
                §3.2 CAP BURST
              </span>
            </div>
          </div>
          <div className="mt-3 flex gap-4">
            <a
              href="/ledger"
              className="font-mono text-[9px] tracking-[.12em] text-[var(--wl-signal)] hover:underline"
            >
              OPEN LEDGER ROWS →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
