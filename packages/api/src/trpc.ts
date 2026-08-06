import type { ArcanumSession } from "@arcanum/auth";
import { defaultTenantId } from "@arcanum/db";
import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";

import type { ApiContext } from "./context";
import { enforceRateLimit } from "./rate-limit";

const t = initTRPC.context<ApiContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const rateLimitedPublicProcedure = t.procedure.use(async ({ ctx, next, path, type }) => {
  await enforceRateLimit(ctx, type, path);
  return next();
});

export const protectedProcedure = t.procedure.use(async ({ ctx, next, path, type }) => {
  const session = ctx.session ?? createLocalDevSession(ctx.env.allowDevAuth);

  if (!session) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "SIWE session required" });
  }

  const nextCtx = {
    ...ctx,
    session,
  };

  await enforceRateLimit(nextCtx, type, path);

  return next({
    ctx: nextCtx,
  });
});

// Authorisation deliberately does not read the session's role field. It is set
// from a user table production cannot reach, so it degrades to "viewer" for
// everyone; anything gated on it would refuse the people who actually hold
// access. Ownership is checked against the read model at the call site instead.

function createLocalDevSession(allowDevAuth: boolean): ArcanumSession | null {
  if (!allowDevAuth) {
    return null;
  }

  return {
    walletAddress: "0x9f4e0000000000000000000000000000000003b7",
    tenantId: defaultTenantId(),
    role: "owner",
    expiresAt: Date.now() + 60 * 60 * 1000,
  };
}
