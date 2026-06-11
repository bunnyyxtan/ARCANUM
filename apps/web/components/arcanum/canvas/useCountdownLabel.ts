"use client";

import { useEffect, useState } from "react";

import { type CountdownState, getCountdownState as countdownState } from "@/lib/format/time";

export { countdownState };
export type { CountdownState };

export function useCountdownState(value: string | null | undefined) {
  const [state, setState] = useState(() => countdownState(value));

  useEffect(() => {
    const expiresAt = value ? new Date(value).getTime() : Number.NaN;
    if (!Number.isFinite(expiresAt)) {
      setState(countdownState(value));
      return undefined;
    }

    const tick = () => setState(countdownState(value, Date.now()));
    tick();
    const interval = window.setInterval(tick, 1_000);
    return () => window.clearInterval(interval);
  }, [value]);

  return state;
}

export function useCountdownLabel(value: string | null | undefined) {
  return useCountdownState(value).label;
}
