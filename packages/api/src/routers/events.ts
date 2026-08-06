import { events } from "@arcanum/db/schema";
import { pageInputSchema } from "@arcanum/shared";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { publicProcedure, router } from "../trpc";
import { failClosed, tenantIdFor } from "./helpers";

export const eventsRouter = router({
  // Governance events are indexed into the local Postgres event table. The
  // read fails closed: a database problem surfaces as "data unavailable", not
  // as an empty (and believable) event stream.
  list: publicProcedure
    .input(z.object({ walletId: z.string().optional() }).merge(pageInputSchema.partial()))
    .query(({ ctx, input }) => {
      const tenantId = tenantIdFor(ctx);

      return failClosed("events.list", () =>
        ctx.db.query.events.findMany({
          where: input.walletId
            ? and(eq(events.tenantId, tenantId), eq(events.walletId, input.walletId))
            : eq(events.tenantId, tenantId),
          orderBy: desc(events.timestamp),
          limit: input.pageSize ?? 50,
          offset: (input.page ?? 0) * (input.pageSize ?? 50),
        }),
      );
    }),
});
