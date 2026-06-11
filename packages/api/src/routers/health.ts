import { readSupabaseRuntimeHealth } from "../supabase";
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
    const supabase = await readSupabaseRuntimeHealth(ctx);
    const rpc = await healthCheck(() => ctx.publicClient.getBlockNumber());
    const lastIndexedAt = supabase.indexerCheckpoint.lastIndexedAt;
    const stale =
      lastIndexedAt === null
        ? false
        : Date.now() - new Date(lastIndexedAt).getTime() > 15 * 60 * 1_000;

    return {
      ok: supabase.readModel.status === "available" && rpc.ok,
      supabase,
      redisVersion:
        process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
          ? "upstash configured"
          : "unconfigured",
      indexer: {
        status:
          supabase.indexerCheckpoint.status === "available"
            ? stale
              ? "stale"
              : "available"
            : supabase.indexerCheckpoint.status,
        lastIndexedBlock: supabase.indexerCheckpoint.lastIndexedBlock,
        lastIndexedAt,
        error:
          supabase.indexerCheckpoint.error ??
          (supabase.indexerCheckpoint.status === "empty" ? "No checkpoint yet." : null),
      },
      rpc: {
        status: rpc.ok ? "available" : "unavailable",
        latestBlock: rpc.ok ? rpc.data.toString() : null,
        error: rpc.ok ? null : "Arc Testnet RPC is unavailable.",
      },
      deploymentMode: process.env.ARCANUM_DEPLOYMENT_MODE ?? "supabase",
    };
  }),
});
