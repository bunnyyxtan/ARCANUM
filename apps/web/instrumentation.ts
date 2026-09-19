import type { Instrumentation } from "next";

export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.ARCANUM_TELEMETRY === "on" &&
    process.env.SENTRY_DSN_WEB
  ) {
    await import("./sentry.server.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (process.env.ARCANUM_TELEMETRY === "on" && process.env.SENTRY_DSN_WEB) {
    const { captureRequestError } = await import("@sentry/nextjs");
    await captureRequestError(...args);
  }
};
