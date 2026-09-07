"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useWorkspaceMode } from "@/lib/auth-session";
import { shortAddress } from "@/lib/format/address";
import { useLiveEscalations } from "@/lib/live-data";

import { applyEscalationChainUpdate, sortResolvedEscalations } from "../_lib/helpers";
import type { EscalationChainUpdate } from "./use-escalation-action";

function useEscalationsControllerInternal() {
  const { dataMode, isResolving } = useWorkspaceMode();
  const liveEscalations = useLiveEscalations();
  const [resolvedIds, setResolvedIds] = useState<ReadonlySet<string>>(new Set());
  const [chainUpdates, setChainUpdates] = useState<ReadonlyMap<string, EscalationChainUpdate>>(
    new Map(),
  );
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<number | null>(null);

  const showNotice = (message: string) => {
    setNotice(message);
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(""), 2600);
  };
  useEffect(() => {
    return () => {
      if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    };
  }, []);

  const allEscalations = useMemo(
    () =>
      liveEscalations.data.map((item) => {
        const update = chainUpdates.get(item.id);
        return update ? applyEscalationChainUpdate(item, update) : item;
      }),
    [chainUpdates, liveEscalations.data],
  );
  const queue = useMemo(
    () => allEscalations.filter((item) => item.status === "PENDING"),
    [allEscalations],
  );
  const resolvedHistory = useMemo(() => sortResolvedEscalations(allEscalations), [allEscalations]);
  const pending = useMemo(
    () => queue.filter((item) => !resolvedIds.has(item.id)),
    [queue, resolvedIds],
  );
  const markResolved = (id: string) => {
    setResolvedIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  };
  const applyChainUpdate = (id: string, update: EscalationChainUpdate) => {
    setChainUpdates((current) => {
      const next = new Map(current);
      next.set(id, update);
      return next;
    });
    if (update.status !== "PENDING") markResolved(id);
  };
  const reviewNext = () => {
    const next = pending[0];
    if (!next) {
      showNotice("The queue is clear.");
      return;
    }
    showNotice(
      `Reviewing ${shortAddress(next.id, { head: 8, tail: 4 })}, the oldest open request.`,
    );
    document.getElementById(`escalation-${next.id}`)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "start",
    });
  };

  return {
    errored: liveEscalations.isError && queue.length === 0,
    liveEscalations,
    loading: liveEscalations.isLoading && queue.length === 0,
    markResolved,
    applyChainUpdate,
    notice,
    pendingCount: pending.length,
    queue,
    readOnly: dataMode === "disconnected" && !isResolving,
    resolvedCount: resolvedHistory.length + queue.filter((item) => resolvedIds.has(item.id)).length,
    resolvedHistory,
    reviewNext,
  };
}

export type EscalationsController = ReturnType<typeof useEscalationsControllerInternal>;

export function useEscalationsController(): EscalationsController {
  return useEscalationsControllerInternal();
}
