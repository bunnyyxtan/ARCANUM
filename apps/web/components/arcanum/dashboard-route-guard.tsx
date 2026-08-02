"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

type DashboardRouteGuardProps = Readonly<{
  children: ReactNode;
}>;

export function DashboardRouteGuard({ children }: DashboardRouteGuardProps) {
  const router = useRouter();
  const { isConnected, status } = useAccount();
  const [allowLocalPreview, setAllowLocalPreview] = useState(false);
  const [hasResolvedPreview, setHasResolvedPreview] = useState(false);
  const isResolvingConnection = status === "connecting" || status === "reconnecting";

  useEffect(() => {
    // Read-only preview (?preview=1) is allowed in every environment: it renders
    // the dashboard without a connected wallet, and every write path is already
    // gated on an actual wallet connection + signature. Once granted, preview
    // sticks for the rest of the tab session so reloads and direct links to
    // other dashboard pages don't bounce back to the landing page.
    const fromQuery = new URLSearchParams(window.location.search).get("preview") === "1";
    let granted = fromQuery;
    try {
      if (fromQuery) {
        window.sessionStorage.setItem("arcanum-preview", "1");
      }
      granted = fromQuery || window.sessionStorage.getItem("arcanum-preview") === "1";
    } catch {
      // sessionStorage unavailable (privacy mode) — fall back to the query param.
    }
    setAllowLocalPreview(granted);
    setHasResolvedPreview(true);
  }, []);

  useEffect(() => {
    if (!hasResolvedPreview) {
      return;
    }

    if (allowLocalPreview) {
      return;
    }

    if (!isResolvingConnection && !isConnected) {
      router.replace("/");
    }
  }, [allowLocalPreview, hasResolvedPreview, isConnected, isResolvingConnection, router]);

  if (!hasResolvedPreview) {
    return <GuardPending />;
  }

  if (allowLocalPreview) {
    return children;
  }

  if (isResolvingConnection || !isConnected) {
    return <GuardPending />;
  }

  return children;
}

function GuardPending() {
  // Never show a blank white page while the wallet state resolves or a
  // redirect to the landing page is in flight.
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--wl-bg)]">
      <span className="warm-period font-mono text-[11px] uppercase tracking-[.22em] text-[var(--wl-muted)]">
        Checking access…
      </span>
    </div>
  );
}
