import { Arrow } from "@/components/arcanum/arrow";
import { Reveal } from "@/components/arcanum/reveal";
import { StatusPill } from "@/components/arcanum/status-pill";
import { ConnectCta } from "@/components/warm/ConnectCta";
import { formatUsdCompact } from "@/lib/format";
import type { GovernanceEvent } from "@/lib/types";
import Link from "next/link";
import type { CSSProperties } from "react";
import type { DashboardController } from "../_hooks/use-dashboard-controller";

function StreamRow({ event, index }: { event: GovernanceEvent; index: number }) {
  // Every row opens its full movement in the ledger: the compact stream hides
  // detail, so the row itself is the way in.
  return (
    <Link
      href={`/ledger?focus=${encodeURIComponent(event.counterparty)}`}
      style={{ "--i": index } as CSSProperties}
      className="stream-row grid min-w-0 gap-3 border-b border-[var(--wl-line-soft)] px-3 py-4 transition-colors hover:bg-[var(--wl-bg-soft)] md:grid-cols-[.8fr_1.15fr_1.25fr_1fr_.8fr_.85fr] md:items-center"
    >
      <div className="flex justify-between md:block">
        <span className="font-mono text-[10px] tabular-nums text-[var(--wl-secondary)]">
          {event.timestamp}
        </span>
        <span className="md:hidden">
          <StatusPill status={event.status} tone={event.status} />
        </span>
      </div>
      <span className="truncate text-[12px] font-medium">{event.label}</span>
      <span className="truncate text-[12px] text-[var(--wl-body)]">{event.actor}</span>
      <span className="truncate font-mono text-[11px] text-[var(--wl-body)]">
        {event.counterparty}
      </span>
      <span className="font-mono text-[12px] tabular-nums">
        {event.amount > 0 ? formatUsdCompact(event.amount) : "-"}
      </span>
      <span className="hidden md:block">
        <StatusPill status={event.status} tone={event.status} />
      </span>
    </Link>
  );
}

export function DashboardEventStream({
  readOnly,
  events,
}: Pick<DashboardController, "readOnly" | "events">) {
  const streamEvents = events.data;
  return (
    <Reveal index={2}>
      <div className="flex items-end justify-between border-b border-[var(--wl-line)] pb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.17em] text-[var(--wl-signal)]">
            LIVE / {String(streamEvents.length).padStart(2, "0")} EVENTS
          </p>
          <h2 className="font-display mt-2 text-[22px] font-medium tracking-[-.015em]">
            Governed event stream
          </h2>
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-mute)]">
          UTC · live record
        </span>
      </div>
      <div className="hidden grid-cols-[.8fr_1.15fr_1.25fr_1fr_.8fr_.85fr] gap-3 border-b border-[var(--wl-line)] px-3 py-3 font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-mute)] md:grid">
        <span>Time</span>
        <span>Event</span>
        <span>Actor</span>
        <span>Reference</span>
        <span>Amount</span>
        <span>Status</span>
      </div>
      <div className="divide-y divide-[var(--wl-line-soft)]">
        {readOnly ? (
          <ConnectCta />
        ) : events.isLoading ? (
          ["first", "second", "third", "fourth", "fifth"].map((row) => (
            <div key={row} className="px-3 py-4">
              <div className="h-4 w-full animate-pulse rounded bg-[var(--wl-bg-soft)]" />
            </div>
          ))
        ) : events.isError ? (
          <div className="px-6 py-16 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
              RECORD UNAVAILABLE
            </p>
            <p className="mt-3 text-[13px] text-[var(--wl-secondary2)]">
              The governed event stream could not be loaded.
            </p>
          </div>
        ) : streamEvents.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
              NO ACTIVITY YET
            </p>
            <p className="mt-3 text-[13px] text-[var(--wl-secondary2)]">
              Policy updates, agent payments, and escalations will appear here once your governed
              wallet is active.
            </p>
          </div>
        ) : (
          streamEvents.map((event, i) => <StreamRow key={event.id} event={event} index={i} />)
        )}
      </div>
      <Link
        href="/ledger"
        className="group mt-5 inline-flex font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-body)] hover:text-[var(--wl-signal)]"
      >
        Open full ledger <Arrow />
      </Link>
    </Reveal>
  );
}
