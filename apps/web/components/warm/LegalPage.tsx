import type { ReactNode } from "react";

export type LegalSection = Readonly<{
  number: string;
  heading: string;
  body: ReactNode;
}>;

/**
 * The shared shell for the privacy and terms pages. Both are read by people
 * deciding whether to trust ARCANUM with a wallet, so they are plain prose in
 * the same voice as the rest of the product rather than pasted boilerplate.
 */
export function LegalPage({
  kicker,
  title,
  lede,
  updated,
  sections,
}: Readonly<{
  kicker: string;
  title: string;
  lede: string;
  updated: string;
  sections: readonly LegalSection[];
}>) {
  return (
    <main className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]">
      <div className="mx-auto max-w-[1400px] px-5 py-14 md:px-8 md:py-20">
        <header className="max-w-[720px]">
          <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[var(--wl-signal)]">
            {kicker}
          </p>
          <h1 className="font-display mt-5 text-[clamp(2.8rem,6vw,5rem)] font-semibold leading-[.88] tracking-[-.015em]">
            {title}
          </h1>
          <p className="mt-7 text-[16px] leading-[1.6] text-[var(--wl-secondary2)]">{lede}</p>
          <p className="mt-7 font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-mute)]">
            LAST UPDATED {updated} · ARC TESTNET DEPLOYMENT
          </p>
        </header>

        <div className="mt-16 border-t border-[var(--wl-line)]">
          {sections.map((section) => (
            <section
              key={section.number}
              className="grid grid-cols-[80px_1fr] gap-6 border-b border-[var(--wl-line-soft)] py-10 md:grid-cols-[140px_1fr] md:gap-12"
            >
              <div>
                <p className="font-mono text-[10px] tabular-nums tracking-[.14em] text-[var(--wl-mute)]">
                  {section.number}
                </p>
              </div>
              <div className="max-w-[720px]">
                <h2 className="font-display text-[24px] font-semibold tracking-[-.015em] md:text-[28px]">
                  {section.heading}
                </h2>
                <div className="legal-body mt-5 space-y-4 text-[14px] leading-[1.65] text-[var(--wl-body)]">
                  {section.body}
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
