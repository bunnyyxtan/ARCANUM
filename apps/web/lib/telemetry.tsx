"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

type TelemetryProviderProps = Readonly<{
  children: ReactNode;
}>;

export function TelemetryProvider({ children }: TelemetryProviderProps) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ARCANUM_TELEMETRY !== "on") {
      return;
    }

    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) {
      return;
    }

    void import("posthog-js").then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://app.posthog.com",
        autocapture: false,
        capture_pageview: true,
        disable_session_recording: true,
      });
    });
  }, []);

  return children;
}
