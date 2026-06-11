import { protectedProcedure, publicProcedure, router } from "../trpc";

export const authRouter = router({
  me: protectedProcedure.query(({ ctx }) => ctx.session),
  nonce: publicProcedure.query(() => ({ nonce: crypto.randomUUID() })),
  verify: publicProcedure.mutation(() => ({ ok: false, reason: "Use /api/auth/verify" })),
  logout: publicProcedure.mutation(() => ({ ok: false, reason: "Use /api/auth/logout" })),
});
