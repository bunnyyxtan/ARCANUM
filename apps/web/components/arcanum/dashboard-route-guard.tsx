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
  const [hasResolvedPreview, setHasResolvedPreview] = useState(
    process.env.NODE_ENV !== "development",
  );
  const isResolvingConnection = status === "connecting" || status === "reconnecting";

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }

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
