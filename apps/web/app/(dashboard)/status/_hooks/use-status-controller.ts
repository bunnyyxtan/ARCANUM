"use client";

import { useState } from "react";

import { trpc } from "@/lib/trpc";

import { indexerMetricLabel } from "../_lib/indexer-metric-label";
import { formatStatusTimestamp } from "../_lib/status-time";

export type HealthState = "OPERATIONAL" | "DEGRADED" | "CHECKING";

export function useStatusController() {
  const health = trpc.health.ping.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const indexer = health.data?.indexer;
  const rpc = health.data?.rpc;
  const supabase = health.data?.supabase;

  const runCheck = async () => {
    setRefreshError(null);
    try {
      const result = await health.refetch();
      if (result.status !== "success") {
        setRefreshError("Health check failed; showing the last successful result.");
      }
    } catch {
      setRefreshError("Health check failed; showing the last successful result.");
    }
  };

  const indexerState: HealthState = health.isLoading
    ? "CHECKING"
    : !health.isError && indexer?.status === "available"
      ? "OPERATIONAL"
      : "DEGRADED";
  const readModelState: HealthState = health.isLoading
    ? "CHECKING"
    : !health.isError && supabase?.readModel.status === "available"
      ? "OPERATIONAL"
      : "DEGRADED";
  const rpcState: HealthState = health.isLoading
    ? "CHECKING"
    : !health.isError && rpc?.status === "available"
      ? "OPERATIONAL"
      : "DEGRADED";

  return {
    overallState: health.isLoading
      ? "CHECKING"
      : !health.isError && health.data?.ok
        ? "OPERATIONAL"
        : "DEGRADED",
    readiness: health.data?.readiness,
    lastCatchupAt: indexer?.lastCatchupAt ?? null,
    freshnessSeconds: indexer?.staleAfterSeconds ?? 900,
    indexer: {
      // The headline number is the chain height the read model is level with,
      // so it compares directly with the RPC card. The last event block sits in
      // the label: on a quiet chain it is older, and that is not lag.
      metric: health.isLoading
        ? "…"
        : indexer?.lastSeenChainBlock != null
          ? String(indexer.lastSeenChainBlock)
          : "-",
      metricLabel: health.isLoading
        ? "CHECKING"
        : indexer?.status === "unavailable" || indexer?.status === "not_configured"
          ? (indexer.error ?? "INDEXER STATUS UNKNOWN")
          : indexerMetricLabel(indexer),
      state: indexerState,
    },
    isFetching: health.isFetching,
    readModel: {
      metric: health.isLoading
        ? "…"
        : supabase?.readModel.sampleRows != null
          ? String(supabase.readModel.sampleRows)
          : "-",
      metricLabel: health.isLoading
        ? "CHECKING"
        : supabase?.serviceRole.status === "configured"
          ? "SAMPLE ROWS · SERVICE ROLE CONFIGURED"
          : "SERVICE ROLE MISSING",
      state: readModelState,
    },
    rpc: {
      metric: health.isLoading ? "…" : (rpc?.latestBlock ?? "-"),
      metricLabel: health.isLoading
        ? "CHECKING"
        : rpc?.status === "available"
          ? "LATEST BLOCK · ARC RPC"
          : (rpc?.error ?? "RPC STATUS UNKNOWN"),
      state: rpcState,
    },
    checkedAt:
      health.isLoading && !health.dataUpdatedAt
        ? "Checking…"
        : health.dataUpdatedAt
          ? formatStatusTimestamp(health.dataUpdatedAt)
          : "No successful check yet",
    refreshError:
      refreshError ??
      (health.isError ? "Health check failed; no successful result is available." : null),
    runCheck,
  };
}
