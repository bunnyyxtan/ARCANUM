import { ARC_NETWORK_BADGE } from "@arcanum/shared";
import Link from "next/link";
import type { CSSProperties } from "react";

import { isEvmAddress, shortAddress } from "@/lib/format/address";

import type { PolicyController } from "../_hooks/use-policy-controller";

type DeploymentRecordProps = Pick<
  PolicyController,
  | "address"
  | "deployStatusLabel"
  | "policyDiffs"
  | "policyWalletOwner"
  | "selectedGovernedWalletAddress"
  | "unsavedCount"
> & { routeWalletId: string };

export function DeploymentRecord({
  address,
  deployStatusLabel,
  policyDiffs,
  policyWalletOwner,
  routeWalletId,
  selectedGovernedWalletAddress,
  unsavedCount,
}: DeploymentRecordProps) {
  return (
    <aside
      className="policy-in bg-[var(--wl-bg-soft)] p-6 md:p-7"
      style={{ "--i": 3 } as CSSProperties}
    >
      <div className="flex items-start justify-between border-b border-[var(--wl-line)] pb-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.17em] text-[var(--wl-signal)]">
            SIGNING / CONTROL
          </p>
          <h2 className="font-display mt-2 text-[22px] font-medium tracking-[-.015em]">
            Deployment record
          </h2>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.12em] ${
            deployStatusLabel === "DEPLOYED"
              ? "bg-[var(--wl-green-tint)] text-[var(--wl-green)]"
              : "border border-[var(--wl-signal)] text-[var(--wl-signal)]"
          }`}
        >
          {deployStatusLabel}
        </span>
      </div>
      <dl className="divide-y divide-[var(--wl-line)] py-3 font-mono text-[10px]">
        {(
          [
            [
              "WALLET",
              selectedGovernedWalletAddress ? shortAddress(selectedGovernedWalletAddress) : "-",
            ],
            ["OWNER", policyWalletOwner ? shortAddress(policyWalletOwner) : "-"],
            ["CONNECTED", address ? shortAddress(address) : "not connected"],
            ["NETWORK", ARC_NETWORK_BADGE],
            ["UNSAVED", unsavedCount.toString()],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="grid grid-cols-[.9fr_1.1fr] gap-3 py-3">
            <dt className="text-[var(--wl-mute)]">{label}</dt>
            <dd className="truncate text-right text-[var(--wl-body)]" title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {policyDiffs.length > 0 ? (
        <div className="border-t border-[var(--wl-line)] py-6">
          <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
            PROPOSED CHANGES
          </p>
          <div className="mt-4 space-y-3">
            {policyDiffs.map(([label, before, after]) => (
              <div key={label} className="font-mono text-[10px]">
                <p className="uppercase tracking-[.1em] text-[var(--wl-mute)]">{label}</p>
                <p className="mt-1 text-[var(--wl-body)]">
                  <span className="text-[var(--wl-mute)] line-through">{before}</span>
                  <span className="mx-2">→</span>
                  <span className="text-[var(--wl-signal)]">{after}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="border-t border-[var(--wl-line)] py-6">
        <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
          EFFECT OF SIGNATURE
        </p>
        <p className="mt-3 text-[13px] leading-[1.5] text-[var(--wl-body)]">
          The new limits become authoritative onchain for the next governed event. The dashboard may
          take a moment to reflect them.
        </p>
      </div>
      <div className="border-t border-[var(--wl-line)] pt-5">
        <Link
          href={isEvmAddress(routeWalletId) ? `/agents/${routeWalletId}` : "/agents"}
          className="group font-mono text-[10px] uppercase tracking-[.13em] text-[var(--wl-body)] hover:text-[var(--wl-signal)]"
        >
          Return to dossier
          <span className="ml-2 inline-block transition-transform group-hover:-translate-x-1">
            ←
          </span>
        </Link>
      </div>
    </aside>
  );
}
