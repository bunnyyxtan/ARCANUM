"use client";

import { useEffect, useRef, useState } from "react";

import { EmberMark } from "@/components/warm/EmberMark";
import { ThemeToggle } from "@/components/warm/ThemeToggle";
import { ConnectModal } from "@/components/warm/landing/ConnectModal";
import {
  Arrow,
  BookIcon,
  GitHubMark,
  LedgerRows,
  MagneticAnchor,
  Reveal,
  SectionNumber,
  XMark,
} from "@/components/warm/landing/primitives";

const GITHUB_URL = "https://github.com/bunnyyxtan/ARCANUM";

type GlobalStats = {
  capitalGovernedUsdc: number;
};

function formatUsd(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}k`;
  return `$${Math.round(value)}`;
}

export default function LandingPage() {
  const [connectOpen, setConnectOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ids = ["governed", "policies", "record", "contact"];
    const sections = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) setActiveSection(visible.target.id);
      },
      { threshold: [0.2, 0.45, 0.7], rootMargin: "-12% 0px -45% 0px" },
    );
    for (const section of sections) observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Real global numbers from the read model: every workspace, every governed
    // decision. No simulated counters on the landing page.
    let cancelled = false;
    fetch("/api/public-stats")
      .then((response) => (response.ok ? response.json() : null))
      .then((stats: GlobalStats | null) => {
        if (!cancelled && stats && typeof stats.capitalGovernedUsdc === "number") {
          setGlobalStats(stats);
        }
      })
      .catch(() => {
        // Leave the placeholder in place; the record panel stays honest.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        if (gridRef.current) {
          gridRef.current.style.transform = `translate3d(0, ${Math.min(window.scrollY * 0.045, 28)}px, 0)`;
        }
        frame = 0;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const link = rail.querySelector<HTMLAnchorElement>(`a[href="#${activeSection}"]`);
    if (link) {
      rail.style.setProperty("--dot-y", `${link.offsetTop + (link.offsetHeight - 9) / 2}px`);
      rail.style.setProperty("--dot-o", "1");
    } else {
      rail.style.setProperty("--dot-o", "0");
    }
  }, [activeSection]);

  const openConnect = () => setConnectOpen(true);

  return (
    <main className="min-h-[100dvh] overflow-hidden bg-[var(--wl-bg)] text-[var(--wl-ink)]">
      <aside className="fixed bottom-0 left-0 top-0 z-20 hidden w-[86px] flex-col items-center justify-between border-r border-[var(--wl-line)] bg-[var(--wl-bg)] py-7 lg:flex">
        <MagneticAnchor
          href="#"
          className="flex flex-col items-center gap-2.5"
          aria-label="ARCANUM"
        >
          <EmberMark size={28} />
          <span className="font-display text-[12px] font-bold tracking-[-.01em]">ARCANUM</span>
        </MagneticAnchor>
        <div
          className="font-mono text-[10px] font-bold tracking-[.2em] text-[var(--wl-body)]"
          style={{ writingMode: "vertical-rl" }}
        >
          BUILT ON ARC
        </div>
        <div
          ref={railRef}
          className="relative flex flex-col items-center gap-6 font-mono text-[9px] text-[var(--wl-secondary)]"
        >
          <span className="warm-active-dot" aria-hidden="true" />
          <MagneticAnchor href="#governed" className="warm-nav-dot">
            01
          </MagneticAnchor>
          <MagneticAnchor href="#policies" className="warm-nav-dot">
            02
          </MagneticAnchor>
          <MagneticAnchor href="#record" className="warm-nav-dot">
            03
          </MagneticAnchor>
          <MagneticAnchor href="#contact" className="warm-nav-dot">
            04
          </MagneticAnchor>
        </div>
      </aside>

      <div className="lg:pl-[86px]">
        <nav className="flex items-center justify-between border-b border-[var(--wl-line)] px-6 py-5 lg:hidden">
          <MagneticAnchor
            href="#"
            className="font-display flex items-center gap-2 text-[18px] font-bold tracking-[-.015em]"
          >
            <EmberMark size={24} />
            ARCANUM
          </MagneticAnchor>
          <button
            type="button"
            onClick={openConnect}
            className="warm-pill warm-interaction group rounded-full bg-[var(--wl-signal)] px-5 py-2.5 text-[11px] font-semibold text-white"
          >
            Launch Dashboard
            <Arrow />
          </button>
        </nav>
        <div className="hidden h-[68px] items-center justify-between border-b border-[var(--wl-line)] pl-10 pr-6 lg:flex">
          <span className="text-[13px] font-medium tracking-[-.01em] text-[var(--wl-body)]">
            Governed wallets for AI agents
            <span className="text-[var(--wl-mute)]"> · USDC on Arc</span>
          </span>
          <div className="flex items-center">
            <MagneticAnchor
              href="/docs"
              className="warm-link mx-4 inline-flex items-center gap-2 text-[13px] font-medium tracking-[-.01em] text-[var(--wl-body)] transition-colors hover:text-[var(--wl-ink)]"
            >
              <BookIcon className="h-[15px] w-[15px] text-[var(--wl-mute)]" />
              Read Docs
            </MagneticAnchor>
            <MagneticAnchor
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="warm-link mx-4 inline-flex items-center gap-2 text-[13px] font-medium tracking-[-.01em] text-[var(--wl-body)] transition-colors hover:text-[var(--wl-ink)]"
            >
              <GitHubMark className="h-[15px] w-[15px] text-[var(--wl-mute)]" />
              GitHub
            </MagneticAnchor>
            <span className="mx-4 h-5 w-px bg-[var(--wl-line)]" aria-hidden="true" />
            <ThemeToggle className="mx-1 flex h-8 w-8 items-center justify-center text-[var(--wl-body)] transition-colors hover:text-[var(--wl-signal)]" />
            <button
              type="button"
              onClick={openConnect}
              className="warm-pill warm-interaction group ml-2 rounded-full bg-[var(--wl-signal)] px-6 py-2.5 text-[13px] font-semibold tracking-[-.01em] text-white"
            >
              Launch Dashboard
              <Arrow />
            </button>
          </div>
        </div>

        <section
          id="ledger"
          className="relative min-h-[780px] border-b border-[var(--wl-line)] px-6 py-16 lg:px-10 lg:py-20"
        >
          <div
            ref={gridRef}
            className="pointer-events-none absolute inset-0 opacity-60 will-change-transform"
            style={{
              backgroundImage:
                "linear-gradient(var(--wl-line-faint2) 1px, transparent 1px), linear-gradient(90deg, var(--wl-line-faint2) 1px, transparent 1px)",
              backgroundSize: "72px 72px",
              maskImage: "linear-gradient(to bottom, black, transparent 80%)",
            }}
          />
          <div className="relative mx-auto max-w-[1400px]">
            <Reveal>
              <p className="font-mono text-[10px] uppercase tracking-[.22em] text-[var(--wl-signal)]">
                Governed autonomy / Built on Arc
              </p>
            </Reveal>
            <Reveal kind="headline" className="delay-1">
              <h1 className="font-display mt-8 max-w-[880px] text-[clamp(3.4rem,10.5vw,10.5rem)] font-semibold leading-[.8] tracking-[-.015em]">
                Autonomous
                <br />
                <span className="text-[var(--wl-dim)]">spend,</span>{" "}
                <em className="not-italic text-[var(--wl-ink)]">accounted.</em>
              </h1>
            </Reveal>
            <Reveal className="delay-2">
              <div className="mt-12">
                <p className="max-w-[420px] text-[16px] leading-[1.45] text-[var(--wl-body)]">
                  Every dollar is checked, recorded, and visibly governed before it moves.
                </p>
                <div className="mt-7 flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={openConnect}
                    className="warm-pill warm-interaction group rounded-full bg-[var(--wl-signal)] px-6 py-3.5 text-[12px] font-semibold text-white"
                  >
                    Launch Dashboard
                    <Arrow />
                  </button>
                  <MagneticAnchor
                    href="/docs"
                    className="warm-pill warm-pill-ghost inline-flex items-center gap-2 rounded-full border border-[var(--wl-line)] px-6 py-3.5 text-[12px] font-semibold text-[var(--wl-ink)]"
                  >
                    <BookIcon />
                    Read Docs
                  </MagneticAnchor>
                  <MagneticAnchor
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="warm-link inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.12em] text-[var(--wl-secondary)] transition-colors hover:text-[var(--wl-ink)]"
                  >
                    <GitHubMark />
                    GitHub ↗
                  </MagneticAnchor>
                </div>
              </div>
            </Reveal>
            <div className="relative mt-20 lg:mt-24 lg:ml-[15%]">
              <Reveal className="delay-3">
                <LedgerRows />
              </Reveal>
              <div className="absolute bottom-full right-0 mb-5 hidden w-[200px] border-l border-[var(--wl-signal)] pl-4 text-[10px] leading-[1.4] text-[var(--wl-signal)] lg:block">
                THE LIVE RECORD
                <br />
                <span className="text-[var(--wl-secondary)]">
                  Not a demo. A transaction deciding itself in public.
                </span>
                <strong className="mt-4 block font-mono text-[20px] font-medium tabular-nums text-[var(--wl-ink)]">
                  {globalStats ? formatUsd(globalStats.capitalGovernedUsdc) : "$ · · ·"}
                </strong>
                <span className="block font-mono text-[8px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
                  capital governed
                </span>
              </div>
            </div>
          </div>
        </section>

        <section
          id="governed"
          className="border-b border-[var(--wl-line)] bg-[var(--wl-bg-soft)] px-6 py-24 lg:px-10 lg:py-32"
        >
          <div className="mx-auto grid max-w-[1400px] gap-16 lg:grid-cols-[240px_1fr]">
            <Reveal>
              <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
                01 / The control loop
              </p>
              <SectionNumber
                value="1"
                className="mt-28 hidden font-mono text-[80px] leading-none tracking-[-.045em] text-[var(--wl-line-strong)] lg:block"
              />
            </Reveal>
            <Reveal className="delay-1">
              <h2 className="font-display max-w-[700px] text-[clamp(3rem,6vw,6.2rem)] font-semibold leading-[.84] tracking-[-.015em]">
                A dollar earns
                <br />
                its way through.
              </h2>
              <div className="mt-20 grid border-t border-[var(--wl-faint)] md:grid-cols-3">
                {[
                  ["01", "Policy check", "Caps, vendors, destinations. Evaluated in 42ms."],
                  ["02", "Allow or block", "The wallet moves only when the policy says so."],
                  ["03", "Escalate to human", "Unusual spend pauses. You decide, not the model."],
                ].map(([n, t, d]) => (
                  <div
                    key={n}
                    className="border-b border-[var(--wl-faint)] py-7 md:border-b-0 md:border-r md:px-8 md:pt-8 md:first:pl-0 md:last:border-r-0 md:last:pr-0"
                  >
                    <span className="font-mono text-[10px] text-[var(--wl-signal)]">{n}</span>
                    <h3 className="mt-14 text-[21px] font-medium tracking-[-.04em]">{t}</h3>
                    <p className="mt-3 max-w-[190px] text-[12px] leading-[1.45] text-[var(--wl-secondary2)]">
                      {d}
                    </p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section
          id="policies"
          className="border-b border-[var(--wl-line)] px-6 py-28 lg:px-10 lg:py-36"
        >
          <div className="mx-auto max-w-[1400px]">
            <Reveal>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
                    02 / Policy surface
                  </p>
                  <h2 className="font-display mt-7 text-[clamp(3rem,6vw,6rem)] font-semibold leading-[.84] tracking-[-.015em]">
                    The rulebook,
                    <br />
                    <span className="text-[var(--wl-dim)]">made executable.</span>
                  </h2>
                </div>
                <SectionNumber
                  value="2"
                  className="hidden font-mono text-[80px] leading-none tracking-[-.045em] text-[var(--wl-line-soft)] lg:block"
                />
              </div>
            </Reveal>
            <Reveal className="delay-1">
              <div className="warm-policy-doc relative mt-24 max-w-[930px] border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] p-7 shadow-[14px_18px_0_var(--wl-bg-deep2)] lg:ml-[12%] lg:p-12">
                <div className="flex justify-between border-b border-[var(--wl-line)] pb-5 font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-mute)]">
                  <span>POLICY / PROCUREMENT-BOT</span>
                  <span>v4.18 · ACTIVE</span>
                </div>
                <div className="mt-10 grid gap-9 font-mono text-[12px] leading-[1.8] md:grid-cols-[1fr_1fr]">
                  <div>
                    <span className="text-[var(--wl-mute)]">when</span>
                    <br />
                    <span className="text-[var(--wl-signal)]">transaction.vendor</span> in
                    <br />
                    <span className="ml-5">[ AWS, OpenAI ]</span>
                    <br />
                    <span className="text-[var(--wl-signal)]">and amount</span> ≤{" "}
                    <span className="text-[var(--wl-signal)]">$500</span>
                  </div>
                  <div>
                    <span className="text-[var(--wl-mute)]">then</span>
                    <br />
                    <span className="text-[var(--wl-green-bright)]">ALLOW</span> · record to ledger
                    <br />
                    <span className="text-[var(--wl-mute)]">otherwise</span>
                    <br />
                    <span className="text-[var(--wl-signal)]">ESCALATE</span> · ask human operator
                  </div>
                </div>
                <div className="mt-10 flex justify-between border-t border-[var(--wl-line)] pt-5 text-[10px] text-[var(--wl-secondary)]">
                  <span>daily cap $5,000 · USDC only</span>
                  <span className="text-[var(--wl-green-bright)]">✓ signed by operator</span>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section
          id="record"
          className="bg-[var(--wl-ink)] px-6 py-28 text-[var(--wl-bg)] lg:px-10 lg:py-32"
        >
          <div className="mx-auto grid max-w-[1400px] gap-16 lg:grid-cols-[240px_1fr]">
            <Reveal>
              <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
                03 / Trust surface
              </p>
              <SectionNumber
                value="3"
                className="mt-28 hidden font-mono text-[80px] leading-none tracking-[-.045em] text-[var(--wl-strong5)] lg:block"
              />
            </Reveal>
            <Reveal className="delay-1">
              <div className="flex flex-col justify-between gap-10 md:flex-row md:items-end">
                <h2 className="font-display max-w-[680px] text-[clamp(3rem,6vw,6rem)] font-semibold leading-[.84] tracking-[-.015em]">
                  Nothing moves
                  <br />
                  <span className="text-[var(--wl-dim2)]">in the dark.</span>
                </h2>
                <p className="max-w-[240px] text-[12px] leading-[1.5] text-[var(--wl-muted2)]">
                  A quiet, immutable record of what your agents tried, what policy decided, and who
                  stepped in.
                </p>
              </div>
              <div className="mt-16">
                <LedgerRows dark />
              </div>
            </Reveal>
          </div>
        </section>

        <section id="contact" className="px-6 py-32 lg:px-10 lg:py-44">
          <Reveal>
            <div className="mx-auto max-w-[1400px] border-b border-[var(--wl-line)] pb-24">
              <div className="flex items-start justify-between">
                <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
                  04 / Trust is the product
                </p>
                <SectionNumber
                  value="4"
                  className="hidden font-mono text-[80px] leading-none tracking-[-.045em] text-[var(--wl-line-soft)] lg:block"
                />
              </div>
              <h2 className="font-display mt-8 max-w-[950px] text-[clamp(3rem,9vw,9rem)] font-semibold leading-[.78] tracking-[-.015em]">
                Let agents move.
                <br />
                <span className="text-[var(--wl-dim)]">Keep the final word.</span>
              </h2>
              <div className="mt-14 flex flex-col gap-8 lg:ml-[42%] lg:flex-row lg:items-center">
                <p className="max-w-[290px] text-[15px] leading-[1.5] text-[var(--wl-body)]">
                  Built for finance and engineering teams who need autonomy without giving up the
                  ledger.
                </p>
                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={openConnect}
                    className="warm-pill warm-interaction group w-fit rounded-full bg-[var(--wl-signal)] px-6 py-3.5 text-[12px] font-semibold text-white"
                  >
                    Launch Dashboard
                    <Arrow />
                  </button>
                  <MagneticAnchor
                    href="/docs"
                    className="warm-pill warm-pill-ghost inline-flex w-fit items-center gap-2 rounded-full border border-[var(--wl-line)] px-6 py-3.5 text-[12px] font-semibold text-[var(--wl-ink)]"
                  >
                    <BookIcon />
                    Read Docs
                  </MagneticAnchor>
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        <footer className="flex flex-col justify-between gap-6 px-6 pb-10 text-[11px] text-[var(--wl-secondary)] lg:flex-row lg:px-10">
          <span className="font-display flex items-center gap-2 font-semibold tracking-[-.015em] text-[var(--wl-ink)]">
            <EmberMark size={18} />
            ARCANUM
          </span>
          <div className="flex gap-7">
            <MagneticAnchor
              href="/docs"
              className="warm-link inline-flex items-center gap-1.5 hover:text-[var(--wl-signal)]"
            >
              <BookIcon className="h-3 w-3" />
              Documentation
            </MagneticAnchor>
            <MagneticAnchor
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="warm-link inline-flex items-center gap-1.5 hover:text-[var(--wl-signal)]"
            >
              <GitHubMark className="h-3 w-3" />
              GitHub
            </MagneticAnchor>
            <MagneticAnchor
              href="https://x.com/arcanumOS"
              target="_blank"
              rel="noreferrer"
              className="warm-link inline-flex items-center gap-1.5 hover:text-[var(--wl-signal)]"
            >
              <XMark className="h-3 w-3" />X
            </MagneticAnchor>
            <MagneticAnchor href="/dashboard" className="warm-link hover:text-[var(--wl-signal)]">
              Dashboard
            </MagneticAnchor>
            <MagneticAnchor href="/privacy" className="warm-link hover:text-[var(--wl-signal)]">
              Privacy
            </MagneticAnchor>
            <MagneticAnchor href="/terms" className="warm-link hover:text-[var(--wl-signal)]">
              Terms
            </MagneticAnchor>
            <span className="font-mono">2026 ARCANUM</span>
          </div>
        </footer>
        <p className="px-6 pb-6 font-mono text-[9px] tracking-[.04em] text-[var(--wl-mute)] lg:px-10">
          Built on the Arc testnet. Arc is a trademark of Circle Internet Group, Inc. or its
          affiliates. ARCANUM is an independent project and is not affiliated with, sponsored by, or
          endorsed by Circle Internet Group, Inc.
        </p>
      </div>

      <ConnectModal open={connectOpen} onClose={() => setConnectOpen(false)} />
    </main>
  );
}
