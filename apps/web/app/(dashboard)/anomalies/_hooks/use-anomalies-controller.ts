"use client";

import { useMemo, useState } from "react";

import { useWorkspaceMode } from "@/lib/auth-session";
import { useLiveAnomalies } from "@/lib/live-data";

export function useAnomaliesController() {
  const { dataMode, isResolving } = useWorkspaceMode();
  const liveAnomalies = useLiveAnomalies();
  const [notice, setNotice] = useState("MONITORING WINDOW / LAST 24 HOURS");
  const [investigated, setInvestigated] = useState<string | null>(null);
  const anomalies = liveAnomalies.data;
  const critical = useMemo(() => anomalies.filter((item) => item.score >= 5).length, [anomalies]);

  return {
    anomalies,
    critical,
    elevated: anomalies.length - critical,
    errored: liveAnomalies.isError && anomalies.length === 0,
    investigated,
    loading: liveAnomalies.isLoading && anomalies.length === 0,
    notice,
    peakScore: anomalies[0]?.score.toFixed(1) ?? "0.0",
    readOnly: dataMode === "disconnected" && !isResolving,
    refetch: liveAnomalies.refetch,
    setInvestigated,
    setNotice,
  };
}
