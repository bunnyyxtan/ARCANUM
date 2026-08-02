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
    // gated on an actual wallet connection + signature.
    setAllowLocalPreview(new URLSearchParams(window.location.search).get("preview") === "1");
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
    return null;
  }

  if (allowLocalPreview) {
    return children;
  }

  if (isResolvingConnection || !isConnected) {
    return null;
  }

  return children;
}
