"use client";

import { useLedgerController } from "../_hooks/use-ledger-controller";
import { LedgerDetailPanel } from "./ledger-detail-panel";
import { LedgerFilters } from "./ledger-filters";
import { LedgerHeader } from "./ledger-header";
import { LedgerTable } from "./ledger-table";

export function LedgerPageContent() {
  const ledger = useLedgerController();
  return (
    <div className="arc-ledger">
      <style>{`
        .arc-pill{position:relative;isolation:isolate;overflow:hidden;transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 320ms cubic-bezier(.16,1,.3,1),color 220ms ease,border-color 220ms ease}
        .arc-pill:before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:var(--wl-signal-deep);transform:translateY(102%);transition:transform 320ms cubic-bezier(.16,1,.3,1)}
        .arc-pill:hover{transform:translateY(-2px);box-shadow:0 10px 28px -8px rgba(var(--wl-signal-rgb),.42),0 2px 6px rgba(var(--wl-ink-rgb),.08)}.arc-pill:hover:before{transform:translateY(0)}
        .arc-ghost:before{background:var(--wl-ink)}.arc-ghost:hover{color:var(--wl-bg);border-color:var(--wl-ink);box-shadow:0 10px 28px -10px rgba(var(--wl-ink-rgb),.35)}
        .arc-row{animation:arcRowIn 420ms cubic-bezier(.16,1,.3,1) calc(var(--row-i) * 55ms) both;transition:transform 220ms cubic-bezier(.16,1,.3,1),background-color 220ms ease,box-shadow 220ms ease}
        .arc-row:hover{transform:translate3d(3px,-1px,0);background:var(--wl-bg-raised);box-shadow:inset 2px 0 0 var(--wl-signal)}.arc-row-selected{background:var(--wl-bg-soft);box-shadow:inset 2px 0 0 var(--wl-signal)}
        @keyframes arcRowIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .arc-drawer{animation:drawerIn 420ms cubic-bezier(.16,1,.3,1) both}@keyframes drawerIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        .arc-filter{position:relative;isolation:isolate;overflow:hidden;-webkit-tap-highlight-color:transparent;transition:transform 200ms cubic-bezier(.16,1,.3,1),color 200ms ease,border-color 200ms ease,box-shadow 240ms ease}
        .arc-filter:before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:var(--wl-bg-soft);opacity:0;transform:scale(.55);transition:transform 240ms cubic-bezier(.16,1,.3,1),opacity 180ms ease}
        .arc-filter:hover{transform:translateY(-1px)}.arc-filter:hover:before{opacity:1;transform:scale(1)}
        .arc-filter:active{transform:translateY(0) scale(.94);transition-duration:90ms}
        .arc-filter:focus-visible{outline:1px solid var(--wl-signal);outline-offset:2px}
        .arc-filter-on{animation:filterPop 300ms cubic-bezier(.34,1.56,.64,1)}.arc-filter-on:before{display:none}
        .arc-filter-on:hover{box-shadow:0 8px 20px -8px rgba(var(--wl-ink-rgb),.4)}
        .arc-filter-flag.arc-filter-on:hover{box-shadow:0 8px 20px -8px rgba(var(--wl-signal-rgb),.5)}
        @keyframes filterPop{0%{transform:scale(.9)}55%{transform:scale(1.05)}100%{transform:scale(1)}}
        @media (prefers-reduced-motion:reduce){.arc-pill,.arc-row,.arc-drawer,.arc-filter,.arc-filter-on{animation:none!important;transition:none!important}.arc-row:hover,.arc-pill:hover,.arc-filter:hover,.arc-filter:active{transform:none}}
      `}</style>
      <main className="mx-auto max-w-[1400px] px-5 py-8 md:px-8 md:py-10">
        <LedgerHeader ledger={ledger} />
        <LedgerFilters filters={ledger.filters} />
        <div className="mt-7 flex flex-col gap-7 xl:flex-row">
          <LedgerTable ledger={ledger} />
          {ledger.selection.selected && <LedgerDetailPanel ledger={ledger} />}
        </div>
        {ledger.ledgerExport.notice && (
          <div
            role="status"
            className="fixed bottom-[calc(20px+env(safe-area-inset-bottom))] left-1/2 z-20 max-w-[calc(100vw-32px)] -translate-x-1/2 border border-[var(--wl-ink)] bg-[var(--wl-ink)] px-4 py-3 font-mono text-[10px] text-[var(--wl-bg)] shadow-[0_12px_28px_rgba(var(--wl-ink-rgb),.18)] md:bottom-5"
          >
            {ledger.ledgerExport.notice}
          </div>
        )}
      </main>
    </div>
  );
}
