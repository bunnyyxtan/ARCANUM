import { formatUsd } from "@/lib/format/money";
import type { Escalation } from "@/lib/types";

import { formatFooterTimestamp } from "../_lib/helpers";

export function ResolvedEscalations({ items }: Readonly<{ items: readonly Escalation[] }>) {
  if (items.length === 0) return null;
  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between border-b border-[var(--wl-line)] pb-4">
        <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-mute)]">
          RESOLVED / THE FINAL WORD
        </p>
        <p className="font-mono text-[10px] tracking-[.12em] text-[var(--wl-mute)]">
          {items.length} DECIDED
        </p>
      </div>
      <ul>
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-2 border-b border-[var(--wl-line-soft)] py-4 md:flex-row md:items-center md:justify-between"
          >
            <div className="flex min-w-0 items-center gap-4">
              <span
                className={`inline-block w-[86px] shrink-0 border px-2 py-1 text-center font-mono text-[9px] tracking-[.12em] ${
                  item.status === "EXECUTED"
                    ? "border-[var(--wl-green)] text-[var(--wl-green)]"
                    : item.status === "REJECTED"
                      ? "border-[var(--wl-signal)] text-[var(--wl-signal)]"
                      : "border-[var(--wl-line-bold)] text-[var(--wl-mute)]"
                }`}
              >
                {item.status === "EXECUTED"
                  ? "APPROVED"
                  : item.status === "REJECTED"
                    ? "REJECTED"
                    : "EXPIRED"}
              </span>
              <span className="truncate text-[13px]">
                {formatUsd(item.amount)} <span className="text-[var(--wl-mute)]">→</span>{" "}
                {item.counterparty}
              </span>
            </div>
            <div className="flex items-baseline gap-5 pl-[102px] md:pl-0">
              <span className="line-clamp-2 max-w-[360px] text-[11px] leading-[1.4] text-[var(--wl-secondary2)] lg:truncate">
                {item.reason}
              </span>
              <span className="shrink-0 font-mono text-[9px] tracking-[.12em] text-[var(--wl-mute)]">
                {formatFooterTimestamp(item.createdAt)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
