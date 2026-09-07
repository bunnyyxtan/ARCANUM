"use client";

import { useWorkspaceMode } from "@/lib/auth-session";
import {
  useLiveAnomalies,
  useLiveDashboardMetrics,
  useLiveEscalations,
  useLiveEvents,
  useLiveOrg,
} from "@/lib/live-data";

function useDashboardControllerInternal() {
  const { dataMode, isResolving } = useWorkspaceMode();
  const metrics = useLiveDashboardMetrics();
  const org = useLiveOrg();
  const events = useLiveEvents();
  const escalations = useLiveEscalations("PENDING");
  const anomalies = useLiveAnomalies();
  const pendingItem = escalations.data[0] ?? null;
  const attentionSettled =
    !escalations.isLoading && !escalations.isError && !anomalies.isLoading && !anomalies.isError;
  const needsAttention =
    attentionSettled && (escalations.data.length > 0 || anomalies.data.length > 0);

  return {
    readOnly: dataMode === "disconnected" && !isResolving,
    metrics,
    org,
    events,
    escalations,
    anomalies,
    pendingItem,
    attentionSettled,
    needsAttention,
  };
}

export type DashboardController = ReturnType<typeof useDashboardControllerInternal>;

export function useDashboardController(): DashboardController {
  return useDashboardControllerInternal();
}
