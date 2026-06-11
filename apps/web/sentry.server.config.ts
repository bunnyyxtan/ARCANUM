import * as Sentry from "@sentry/nextjs";

if (process.env.ARCANUM_TELEMETRY === "on" && process.env.SENTRY_DSN_WEB) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN_WEB,
    tracesSampleRate: 0.05,
    beforeSend(event) {
      event.user = undefined;
      return event;
    },
  });
}
