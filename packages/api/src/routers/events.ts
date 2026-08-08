import { pageInputSchema } from "@arcanum/shared";
import { z } from "zod";

import { readSupabaseEvents } from "../supabase";
import { publicProcedure, router } from "../trpc";

export const eventsRouter = router({
  // Governance events derive from the indexed Supabase read model - the same
  // source as the ledger. The read fails closed: a read-model problem surfaces
  // as "data unavailable", not as an empty (and believable) event stream.
  list: publicProcedure
    .input(z.object({ walletId: z.string().optional() }).merge(pageInputSchema.partial()))
    .query(({ ctx, input }) =>
      readSupabaseEvents(ctx, {
        walletId: input.walletId,
        page: input.page,
        pageSize: input.pageSize,
      }),
    ),
});
