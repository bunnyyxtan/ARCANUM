import type { CSSProperties } from "react";

import type { AgentsController } from "../_hooks/use-agents-controller";
import { Arrow } from "./agent-ui";

type AgentsHeaderProps = Pick<AgentsController, "openDeploy">;

export function AgentsHeader({ openDeploy }: AgentsHeaderProps) {
  return (
    <div
      className="agents-reveal flex flex-col justify-between gap-7 border-b border-[var(--wl-line)] pb-9 md:flex-row md:items-end"
      style={{ "--i": 0 } as CSSProperties}
    >
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
          FLEET / REGISTRY
        </p>
        <h1 className="font-display mt-4 text-[clamp(3rem,6vw,5.5rem)] font-semibold leading-[.86] tracking-[-.015em]">
          Agents
        </h1>
        <p className="mt-5 max-w-[440px] text-[14px] leading-[1.45] text-[var(--wl-secondary2)]">
          The wallets that act for your organization, each with a doctrine, a limit, and a legible
          trail.
        </p>
      </div>
      <button
        type="button"
        onClick={openDeploy}
        className="warm-pill group w-fit rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[11px] font-semibold text-white"
      >
        Deploy governed wallet
        <Arrow />
      </button>
    </div>
  );
}

type AgentsSummaryProps = Pick<
  AgentsController,
  "totalCount" | "activeCount" | "frozenCount" | "idleCount"
>;

export function AgentsSummary({
  totalCount,
  activeCount,
  frozenCount,
  idleCount,
}: AgentsSummaryProps) {
  return (
    <section className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-[var(--wl-line)] py-5 font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
      <span>
        TOTAL <b className="font-normal text-[var(--wl-ink)]">{totalCount}</b>
      </span>
      <span className="h-4 w-px bg-[var(--wl-line)]" />
      <span>
        ACTIVE <b className="font-normal text-[var(--wl-ink)]">{activeCount}</b>
      </span>
      <span className="h-4 w-px bg-[var(--wl-line)]" />
      <span>
        UNDER RESTRAINT <b className="font-normal text-[var(--wl-signal)]">{frozenCount}</b>
      </span>
      <span className="h-4 w-px bg-[var(--wl-line)]" />
      <span>
        IDLE <b className="font-normal text-[var(--wl-ink)]">{idleCount}</b>
      </span>
    </section>
  );
}
