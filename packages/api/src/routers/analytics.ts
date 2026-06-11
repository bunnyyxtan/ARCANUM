import { agents, anomalies, escalations, transfers } from "@arcanum/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";

import {
  fallbackAgents,
  fallbackAnomalies,
  fallbackEscalations,
  fallbackTransfers,
} from "../mock-fallback";
import {
  readSupabaseAgents,
  readSupabaseAnomalies,
  readSupabaseEscalations,
  readSupabaseTransfers,
} from "../supabase";
import { publicProcedure, router } from "../trpc";
import { canUseDemoFallback, readDbOrFallback, tenantIdFor } from "./helpers";

const postureCache = new Map<string, { value: number; expiresAt: number }>();

export const analyticsRouter = router({
  postureIndex: publicProcedure.query(async ({ ctx }) => {
    const tenantId = tenantIdFor(ctx);
    const actor = ctx.session?.walletAddress.toLowerCase() ?? "anonymous";
    const cacheKey = `${tenantId}:${actor}:posture`;
    const cached = postureCache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const [supabaseAgents, supabaseTransfers, supabaseAnomalies] = await Promise.all([
      readSupabaseAgents(ctx),
      readSupabaseTransfers(ctx),
      readSupabaseAnomalies(ctx),
    ]);

    const frozen = supabaseAgents.filter((agent) => agent.status === "frozen").length;
    if (frozen > 0 || supabaseTransfers.length > 0 || supabaseAnomalies.length > 0) {
      const denied = supabaseTransfers.filter((transfer) => transfer.verdict === "DENY").length;
      const danger = supabaseAnomalies.filter((anomaly) => anomaly.severity === "danger").length;
      const value = Math.max(0, Math.min(100, 100 - frozen * 10 - denied * 3 - danger * 8));
      postureCache.set(cacheKey, { value, expiresAt: Date.now() + 30_000 });
      return value;
    }

    if (supabaseAgents.length > 0) {
      postureCache.set(cacheKey, { value: 0, expiresAt: Date.now() + 30_000 });
      return 0;
    }

    if (!canUseDemoFallback(ctx)) {
      postureCache.set(cacheKey, { value: 0, expiresAt: Date.now() + 30_000 });
      return 0;
    }

    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [frozenAgents, denied24h, danger24h] = await readDbOrFallback(
      "analytics.postureIndex",
      () =>
        Promise.all([
          ctx.db
            .select({ count: sql<number>`count(*)::int` })
            .from(agents)
            .where(and(eq(agents.tenantId, tenantId), eq(agents.status, "frozen"))),
          ctx.db
            .select({ count: sql<number>`count(*)::int` })
            .from(transfers)
            .where(
              and(
                eq(transfers.tenantId, tenantId),
                eq(transfers.verdict, "DENY"),
                gte(transfers.timestamp, dayAgo),
              ),
            ),
          ctx.db
            .select({ count: sql<number>`count(*)::int` })
            .from(anomalies)
            .where(
              and(
                eq(anomalies.tenantId, tenantId),
                eq(anomalies.severity, "danger"),
                gte(anomalies.createdAt, dayAgo),
              ),
            ),
        ]),
      [[], [], []] as [
        Array<{ count: number }>,
        Array<{ count: number }>,
        Array<{ count: number }>,
      ],
    );

    const fallbackFrozen =
      frozenAgents[0]?.count ?? fallbackAgents.filter((agent) => agent.status === "frozen").length;
    const denied =
      denied24h[0]?.count ??
      fallbackTransfers.filter((transfer) => transfer.verdict === "DENY").length;
    const danger = danger24h[0]?.count ?? fallbackAnomalies.length;
    const value = Math.max(0, Math.min(100, 100 - fallbackFrozen * 10 - denied * 3 - danger * 8));
    postureCache.set(cacheKey, { value, expiresAt: Date.now() + 30_000 });
    return value;
  }),

  valueGoverned24h: publicProcedure.query(async ({ ctx }) => {
    const tenantId = tenantIdFor(ctx);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const supabaseTransfers = await readSupabaseTransfers(ctx);

    if (supabaseTransfers.length > 0) {
      return String(supabaseTransfers.reduce((sum, transfer) => sum + Number(transfer.amount), 0));
    }

    if (!canUseDemoFallback(ctx)) {
      return "0";
    }

    const [row] = await readDbOrFallback(
      "analytics.valueGoverned24h",
      () =>
        ctx.db
          .select({ value: sql<string>`coalesce(sum(${transfers.amount}), 0)` })
          .from(transfers)
          .where(and(eq(transfers.tenantId, tenantId), gte(transfers.timestamp, dayAgo))),
      [],
    );
    const value = row?.value ?? "0";

    return value === "0"
      ? String(fallbackTransfers.reduce((sum, transfer) => sum + Number(transfer.amount), 0))
      : value;
  }),

  activeAgents: publicProcedure.query(async ({ ctx }) => {
    const tenantId = tenantIdFor(ctx);
    const supabaseAgents = await readSupabaseAgents(ctx);

    if (supabaseAgents.length > 0) {
      return supabaseAgents.filter((agent) => agent.status === "active").length;
    }

    if (!canUseDemoFallback(ctx)) {
      return 0;
    }

    const [row] = await readDbOrFallback(
      "analytics.activeAgents",
      () =>
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(agents)
          .where(and(eq(agents.tenantId, tenantId), eq(agents.status, "active"))),
      [],
    );

    return row?.count ?? fallbackAgents.filter((agent) => agent.status === "active").length;
  }),

  threatsBlocked24h: publicProcedure.query(async ({ ctx }) => {
    const tenantId = tenantIdFor(ctx);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const supabaseTransfers = await readSupabaseTransfers(ctx);

    if (supabaseTransfers.length > 0) {
      return supabaseTransfers.filter(
        (transfer) => transfer.verdict === "DENY" || transfer.verdict === "FREEZE",
      ).length;
    }

    if (!canUseDemoFallback(ctx)) {
      return 0;
    }

    const [row] = await readDbOrFallback(
      "analytics.threatsBlocked24h",
      () =>
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(transfers)
          .where(
            and(
              eq(transfers.tenantId, tenantId),
              sql`${transfers.verdict} in ('DENY', 'FREEZE')`,
              gte(transfers.timestamp, dayAgo),
            ),
          ),
      [],
    );

    return (
      row?.count ??
      fallbackTransfers.filter(
        (transfer) => transfer.verdict === "DENY" || transfer.verdict === "FREEZE",
      ).length
    );
  }),

  pendingEscalations: publicProcedure.query(async ({ ctx }) => {
    const tenantId = tenantIdFor(ctx);
    const supabaseEscalations = await readSupabaseEscalations(ctx);

    if (supabaseEscalations.length > 0) {
      return supabaseEscalations.filter((item) => item.status === "PENDING").length;
    }

    if (!canUseDemoFallback(ctx)) {
      return 0;
    }

    const [row] = await readDbOrFallback(
      "analytics.pendingEscalations",
      () =>
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(escalations)
          .where(and(eq(escalations.tenantId, tenantId), eq(escalations.status, "PENDING"))),
      [],
    );

    return row?.count ?? fallbackEscalations.filter((item) => item.status === "PENDING").length;
  }),
});
