import type { CSSProperties } from "react";

import { statusGuideParagraphs } from "../_lib/status-content";

export function StatusGuide({
  checkedAt,
  refreshError,
}: {
  checkedAt: string;
  refreshError: string | null;
}) {
  return (
    <section
      className="warm-reveal is-visible mt-8 grid gap-12 border border-[var(--wl-line)] bg-[var(--wl-bg-soft)] p-8 md:grid-cols-[1fr_280px] md:p-10"
      style={{ "--i": 5 } as CSSProperties}
    >
      <div className="max-w-[700px]">
        <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
          STATUS / HOW TO READ THIS
        </p>
        {statusGuideParagraphs.map((paragraph, index) => (
          <p
            key={paragraph}
            className={`${index === 0 ? "mt-8" : "mt-5"} text-[16px] leading-[1.5] text-[var(--wl-body)]`}
          >
            {paragraph}
          </p>
        ))}
      </div>
      <div className="flex flex-col justify-between border-l border-[var(--wl-line)] pl-6 max-md:border-l-0 max-md:border-t max-md:pl-0 max-md:pt-6">
        <span className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-mute)]">
          LAST CHECKED
        </span>
        <span className="mt-4 font-mono text-[12px] tabular-nums text-[var(--wl-ink)]">
          {checkedAt}
        </span>
        {refreshError && (
          <p role="alert" className="mt-3 text-[11px] leading-[1.45] text-[var(--wl-signal)]">
            {refreshError}
          </p>
        )}
        <span className="mt-8 text-[11px] leading-[1.45] text-[var(--wl-secondary)]">
          {refreshError
            ? "The timestamp above is the last successful result; this failed refresh is not treated as fresh."
            : "All read-only checks complete without writing to the ledger."}
        </span>
      </div>
    </section>
  );
}
