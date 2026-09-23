import type { ApiContext } from "../context";
import { consumeRateLimit } from "../rate-limit-store";
import { boundedHealthCheck } from "./freshness";

export async function readSecurityReadiness(ctx: ApiContext) {
  const configured = Boolean(ctx.supabase?.configured);
  const authConfigured =
    Boolean(process.env.SIWE_SECRET && process.env.SIWE_SECRET.length >= 32) &&
    process.env.ARCANUM_INSECURE_COOKIES !== "true" &&
    process.env.ARCANUM_DEPLOYMENT_MODE !== "multi-tenant";
  const sessionMode = process.env.ARCANUM_SESSION_STORE_MODE;
  const sharedSessionStore = !sessionMode || sessionMode === "supabase";
  const rateBackend =
    process.env.UPSTASH_REDIS_REST_URL || process.env.UPSTASH_REDIS_REST_TOKEN
      ? "upstash"
      : configured
        ? "supabase"
        : "unconfigured";
  const [identity, sessions, rateLimit] = await Promise.all([
    boundedHealthCheck(async () => {
      if (!configured || !authConfigured) throw new Error("Identity not configured");
      const results = await Promise.all(
        ["profiles", "organizations", "organization_members"].map((table) =>
          ctx.supabase?.selectRows(table, { select: "id", limit: 1 }),
        ),
      );
      if (!results.every(Array.isArray)) throw new Error("Invalid identity read");
    }),
    boundedHealthCheck(async () => {
      if (!configured || !sharedSessionStore || !authConfigured) {
        throw new Error("Shared sessions not configured");
      }
      const rows = await ctx.supabase?.selectRows("auth_sessions", {
        select: "session_hash,wallet_address,tenant_id,role,expires_at,revoked_at",
        limit: 1,
      });
      if (!Array.isArray(rows)) throw new Error("Invalid session store read");
    }),
    boundedHealthCheck(async () => {
      if (rateBackend === "unconfigured") throw new Error("Shared limiter not configured");
      // Dedicated, bounded probe bucket. Exercise the actual atomic backend,
      // not mere env presence or a Redis-only readiness assumption.
      await consumeRateLimit({
        scope: "operational-health",
        identity: "shared-store-probe",
        limit: 1_000_000,
        windowMs: 60_000,
      });
    }),
  ]);
  return {
    identity: { status: identity.ok ? ("available" as const) : ("unavailable" as const) },
    sessions: { status: sessions.ok ? ("available" as const) : ("unavailable" as const) },
    rateLimit: {
      status: rateLimit.ok ? ("available" as const) : ("unavailable" as const),
      backend: rateBackend,
    },
  };
}
