import type { ReactNode } from "react";

import { DashboardRouteGuard } from "@/components/arcanum/dashboard-route-guard";
import { Header } from "@/components/warm/Header";

export default function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <DashboardRouteGuard>
      <div className="min-h-screen bg-[var(--wl-bg)] text-[var(--wl-ink)]">
        <Header />
        <main>{children}</main>
      </div>
    </DashboardRouteGuard>
  );
}
