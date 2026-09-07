"use client";

import { useState } from "react";

import { trpc } from "@/lib/trpc";

export type HealthState = "OPERATIONAL" | "DEGRADED" | "CHECKING";

export function useStatusController() {
  const health = trpc.health.ping.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const indexer = health.data?.indexer;
  const rpc = health.data?.rpc;
  const supabase = health.data?.supabase;

  const runCheck = async () => {
    const result = await health.refetch();
    if (result.status === "success") {
      setCheckedAt(
        `${new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        })} UTC`,
      );
    }
  };

  const indexerState: HealthState = health.isLoading
    ? "CHECKING"
    : indexer?.status === "available"
      ? "OPERATIONAL"
      : "DEGRADED";
  const readModelState: HealthState = health.isLoading
    ? "CHECKING"
    : supabase?.readModel.status === "available"
      ? "OPERATIONAL"
      : "DEGRADED";
  const rpcState: HealthState = health.isLoading
    ? "CHECKING"
    : rpc?.status === "available"
      ? "OPERATIONAL"
      : "DEGRADED";

  return {
    checkedAt: checkedAt ?? (health.isLoading ? "Checking…" : "Not checked yet"),
    indexer: {
      metric: health.isLoading
        ? "…"
        : indexer?.lastIndexedBlock != null
          ? String(indexer.lastIndexedBlock)
          : "-",
      metricLabel: health.isLoading
        ? "CHECKING"
        : indexer?.status === "stale"
          ? "STALE / SYNC LAG"
          : (indexer?.error ?? "LAST SYNCED BLOCK"),
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
    runCheck,
  };
}
