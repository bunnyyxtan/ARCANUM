import type { ReactNode } from "react";

import { ReferenceHeader } from "@/components/warm/ReferenceHeader";

/**
 * The documentation and glossary are public on purpose: someone evaluating
 * ARCANUM reads them before they ever connect a wallet, and a shared link has
 * to open for the person it was sent to. They sit outside the dashboard route
 * group so the wallet guard never sees them -- inside it, a signed-out visitor
 * got "Checking access…" and was then thrown back to the landing page.
 */
export default function ReferenceLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen bg-[var(--wl-bg)] text-[var(--wl-ink)]">
      <ReferenceHeader />
      <main>{children}</main>
    </div>
  );
}
