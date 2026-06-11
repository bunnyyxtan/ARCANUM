import { events } from "@arcanum/db/schema";
import { pageInputSchema } from "@arcanum/shared";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { fallbackEvents } from "../mock-fallback";
import { publicProcedure, router } from "../trpc";
import { canUseDemoFallback, readDbOrFallback, tenantIdFor } from "./helpers";

export const eventsRouter = router({
  list: publicProcedure
    .input(z.object({ walletId: z.string().optional() }).merge(pageInputSchema.partial()))
    .query(async ({ ctx, input }) => {
      const tenantId = tenantIdFor(ctx);

      if (!canUseDemoFallback(ctx)) {
        return [];
      }

      const rows = await readDbOrFallback(
        "events.list",
        () =>
          ctx.db.query.events.findMany({
            where: input.walletId
              ? and(eq(events.tenantId, tenantId), eq(events.walletId, input.walletId))
              : eq(events.tenantId, tenantId),
            orderBy: desc(events.timestamp),
            limit: input.pageSize ?? 50,
            offset: (input.page ?? 0) * (input.pageSize ?? 50),
          }),
        [],
      );

      if (rows.length > 0) {
        return rows;
      }

      return input.walletId
        ? fallbackEvents.filter((event) => event.walletId === input.walletId)
        : fallbackEvents;
    }),
});
