"use client";

import { ARC_NETWORK_BADGE } from "@arcanum/shared";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { EmberMark } from "@/components/warm/EmberMark";
import { ThemeToggle } from "@/components/warm/ThemeToggle";

const links = [
  { label: "Documentation", href: "/docs" },
  { label: "Glossary", href: "/glossary" },
];

/**
 * Chrome for the public reference pages.
 *
 * The dashboard header is the wrong fit here: it carries the governance nav and
 * a notification inbox that mean nothing to a reader who has not connected a
 * wallet, and every link in it bounces a signed-out visitor back to the landing
 * page. This keeps the same shell but offers only what a reader can actually
 * use.
 */
export function ReferenceHeader() {
  const pathname = usePathname();
  const { isConnected } = useAccount();
  // The wallet is unknown until the client hydrates, so the first paint has to
  // match the server's: assume signed out, then settle.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const connected = mounted && isConnected;

  return (
    <header className="relative z-20 flex flex-wrap items-center justify-between border-b border-[var(--wl-line)] bg-[var(--wl-bg)] px-5 md:h-[68px] md:flex-nowrap md:px-8">
      <div className="flex h-[68px] min-w-0 items-center gap-7">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-display text-[18px] font-bold tracking-[-.015em] transition-transform duration-[220ms] hover:-translate-y-0.5"
        >
          <EmberMark size={24} />
          ARCANUM
        </Link>
        <nav className="hidden min-w-0 gap-5 overflow-x-auto pb-0.5 md:flex" aria-label="Reference">
          {links.map(({ label, href }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={label}
                href={href}
                className={`relative whitespace-nowrap py-6 text-[12px] font-medium tracking-[-.01em] transition-colors duration-[220ms] hover:text-[var(--wl-ink)] ${
                  active
                    ? "text-[var(--wl-ink)] after:absolute after:bottom-[-1px] after:left-0 after:h-[2px] after:w-full after:bg-[var(--wl-signal)]"
                    : "text-[var(--wl-body)]"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
      {/* Small screens get the reference nav as its own row: two links do not
          justify a menu, but they cannot fight the logo for header space. It
          sits in normal flow so content below is pushed down, not covered. */}
      <nav
        aria-label="Reference"
        className="-mx-5 order-last flex basis-full border-t border-[var(--wl-line)] bg-[var(--wl-bg)] md:hidden"
      >
        {links.map(({ label, href }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={label}
              href={href}
              className={`flex min-h-[44px] flex-1 items-center justify-center text-[12px] font-medium tracking-[-.01em] ${
                active
                  ? "border-b-2 border-[var(--wl-signal)] text-[var(--wl-ink)]"
                  : "border-b-2 border-transparent text-[var(--wl-body)]"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="flex h-[68px] shrink-0 items-center gap-3">
        <span className="hidden font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-mute)] sm:inline">
          {ARC_NETWORK_BADGE}
        </span>
        <ThemeToggle />
        <Link
          href={connected ? "/dashboard" : "/"}
          className="whitespace-nowrap border border-[var(--wl-line)] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[.16em] text-[var(--wl-body)] transition-colors duration-[220ms] hover:border-[var(--wl-signal)] hover:text-[var(--wl-ink)]"
        >
          {connected ? "Open dashboard" : "Launch dashboard"}
        </Link>
      </div>
    </header>
  );
}
