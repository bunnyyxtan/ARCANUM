import * as Sentry from "@sentry/nextjs";

if (process.env.ARCANUM_TELEMETRY === "on" && process.env.SENTRY_DSN_WEB) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN_WEB,
    sendDefaultPii: false,
    tracesSampleRate: 0.05,
    beforeSend(event) {
      event.user = undefined;
      event.request = undefined;
      event.breadcrumbs = undefined;
      event.extra = undefined;
      return event;
    },
  });
}
