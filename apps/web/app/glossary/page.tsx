import Link from "next/link";

import { glossaryEntries } from "@/lib/glossary";

export default function GlossaryPage() {
  return (
    <main className="min-h-screen bg-foundry-grid px-8 py-8 font-mono text-[var(--wl-text-body)]">
      <div className="mx-auto max-w-[1120px]">
        <div className="flex h-12 items-center justify-between border-b border-[var(--wl-hairline)]">
          <Link
            href="/dashboard"
            className="font-cond text-[18px] font-bold tracking-[0.18em] text-[var(--wl-text-primary)]"
          >
            ARCANUM
          </Link>
          <span className="text-[10px] tracking-[0.18em] text-[var(--wl-text-muted)]">
            FOUNDRY VOCABULARY
          </span>
        </div>
        <h1 className="mt-8 font-cond text-[44px] font-bold leading-none tracking-[0.04em] text-[var(--wl-text-primary)]">
          GLOSSARY
        </h1>
        <div className="mt-6 grid grid-cols-2 gap-px border border-[var(--wl-hairline)] bg-[var(--wl-hairline)]">
          {glossaryEntries.map(([term, definition]) => (
            <article key={term} className="bg-[var(--wl-panel)] p-5">
              <h2 className="font-cond text-[22px] font-semibold tracking-[0.08em] text-[var(--wl-signal)]">
                {term}
              </h2>
              <p className="mt-2 font-mono text-[12px] leading-relaxed text-[var(--wl-text-body)]">
                {definition}
              </p>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
