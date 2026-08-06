"use client";

import { useState } from "react";

import { ConnectModal } from "@/components/warm/landing/ConnectModal";

/**
 * The read-only empty state. Anyone browsing without a wallet gets a way to
 * start their own workspace instead of a wall of zeroes or query errors:
 * one clear action, connect a wallet.
 */
export function ConnectCta({ note, className }: Readonly<{ note?: string; className?: string }>) {
  const [open, setOpen] = useState(false);

  return (
    <div className={className ?? "px-6 py-16 text-center"}>
      <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
        READ-ONLY VIEW
      </p>
      <p className="mx-auto mt-3 max-w-[420px] text-[13px] leading-[1.6] text-[var(--wl-secondary2)]">
        {note ?? "Connect a wallet to open your own governed workspace and see it live here."}
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="warm-pill group mt-6 rounded-full bg-[var(--wl-signal)] px-6 py-3 text-[12px] font-semibold text-white"
      >
        Connect wallet
        <span className="ml-1.5 inline-block transition-transform duration-[220ms] group-hover:translate-x-1">
          ↗
        </span>
      </button>
      <ConnectModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
