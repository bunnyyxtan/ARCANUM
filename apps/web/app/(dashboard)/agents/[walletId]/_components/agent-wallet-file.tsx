import { ARC_NETWORK_BADGE } from "@arcanum/shared";
import Link from "next/link";
import type { CSSProperties } from "react";

import { shortAddress } from "@/lib/format/address";
import { formatUsd } from "@/lib/format/money";

import { StatusPill } from "@/components/arcanum/status-pill";
import type { AgentDetailController } from "../_hooks/use-agent-detail-controller";
import { AgentSignerPanel } from "./agent-signer-panel";

export function AgentWalletFile({ controller }: { controller: AgentDetailController }) {
  const { agent, behavior, capWidth, dailyLimit, dailySpend, frozen, governedWalletAddress } =
    controller;
  return (
    <aside
      className="detail-in bg-[var(--wl-bg-soft)] p-6 md:p-7"
      style={{ "--i": 4 } as CSSProperties}
    >
      <div className="flex items-start justify-between border-b border-[var(--wl-line)] pb-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.17em] text-[var(--wl-signal)]">
            IDENTITY / CONTROL
          </p>
          <h2 className="font-display mt-2 text-[22px] font-medium tracking-[-.015em]">
            Wallet file
          </h2>
        </div>
        <StatusPill status={frozen ? "FROZEN" : "ACTIVE"} tone={frozen ? "frozen" : "active"} />
      </div>
      <dl className="divide-y divide-[var(--wl-line)] font-mono text-[10px]">
        {(
          [
            ["WALLET", governedWalletAddress ? shortAddress(governedWalletAddress) : "invalid"],
            ["NETWORK", ARC_NETWORK_BADGE],
            ["ASSET", "USDC"],
            ["POLICY", agent?.doctrineVersion ?? "-"],
            ["MANDATE", agent?.mandate ?? "-"],
            ["OWNER", agent?.owner ?? "-"],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="grid grid-cols-[.9fr_1.1fr] gap-3 py-3 max-sm:grid-cols-1 max-sm:gap-1"
          >
            <dt className="text-[var(--wl-mute)]">{label}</dt>
            <dd
              className="min-w-0 break-all text-right text-[var(--wl-body)] max-sm:text-left"
              title={value}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <div className="border-b border-[var(--wl-line)] py-6">
        <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
          CAPACITY USED
        </p>
        <div className="mt-4 flex justify-between font-mono text-[11px]">
          <span>{formatUsd(dailySpend)}</span>
          <span className="text-[var(--wl-mute)]">{formatUsd(dailyLimit)}</span>
        </div>
        <div className="bar mt-3">
          <span style={{ transform: `scaleX(${capWidth})` }} />
        </div>
      </div>
      <div className="border-b border-[var(--wl-line)] py-6">
        <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
          AUTHORIZED VENDORS
        </p>
        {behavior.authorizedVendors.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {behavior.authorizedVendors.map((vendor) => (
              <span
                key={vendor}
                className="rounded-full border border-[var(--wl-line-bold)] px-2.5 py-1.5 font-mono text-[9px] text-[var(--wl-body)]"
              >
                {vendor}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 font-mono text-[9px] text-[var(--wl-mute)]">
            No settled counterparties recorded yet.
          </p>
        )}
      </div>
      <AgentSignerPanel governedWalletAddress={governedWalletAddress} />
      <div className="flex flex-wrap gap-2">
        <Link
          href={governedWalletAddress ? `/badge/${governedWalletAddress}` : "#"}
          className="warm-pill warm-pill-ghost rounded-full border border-[var(--wl-line)] px-3.5 py-2.5 text-[10px] font-semibold"
        >
          Public badge
        </Link>
        <Link
          href={governedWalletAddress ? `/explorer/${governedWalletAddress}` : "#"}
          className="warm-pill warm-pill-ghost rounded-full border border-[var(--wl-line)] px-3.5 py-2.5 text-[10px] font-semibold"
        >
          Public explorer ↗
        </Link>
      </div>
    </aside>
  );
}
