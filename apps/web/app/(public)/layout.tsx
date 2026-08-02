import Link from "next/link";
import type { ReactNode } from "react";

import { ThemeToggle } from "@/components/warm/ThemeToggle";

type PublicLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function PublicLayout({ children }: PublicLayoutProps) {
  return (
    <div className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]">
      <header className="flex items-center justify-between border-b border-[var(--wl-line)] px-5 py-5 md:px-9">
        <Link
          href="/"
          className="text-[18px] font-bold tracking-[-.05em] transition-transform duration-[220ms] hover:-translate-y-0.5"
        >
          ARCANUM<span className="text-[var(--wl-signal)]">.</span>
        </Link>
        <ThemeToggle />
      </header>
      {children}
    </div>
  );
}
