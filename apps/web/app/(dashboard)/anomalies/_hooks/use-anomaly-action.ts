"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useAccount } from "wagmi";

import { trpc } from "@/lib/trpc";
import type { Anomaly } from "@/lib/types";

import { allowTrustedMutation } from "../../escalations/_lib/helpers";

export type AnomalyRowState = "idle" | "restrained" | "dismissed";

export function useAnomalyAction(item: Anomaly, onNotice: (message: string) => void) {
  const { isConnected } = useAccount();
  const utils = trpc.useUtils();
  const acknowledge = trpc.anomalies.acknowledge.useMutation();
  const dismiss = trpc.anomalies.dismiss.useMutation();
  const [state, setState] = useState<AnomalyRowState>(
    item.suggestedAction === "freeze" ? "restrained" : "idle",
  );

  const settle = async (
    next: "restrained" | "dismissed",
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    const action = next === "dismissed" ? "anomalies.dismiss" : "anomalies.acknowledge";
    if (!allowTrustedMutation(action, event) || !isConnected) {
      return;
    }
    if (!item.id) {
      toast.error("ANOMALY ID MISSING / REFRESH AND RETRY");
      return;
    }

    setState(next);
    try {
      const anomalyId = item.id;
      if (next === "dismissed") {
        await dismiss.mutateAsync({ anomalyId });
      } else {
        await acknowledge.mutateAsync({ anomalyId });
      }
      await utils.anomalies.list.invalidate();
      onNotice(
        next === "dismissed"
          ? `${item.agentName.toUpperCase()} REMOVED FROM ACTIVE REGISTER`
          : `${item.agentName.toUpperCase()} WALLET RESTRAINED · POLICY HOLD ACTIVE`,
      );
      toast.success(
        next === "dismissed"
          ? `${item.agentName.toUpperCase()} DISMISSED / anomaly archived`
          : `${item.agentName.toUpperCase()} FROZEN / anomaly restraint active`,
      );
    } catch {
      setState(item.suggestedAction === "freeze" ? "restrained" : "idle");
      toast.error(`${item.agentName.toUpperCase()} ACTION FAILED / CONNECT WALLET`);
    }
  };

  return {
    acknowledgePending: acknowledge.isPending,
    dismissPending: dismiss.isPending,
    frozen: state === "restrained" || item.suggestedAction === "freeze",
    isConnected,
    isPending: acknowledge.isPending || dismiss.isPending,
    settle,
    state,
  };
}
