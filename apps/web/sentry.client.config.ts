import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN_WEB;

if (process.env.NEXT_PUBLIC_ARCANUM_TELEMETRY === "on" && dsn) {
  Sentry.init({
    dsn,
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
