"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";

import { DeployWalletModal } from "@/components/warm/DeployWalletModal";
import { formatUsd } from "@/lib/format/money";
import { useLiveAgents } from "@/lib/live-data";
import type { Agent, AgentStatus } from "@/lib/types";

type FilterStatus = "ALL" | "ACTIVE" | "FROZEN" | "IDLE";

function statusLabel(agent: Agent): "ACTIVE" | "FROZEN" | "IDLE" {
  if (agent.status === "frozen") {
    return "FROZEN";
  }
  return agent.posture > 0 || agent.dailySpend > 0 ? "ACTIVE" : "IDLE";
}

function Arrow() {
  return (
    <span aria-hidden="true" className="ml-1.5 inline-block transition-transform duration-[220ms] group-hover:translate-x-1">
      →
    </span>
  );
}

function StatusPill({ status }: { status: "ACTIVE" | "FROZEN" | "IDLE" }) {
  const styles = {
    ACTIVE: "bg-[var(--wl-green-tint)] text-[var(--wl-green)]",
    FROZEN: "bg-[var(--wl-ink)] text-[var(--wl-bg)]",
    IDLE: "border border-[var(--wl-line)] text-[var(--wl-secondary)]",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.12em] ${styles[status]}`}>
      {status}
    </span>
  );
}

export default function AgentsPage() {
  const agentsQuery = useLiveAgents();
  const agents = agentsQuery.data;
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deployOpen, setDeployOpen] = useState(false);

  const visibleAgents = useMemo(
    () =>
      agents.filter((agent) => {
        const matchesFilter = filter === "ALL" || statusLabel(agent) === filter;
        const matchesQuery = agent.name.toLowerCase().includes(query.toLowerCase());
        return matchesFilter && matchesQuery;
      }),
    [agents, filter, query],
  );

  const selectedAgent =
    agents.find((agent) => agent.id === selectedId) ?? visibleAgents[0] ?? agents[0] ?? null;
  const selectedStatus = selectedAgent ? statusLabel(selectedAgent) : "IDLE";

  const totalCount = agents.length;
  const activeCount = agents.filter((agent) => statusLabel(agent) === "ACTIVE").length;
  const frozenCount = agents.filter((agent) => statusLabel(agent) === "FROZEN").length;
  const idleCount = agents.filter((agent) => statusLabel(agent) === "IDLE").length;

  return (
    <main
      className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]"

    >
      <style>{`
        .agents-reveal{animation:agentsIn 420ms cubic-bezier(.16,1,.3,1) calc(var(--i,0) * 90ms) both}@keyframes agentsIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .agent-row{transition:transform 220ms cubic-bezier(.16,1,.3,1),background-color 220ms ease}.agent-row:hover{transform:translateX(3px);background:var(--wl-bg-soft)}.meter{height:4px;background:var(--wl-line-soft)}.meter>span{display:block;height:100%;background:var(--wl-ink);transform-origin:left;transition:transform 420ms cubic-bezier(.16,1,.3,1)}
        @media (prefers-reduced-motion:reduce){.agents-reveal,.agent-row{animation:none;transition:none}}
      `}</style>
      <div id="top" className="mx-auto max-w-[1400px] px-5 py-9 md:px-8 md:py-10">
        <div
          className="agents-reveal flex flex-col justify-between gap-7 border-b border-[var(--wl-line)] pb-9 md:flex-row md:items-end"
          style={{ "--i": 0 } as CSSProperties}
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
              FLEET / REGISTRY
            </p>
            <h1 className="mt-4 text-[clamp(3rem,6vw,5.5rem)] font-semibold leading-[.86] tracking-[-.045em]">
              Agents
            </h1>
            <p className="mt-5 max-w-[440px] text-[14px] leading-[1.45] text-[var(--wl-secondary2)]">
              The wallets that act for your organization, each with a doctrine, a limit, and a
              legible trail.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setDeployOpen(true)}
            className="warm-pill group w-fit rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[11px] font-semibold text-white"
          >
            Deploy governed wallet
            <Arrow />
          </button>
        </div>

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

        <section className="flex flex-col justify-between gap-4 py-7 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">
            {(["ALL", "ACTIVE", "FROZEN", "IDLE"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`rounded-full px-3.5 py-2 font-mono text-[9px] uppercase tracking-[.14em] transition-colors ${
                  filter === item
                    ? "bg-[var(--wl-ink)] text-[var(--wl-bg)]"
                    : "border border-[var(--wl-line)] text-[var(--wl-secondary)] hover:border-[var(--wl-ink)] hover:text-[var(--wl-ink)]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 rounded-full border border-[var(--wl-line)] px-4 py-2.5 text-[var(--wl-secondary)] focus-within:border-[var(--wl-ink)]">
            <span className="font-mono text-[10px]">⌕</span>
            <input
              aria-label="Search agents"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search agents"
              className="w-[170px] bg-transparent text-[12px] outline-none placeholder:text-[var(--wl-mute)]"
            />
          </label>
        </section>

        <section className="grid gap-10 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,.75fr)]">
          <div className="agents-reveal" style={{ "--i": 2 } as CSSProperties}>
            <div className="flex items-end justify-between border-b border-[var(--wl-line)] pb-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[.17em] text-[var(--wl-signal)]">
                  REGISTRY / {visibleAgents.length.toString().padStart(2, "0")}
                </p>
                <h2 className="mt-2 text-[22px] font-medium tracking-[-.045em]">Agent register</h2>
              </div>
              <span className="hidden font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-mute)] md:inline">
                arc testnet
              </span>
            </div>
            <div className="hidden grid-cols-[.9fr_1.35fr_1fr_1fr_1.1fr_1.3fr] gap-3 border-b border-[var(--wl-line)] px-3 py-3 font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-mute)] md:grid">
              <span>Status</span>
              <span>Agent</span>
              <span>Posture</span>
              <span>Daily spend</span>
              <span>Categories</span>
              <span>Doctrine</span>
            </div>

            {agentsQuery.isLoading ? (
              <div className="divide-y divide-[var(--wl-line-soft)]">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="grid animate-pulse gap-3 px-3 py-5 md:grid-cols-[.9fr_1.35fr_1fr_1fr_1.1fr_1.3fr] md:items-center">
                    <div className="h-4 w-16 rounded-full bg-[var(--wl-line-soft)]" />
                    <div className="h-4 w-32 rounded bg-[var(--wl-line-soft)]" />
                    <div className="h-4 w-20 rounded bg-[var(--wl-line-soft)]" />
                    <div className="h-4 w-20 rounded bg-[var(--wl-line-soft)]" />
                    <div className="h-4 w-24 rounded bg-[var(--wl-line-soft)]" />
                    <div className="h-4 w-28 rounded bg-[var(--wl-line-soft)]" />
                  </div>
                ))}
              </div>
            ) : agentsQuery.isError ? (
              <div className="border-b border-[var(--wl-line)] py-16 text-center">
                <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
                  Registry read failed
                </p>
                <button
                  type="button"
                  onClick={() => void agentsQuery.refetch()}
                  className="mt-4 text-[12px] text-[var(--wl-signal)] underline underline-offset-4"
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <div className="divide-y divide-[var(--wl-line-soft)]">
                  {visibleAgents.map((agent, i) => {
                    const status = statusLabel(agent);
                    const postureWidth = Math.max(0, Math.min(100, agent.posture)) / 100;
                    const capWidth =
                      agent.dailyLimit > 0
                        ? Math.min(1, agent.dailySpend / agent.dailyLimit)
                        : 0;
                    return (
                      <button
                        type="button"
                        key={agent.id}
                        onClick={() => setSelectedId(agent.id)}
                        style={{ "--i": i + 3 } as CSSProperties}
                        className={`agent-row agents-reveal grid w-full gap-3 px-3 py-5 text-left md:grid-cols-[.9fr_1.35fr_1fr_1fr_1.1fr_1.3fr] md:items-center ${
                          selectedAgent?.id === agent.id
                            ? "bg-[var(--wl-bg-soft)] shadow-[inset_2px_0_0_var(--wl-signal)]"
                            : ""
                        }`}
                      >
                        <div>
                          <StatusPill status={status} />
                        </div>
                        <div>
                          <p className="text-[13px] font-medium">
                            <Link
                              href={`/agents/${agent.wallet}`}
                              onClick={(event) => event.stopPropagation()}
                              className="transition-colors hover:text-[var(--wl-signal)]"
                            >
                              {agent.name}
                            </Link>
                          </p>
                          <p className="mt-1 font-mono text-[9px] text-[var(--wl-mute)]">
                            {agent.wallet.length > 12
                              ? `${agent.wallet.slice(0, 6)}…${agent.wallet.slice(-4)}`
                              : agent.wallet}
                          </p>
                        </div>
                        <div>
                          <div className="flex items-center justify-between font-mono text-[10px] tabular-nums">
                            <span>{agent.posture}/100</span>
                            <span className="text-[var(--wl-mute)]">posture</span>
                          </div>
                          <div className="meter mt-2 w-full max-w-[90px]">
                            <span style={{ transform: `scaleX(${postureWidth})` }} />
                          </div>
                        </div>
                        <div>
                          <span className="font-mono text-[11px] tabular-nums">
                            {formatUsd(agent.dailySpend)}
                          </span>
                          <span className="mt-1 block font-mono text-[9px] text-[var(--wl-mute)]">
                            of {formatUsd(agent.dailyLimit)}
                          </span>
                          <div className="meter mt-1.5 w-full max-w-[90px]">
                            <span style={{ transform: `scaleX(${capWidth})` }} />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {agent.categories.length > 0 ? (
                            agent.categories.map((category) => (
                              <span
                                key={category}
                                className="rounded-full border border-[var(--wl-line)] px-2 py-1 font-mono text-[8px] uppercase tracking-[.1em] text-[var(--wl-secondary)]"
                              >
                                {category}
                              </span>
                            ))
                          ) : (
                            <span className="font-mono text-[9px] text-[var(--wl-mute)]">—</span>
                          )}
                        </div>
                        <div>
                          <p className="text-[11px] text-[var(--wl-body)]">{agent.mandate}</p>
                          <p className="mt-1 font-mono text-[9px] text-[var(--wl-mute)]">
                            {agent.doctrineVersion}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {visibleAgents.length === 0 && (
                  <div className="border-b border-[var(--wl-line)] py-16 text-center">
                    <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
                      {agents.length === 0
                        ? "No governed wallets yet"
                        : "No agents match this view"}
                    </p>
                    {agents.length === 0 ? (
                      <button
                        type="button"
                        onClick={() => setDeployOpen(true)}
                        className="mt-4 text-[12px] text-[var(--wl-signal)] underline underline-offset-4"
                      >
                        Deploy your first governed wallet
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setFilter("ALL");
                          setQuery("");
                        }}
                        className="mt-4 text-[12px] text-[var(--wl-signal)] underline underline-offset-4"
                      >
                        Clear filters
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <aside className="agents-reveal bg-[var(--wl-bg-soft)] p-6 md:p-7" style={{ "--i": 3 } as CSSProperties}>
            {selectedAgent ? (
              <>
                <div className="flex items-start justify-between border-b border-[var(--wl-line)] pb-5">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[.17em] text-[var(--wl-signal)]">
                      SELECTED WALLET
                    </p>
                    <h2 className="mt-2 text-[22px] font-medium tracking-[-.045em]">
                      {selectedAgent.name}
                    </h2>
                  </div>
                  <StatusPill status={selectedStatus} />
                </div>
                <div className="border-b border-[var(--wl-line)] py-6">
                  <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
                    DOCTRINE SNAPSHOT
                  </p>
                  <p className="mt-3 text-[13px] leading-[1.5] text-[var(--wl-body)]">
                    {selectedAgent.mandate} — {selectedAgent.owner}
                  </p>
                  <p className="mt-4 font-mono text-[9px] text-[var(--wl-mute)]">
                    {selectedAgent.wallet} · USDC
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-y-5 border-b border-[var(--wl-line)] py-6">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
                      DAILY SPEND
                    </p>
                    <p className="mt-2 font-mono text-[13px]">{formatUsd(selectedAgent.dailySpend)}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
                      DAILY CAP
                    </p>
                    <p className="mt-2 font-mono text-[13px]">{formatUsd(selectedAgent.dailyLimit)}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
                      POSTURE
                    </p>
                    <p className="mt-2 font-mono text-[13px]">{selectedAgent.posture} / 100</p>
                  </div>
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
                      NETWORK
                    </p>
                    <p className="mt-2 font-mono text-[13px]">ARC TESTNET</p>
                  </div>
                </div>
                <div className="py-6">
                  <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
                    LAST ACTIVITY
                  </p>
                  <p className="mt-3 text-[12px] text-[var(--wl-body)]">
                    {selectedAgent.lastActivity}
                  </p>
                </div>
                <div className="flex gap-2 border-t border-[var(--wl-line)] pt-5">
                  <Link
                    href={`/agents/${selectedAgent.wallet}`}
                    className="warm-pill warm-pill-ghost rounded-full border border-[var(--wl-line)] px-4 py-2.5 text-[11px] font-semibold"
                  >
                    Open dossier
                  </Link>
                  <Link
                    href={`/agents/${selectedAgent.wallet}/policy`}
                    className="warm-pill group rounded-full bg-[var(--wl-signal)] px-4 py-2.5 text-[11px] font-semibold text-white"
                  >
                    Edit policy
                    <Arrow />
                  </Link>
                </div>
              </>
            ) : (
              <div className="flex min-h-[240px] flex-col items-center justify-center text-center">
                <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
                  No wallet selected
                </p>
                <p className="mt-3 max-w-[240px] text-[12px] text-[var(--wl-body)]">
                  Deploy a governed wallet to begin tracking agent spend under policy.
                </p>
              </div>
            )}
          </aside>
        </section>

        <footer className="mt-14 flex flex-col justify-between gap-4 border-t border-[var(--wl-line)] pt-5 text-[11px] text-[var(--wl-secondary)] sm:flex-row">
          <span className="font-mono uppercase tracking-[.14em]">
            {totalCount} governed wallet{totalCount === 1 ? "" : "s"} · {activeCount} active now
          </span>
          <span>Arc Testnet registry</span>
        </footer>
      </div>

      {deployOpen && <DeployWalletModal onClose={() => setDeployOpen(false)} />}
    </main>
  );
}
