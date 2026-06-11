import { events, agents, policies, transfers, wallets } from "@arcanum/db/schema";
import {
  agentByWalletInputSchema,
  agentCreatedWalletInputSchema,
  agentFreezeInputSchema,
  agentRegisterInputSchema,
  agentStatusSchema,
  pageInputSchema,
  uuidSchema,
} from "@arcanum/shared";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import {
  fallbackAgents,
  fallbackEvents,
  fallbackPolicies,
  fallbackTransfers,
  fallbackWalletRows,
} from "../mock-fallback";
import { readSupabaseAgents, readSupabasePolicy, recordSupabaseCreatedWallet } from "../supabase";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import {
  actorFor,
  canUseDemoFallback,
  findAgentByWalletLooseId,
  findWalletByLooseId,
  readDbOrFallback,
  tenantIdFor,
  writeDbOrFallback,
} from "./helpers";

function onChainAgentRestraintWriteOnly(): never {
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message:
      "Agent restraint changes must be submitted on-chain by the governed wallet owner; this API only reflects indexed state.",
  });
}

export const agentsRouter = router({
  list: publicProcedure
    .input(z.object({ status: agentStatusSchema.optional() }).optional())
    .query(async ({ ctx, input }) => {
      const tenantId = tenantIdFor(ctx);
      const status = input?.status;
      const supabaseRows = await readSupabaseAgents(ctx, status);

      if (supabaseRows.length > 0) {
        return supabaseRows;
      }

      if (!canUseDemoFallback(ctx)) {
        return [];
      }

      const rows = await readDbOrFallback(
        "agents.list",
        () =>
          ctx.db.query.agents.findMany({
            where: status
              ? and(eq(agents.tenantId, tenantId), eq(agents.status, status))
              : eq(agents.tenantId, tenantId),
            orderBy: desc(agents.lastSeenAt),
          }),
        [],
      );

      if (rows.length > 0) {
        return rows;
      }

      return status ? fallbackAgents.filter((agent) => agent.status === status) : fallbackAgents;
    }),

  byWalletId: publicProcedure.input(agentByWalletInputSchema).query(async ({ ctx, input }) => {
    return findAgentByWalletLooseId(ctx, input.walletId);
  }),

  getById: publicProcedure.input(uuidSchema).query(async ({ ctx, input }) => {
    const tenantId = tenantIdFor(ctx);
    if (!canUseDemoFallback(ctx)) {
      return null;
    }

    return (
      (await readDbOrFallback(
        "agents.getById",
        () =>
          ctx.db.query.agents.findFirst({
            where: and(eq(agents.tenantId, tenantId), eq(agents.id, input)),
          }),
        undefined,
      )) ??
      (canUseDemoFallback(ctx) ? fallbackAgents.find((agent) => agent.id === input) : null) ??
      null
    );
  }),

  events: publicProcedure
    .input(agentByWalletInputSchema.merge(pageInputSchema.partial()))
    .query(async ({ ctx, input }) => {
      const tenantId = tenantIdFor(ctx);
      const agent = await findAgentByWalletLooseId(ctx, input.walletId);
      if (!canUseDemoFallback(ctx)) {
        return [];
      }

      const rows = await readDbOrFallback(
        "agents.events",
        () =>
          ctx.db.query.events.findMany({
            where: and(
              eq(events.tenantId, tenantId),
              eq(events.walletId, agent?.walletId ?? input.walletId),
            ),
            orderBy: desc(events.timestamp),
            limit: input.pageSize ?? 50,
            offset: (input.page ?? 0) * (input.pageSize ?? 50),
          }),
        [],
      );

      if (rows.length > 0) {
        return rows;
      }

      return canUseDemoFallback(ctx)
        ? fallbackEvents.filter((event) => event.walletId === agent?.walletId)
        : [];
    }),

  listTransfers: publicProcedure
    .input(agentByWalletInputSchema.merge(pageInputSchema.partial()))
    .query(async ({ ctx, input }) => {
      const tenantId = tenantIdFor(ctx);
      const agent = await findAgentByWalletLooseId(ctx, input.walletId);
      if (!canUseDemoFallback(ctx)) {
        return [];
      }

      const rows = await readDbOrFallback(
        "agents.listTransfers",
        () =>
          ctx.db.query.transfers.findMany({
            where: and(
              eq(transfers.tenantId, tenantId),
              eq(transfers.agentId, agent?.id ?? input.walletId),
            ),
            orderBy: desc(transfers.timestamp),
            limit: input.pageSize ?? 50,
            offset: (input.page ?? 0) * (input.pageSize ?? 50),
          }),
        [],
      );

      if (rows.length > 0) {
        return rows;
      }

      return canUseDemoFallback(ctx)
        ? fallbackTransfers.filter((transfer) => transfer.agentId === agent?.id)
        : [];
    }),

  policy: publicProcedure.input(agentByWalletInputSchema).query(async ({ ctx, input }) => {
    const tenantId = tenantIdFor(ctx);
    const wallet = await findWalletByLooseId(ctx, input.walletId);
    const supabasePolicy = await readSupabasePolicy(ctx, wallet);

    if (supabasePolicy) {
      return supabasePolicy;
    }

    if (!canUseDemoFallback(ctx)) {
      return null;
    }

    const row = await readDbOrFallback(
      "agents.policy",
      () =>
        ctx.db.query.policies.findFirst({
          where: and(
            eq(policies.tenantId, tenantId),
            eq(policies.walletId, wallet?.id ?? input.walletId),
          ),
          orderBy: desc(policies.version),
        }),
      undefined,
    );

    return (
      row ??
      (canUseDemoFallback(ctx)
        ? fallbackPolicies.find((policy) => policy.walletId === wallet?.id)
        : null) ??
      null
    );
  }),

  freeze: protectedProcedure.input(agentFreezeInputSchema).mutation(async ({ ctx, input }) => {
    if (!(await findAgentByWalletLooseId(ctx, input.walletId))) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Agent wallet not found" });
    }

    return onChainAgentRestraintWriteOnly();
  }),

  unfreeze: protectedProcedure.input(agentFreezeInputSchema).mutation(async ({ ctx, input }) => {
    if (!(await findAgentByWalletLooseId(ctx, input.walletId))) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Agent wallet not found" });
    }

    return onChainAgentRestraintWriteOnly();
  }),

  register: protectedProcedure.input(agentRegisterInputSchema).mutation(async ({ ctx, input }) => {
    const tenantId = tenantIdFor(ctx);
    const [wallet] = await writeDbOrFallback(
      "agents.register.insertWallet",
      () =>
        ctx.db
          .insert(wallets)
          .values({
            tenantId,
            orgId: fallbackWalletRows[0]?.orgId ?? "10000000-0000-4000-8000-000000000001",
            address: input.walletAddress,
            label: input.label,
            ownerAddress: actorFor(ctx),
            createdBlock: 0,
            factoryAddress: "0xfac7000000000000000000000000000000000000",
          })
          .onConflictDoNothing()
          .returning(),
      [],
    );

    const persistedWallet = wallet ?? (await findWalletByLooseId(ctx, input.walletAddress));

    if (!persistedWallet) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to register wallet" });
    }

    const [created] = await writeDbOrFallback(
      "agents.register.insertAgent",
      () =>
        ctx.db
          .insert(agents)
          .values({
            tenantId,
            walletId: persistedWallet.id,
            signerAddress: input.signerAddress,
            label: input.label,
            type: input.type,
            lastSeenAt: new Date(),
            status: "active",
          })
          .onConflictDoNothing()
          .returning(),
      [],
    );

    return created ?? findAgentByWalletLooseId(ctx, persistedWallet.id);
  }),

  recordCreatedWallet: protectedProcedure
    .input(agentCreatedWalletInputSchema)
    .mutation(async ({ ctx, input }) => {
      const sessionOwner = ctx.session.walletAddress.toLowerCase();
      if (input.ownerAddress.toLowerCase() !== sessionOwner) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Created wallet owner must match the signed-in wallet.",
        });
      }

      const result = await recordSupabaseCreatedWallet(ctx, {
        ...input,
        ownerAddress: ctx.session.walletAddress as `0x${string}`,
      });

      if (result.ok) {
        return {
          dataSource: "supabase" as const,
          wallet: result.data.wallet,
          agent: result.data.agent,
        };
      }

      return {
        dataSource:
          result.reason === "unconfigured"
            ? ("supabase_unconfigured" as const)
            : ("supabase_failed" as const),
        wallet: null,
        agent: null,
        message: result.message,
      };
    }),
});
