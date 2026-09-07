"use client";

import { ARC_NETWORK_BADGE } from "@arcanum/shared";
import type { CSSProperties } from "react";

import { formatUsd } from "@/lib/format/money";

import { useAgentDetailController } from "../_hooks/use-agent-detail-controller";
import { AgentBehavior } from "./agent-behavior";
import { AgentDecisionRecord } from "./agent-decision-record";
import { AgentHeaderSummary } from "./agent-header-summary";
import { AgentWalletFile } from "./agent-wallet-file";

export default function AgentDetailPage() {
  const controller = useAgentDetailController();
  return (
    <main className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]">
      <style>{`
        .detail-in{animation:detailIn 420ms cubic-bezier(.16,1,.3,1) calc(var(--i,0)*75ms) both}@keyframes detailIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
        .decision-row{transition:transform 220ms cubic-bezier(.16,1,.3,1),background-color 220ms ease}.decision-row:hover{transform:translateX(3px);background:var(--wl-bg-soft)}
        .bar{height:5px;background:var(--wl-line-soft)}.bar span{display:block;height:100%;background:var(--wl-ink);transform-origin:left;animation:barIn 700ms cubic-bezier(.16,1,.3,1) both}@keyframes barIn{from{transform:scaleX(0)}to{transform:scaleX(1)}}
        @media(prefers-reduced-motion:reduce){.detail-in,.bar span{animation:none}.decision-row{transition:none}.behavior-bar{transition:none!important;transform:none!important}}
      `}</style>
      <div className="mx-auto max-w-[1400px] px-5 py-9 md:px-8 md:py-10">
        <AgentHeaderSummary controller={controller} />
        <section className="grid gap-10 pt-10 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,.8fr)]">
          <div className="detail-in" style={{ "--i": 3 } as CSSProperties}>
            <AgentBehavior controller={controller} />
            <AgentDecisionRecord controller={controller} />
          </div>
          <AgentWalletFile controller={controller} />
        </section>
        <footer className="mt-14 flex flex-col justify-between gap-2 border-t border-[var(--wl-line)] pt-5 font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-mute)] sm:flex-row">
          <span>
            {controller.agent?.doctrineVersion ?? ARC_NETWORK_BADGE.toLowerCase()} · caps{" "}
            {formatUsd(controller.dailyLimit)} / day
          </span>
          <span>{controller.governedWalletAddress ? "SYNCED" : "INVALID ROUTE"}</span>
        </footer>
      </div>
    </main>
  );
}
