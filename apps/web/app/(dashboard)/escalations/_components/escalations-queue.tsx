import { ConnectCta } from "@/components/warm/ConnectCta";
import type { Escalation } from "@/lib/types";
import type { EscalationChainUpdate } from "../_hooks/use-escalation-action";

import { EscalationCard } from "./escalation-card";

interface EscalationsQueueProps {
  errored: boolean;
  liveEscalations: { refetch: () => Promise<unknown> };
  loading: boolean;
  applyChainUpdate: (id: string, update: EscalationChainUpdate) => void;
  queue: readonly Escalation[];
  readOnly: boolean;
}

export function EscalationsQueue({
  errored,
  liveEscalations,
  loading,
  applyChainUpdate,
  queue,
  readOnly,
}: EscalationsQueueProps) {
  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-2">
      {readOnly ? (
        <ConnectCta className="lg:col-span-2 border border-dashed border-[var(--wl-line)] p-12 text-center" />
      ) : loading ? (
        [0, 1].map((card) => (
          <div
            key={card}
            className="border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] p-5 md:p-7"
          >
            <div className="h-4 w-40 animate-pulse rounded bg-[var(--wl-line-soft)]" />
            <div className="mt-6 h-8 w-3/4 animate-pulse rounded bg-[var(--wl-line-soft)]" />
            <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-[var(--wl-line-soft)]" />
            <div className="mt-8 h-10 w-full animate-pulse rounded bg-[var(--wl-line-soft)]" />
          </div>
        ))
      ) : errored ? (
        <div className="lg:col-span-2 border border-dashed border-[var(--wl-line)] p-12 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
            ESCALATION QUERY FAILED
          </p>
          <button
            type="button"
            onClick={() => void liveEscalations.refetch()}
            className="mt-3 font-mono text-[10px] tracking-[.12em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
          >
            RETRY
          </button>
        </div>
      ) : queue.length === 0 ? (
        <div className="lg:col-span-2 border border-dashed border-[var(--wl-line)] p-12 text-center font-mono text-[10px] tracking-[.14em] text-[var(--wl-secondary)]">
          QUEUE CLEAR · NO PENDING ESCALATIONS
        </div>
      ) : (
        queue.map((item, index) => (
          <EscalationCard
            key={item.id}
            item={item}
            index={index}
            cardId={`escalation-${item.id}`}
            onChainUpdate={(update) => applyChainUpdate(item.id, update)}
          />
        ))
      )}
    </div>
  );
}
