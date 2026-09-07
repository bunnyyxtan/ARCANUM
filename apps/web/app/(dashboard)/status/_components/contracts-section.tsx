import type { CSSProperties } from "react";

import { getArcscanAddressUrl } from "@/lib/arcscan";
import { deployedContracts } from "@/lib/contracts";
import { shortAddress } from "@/lib/format/address";

export function ContractsSection() {
  return (
    <section
      className="warm-reveal is-visible mt-16 border border-[var(--wl-line)] bg-[var(--wl-bg-soft)] p-8 md:p-10"
      style={{ "--i": 4 } as CSSProperties}
    >
      <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
        DEPLOYMENT / CONTRACT ADDRESSES
      </p>
      <h2 className="font-display mt-6 text-[26px] font-semibold tracking-[-.015em]">
        Deployed contracts.
      </h2>
      <div className="mt-8 divide-y divide-[var(--wl-line)] border-t border-[var(--wl-line)]">
        {deployedContracts.map((contract) => {
          const url = getArcscanAddressUrl(contract.value);
          return (
            <div
              key={contract.label}
              className="grid grid-cols-[1fr_auto] items-center gap-4 py-4 max-sm:grid-cols-1 max-sm:gap-1"
            >
              <span className="font-mono text-[11px] uppercase tracking-[.12em] text-[var(--wl-body)]">
                {contract.label}
              </span>
              {contract.value ? (
                url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="warm-link font-mono text-[11px] tabular-nums text-[var(--wl-ink)] hover:text-[var(--wl-signal)]"
                  >
                    {shortAddress(contract.value)}
                  </a>
                ) : (
                  <span className="font-mono text-[11px] tabular-nums text-[var(--wl-ink)]">
                    {shortAddress(contract.value)}
                  </span>
                )
              ) : (
                <span className="font-mono text-[10px] uppercase tracking-[.12em] text-[var(--wl-signal)]">
                  NOT CONFIGURED
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
