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

// Every public procedure is rate limited. The limiter used to be opt-in and only
// two procedures ever opted in, so the other fifty-odd unauthenticated read
// endpoints - the entire dashboard read API - answered without any ceiling. The
// ceiling is per caller (session identity, else client IP) and per procedure
// path, at 600 queries and 60 mutations a minute, which is far above what a page
// load costs and far below what a scraper wants.
export const publicProcedure = t.procedure.use(async ({ ctx, next, path, type }) => {
  await enforceRateLimit(ctx, type, path);
  return next();
});

// Kept so call sites that want to state the intent explicitly still read clearly.
export const rateLimitedPublicProcedure = publicProcedure;

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
