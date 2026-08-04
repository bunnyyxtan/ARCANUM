import type { ReactNode } from "react";

type PublicLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function PublicLayout({ children }: PublicLayoutProps) {
  return <div className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]">{children}</div>;
}
