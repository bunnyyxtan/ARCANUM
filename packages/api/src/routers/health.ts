import { transfers } from "@arcanum/db/schema";
import { desc, sql } from "drizzle-orm";

import { publicProcedure, router } from "../trpc";

type HealthCheckResult<T> = { ok: true; data: T } | { ok: false; error: string };

async function healthCheck<T>(operation: () => Promise<T>): Promise<HealthCheckResult<T>> {
  try {
    return { ok: true, data: await operation() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export const healthRouter = router({
  ping: publicProcedure.query(async ({ ctx }) => {
    const version = await healthCheck(async () => {
      const rows = await ctx.db
        .select({ version: sql<string>`current_setting('server_version')` })
        .from(transfers)
        .limit(1);

      return rows[0]?.version ?? null;
    });
    const lastTransfer = await healthCheck(async () => {
      const rows = await ctx.db
        .select({ blockNumber: transfers.blockNumber, timestamp: transfers.timestamp })
        .from(transfers)
        .orderBy(desc(transfers.blockNumber))
        .limit(1);

      return rows[0] ?? null;
    });
    const rpc = await healthCheck(() => ctx.publicClient.getBlockNumber());
    const indexed = lastTransfer.ok ? lastTransfer.data : null;
    const lastIndexedAt = indexed?.timestamp?.toISOString() ?? null;
    const stale =
      lastIndexedAt === null
        ? false
        : Date.now() - new Date(lastIndexedAt).getTime() > 15 * 60 * 1_000;

    return {
      ok: version.ok && lastTransfer.ok && rpc.ok,
      pgVersion: version.ok ? (version.data ?? "postgres unavailable") : "postgres unavailable",
      supabase: {
        status: ctx.supabase?.configured ? "configured" : "unconfigured",
      },
      redisVersion:
        process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
          ? "upstash configured"
          : "unconfigured",
      indexer: {
        status: lastTransfer.ok
          ? indexed
            ? stale
              ? "stale"
              : "available"
            : "empty"
          : "unavailable",
        lastIndexedBlock: indexed?.blockNumber ?? null,
        lastIndexedAt,
        error: lastTransfer.ok ? null : "Indexer read model is unavailable.",
      },
      rpc: {
        status: rpc.ok ? "available" : "unavailable",
        latestBlock: rpc.ok ? rpc.data.toString() : null,
        error: rpc.ok ? null : "Arc Testnet RPC is unavailable.",
      },
      deploymentMode: process.env.ARCANUM_DEPLOYMENT_MODE ?? "shadow-postgres",
    };
  }),
});
