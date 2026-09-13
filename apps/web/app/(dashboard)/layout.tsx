import type { ReactNode } from "react";

import { WalletAuthBridge } from "@/components/arcanum/WalletAuthBridge";
import { DashboardRouteGuard } from "@/components/arcanum/dashboard-route-guard";
import { WorkspaceGate } from "@/components/arcanum/workspace-gate";
import { Header } from "@/components/warm/Header";

export default function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      {/* The SIWE ceremony belongs to the console. Mounting the bridge here,
          not in the root providers, keeps a wallet that wagmi restored on the
          landing or public pages from being asked to sign on arrival. */}
      <WalletAuthBridge />
      <DashboardRouteGuard>
        <div className="min-h-screen bg-[var(--wl-bg)] text-[var(--wl-ink)]">
          <Header />
          <main>
            <WorkspaceGate>{children}</WorkspaceGate>
          </main>
        </div>
      </DashboardRouteGuard>
    </>
  );
}
