import { agentsRouter } from "./routers/agents";
import { analyticsRouter } from "./routers/analytics";
import { anomaliesRouter } from "./routers/anomalies";
import { authRouter } from "./routers/auth";
import { escalationsRouter } from "./routers/escalations";
import { eventsRouter } from "./routers/events";
import { healthRouter } from "./routers/health";
import { ledgerRouter } from "./routers/ledger";
import { orgRouter } from "./routers/org";
import { paymentIntentsRouter } from "./routers/payment-intents";
import { policiesRouter } from "./routers/policies";
import { vendorsRouter } from "./routers/vendors";
import { walletsRouter } from "./routers/wallets";
import { router } from "./trpc";

export const appRouter = router({
  analytics: analyticsRouter,
  anomalies: anomaliesRouter,
  agents: agentsRouter,
  auth: authRouter,
  escalations: escalationsRouter,
  events: eventsRouter,
  health: healthRouter,
  ledger: ledgerRouter,
  org: orgRouter,
  paymentIntents: paymentIntentsRouter,
  policies: policiesRouter,
  vendors: vendorsRouter,
  wallets: walletsRouter,
});

export type AppRouter = typeof appRouter;
