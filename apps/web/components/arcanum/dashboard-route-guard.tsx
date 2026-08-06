"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

type DashboardRouteGuardProps = Readonly<{
  children: ReactNode;
}>;

export function DashboardRouteGuard({ children }: DashboardRouteGuardProps) {
  const { isConnected, status } = useAccount();
  const [allowLocalPreview, setAllowLocalPreview] = useState(false);
  const [hasResolvedPreview, setHasResolvedPreview] = useState(false);
  const [reconnectGraceElapsed, setReconnectGraceElapsed] = useState(false);
  const [resolveDeadlineElapsed, setResolveDeadlineElapsed] = useState(false);
  const isResolvingConnection = status === "connecting" || status === "reconnecting";

  useEffect(() => {
    // On a hard refresh wagmi restores the persisted connection asynchronously:
    // the very first client frames report "disconnected" before the reconnect
    // kicks in. Treating that transient state as a real walletless visitor
    // would flash the read-only view at connected users on every refresh, so
    // give the reconnect a short grace window before settling on read-only.
    const timer = window.setTimeout(() => setReconnectGraceElapsed(true), 1500);
    // A wallet that never answers (locked extension, dismissed prompt) leaves
    // wagmi in "reconnecting" forever. Without a deadline the page would sit on
    // "Checking access…" with no way out, so fall back to the read-only view.
    const deadline = window.setTimeout(() => setResolveDeadlineElapsed(true), 8000);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(deadline);
    };
  }, []);

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

  if (!hasResolvedPreview) {
    return <GuardPending />;
  }

  if (allowLocalPreview || isConnected) {
    return children;
  }

  // Walletless visitors get the read-only dashboard: every page renders a
  // connect-wallet call to action, and all write paths stay gated on a real
  // wallet connection + signature. We only hold the render while wagmi may
  // still be restoring a persisted connection.
  const settledDisconnected = reconnectGraceElapsed && !isResolvingConnection;
  const stuckResolving = resolveDeadlineElapsed;

  if (settledDisconnected || stuckResolving) {
    return children;
  }

  return <GuardPending />;
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
