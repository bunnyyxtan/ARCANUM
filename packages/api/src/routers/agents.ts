import { agents, wallets } from "@arcanum/db/schema";
import {
  agentByWalletInputSchema,
  agentCreatedWalletInputSchema,
  agentFreezeInputSchema,
  agentSignerSyncInputSchema,
  agentStatusSchema,
  pageInputSchema,
  uuidSchema,
} from "@arcanum/shared";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  readSupabaseAgents,
  readSupabaseEvents,
  readSupabasePolicy,
  readSupabaseTransfers,
  readSupabaseWalletByLooseId,
  recordSupabaseCreatedWallet,
  syncSupabaseSignerState,
} from "../supabase";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import {
  actorFor,
  failClosed,
  findAgentByWalletLooseId,
  findWalletByLooseId,
  tenantIdFor,
} from "./helpers";

function onChainAgentRestraintWriteOnly(): never {
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message:
      "Agent restraint changes must be submitted onchain by the governed wallet owner; this API only reflects indexed state.",
  });
}

const zeroAddress = "0x0000000000000000000000000000000000000000";

// Agent reads go to the Supabase read model, which fails closed: an outage
// surfaces as "data unavailable" instead of a fleet that looks empty.
export const agentsRouter = router({
  list: publicProcedure
    .input(z.object({ status: agentStatusSchema.optional() }).optional())
    .query(({ ctx, input }) => readSupabaseAgents(ctx, input?.status)),

  byWalletId: publicProcedure.input(agentByWalletInputSchema).query(async ({ ctx, input }) => {
    return findAgentByWalletLooseId(ctx, input.walletId);
  }),

  getById: publicProcedure.input(uuidSchema).query(async ({ ctx, input }) => {
    const rows = await readSupabaseAgents(ctx);
    return rows.find((agent) => agent.id === input) ?? null;
  }),

  events: publicProcedure
    .input(agentByWalletInputSchema.merge(pageInputSchema.partial()))
    .query(async ({ ctx, input }) => {
      const agent = await findAgentByWalletLooseId(ctx, input.walletId);
      if (!agent) {
        return [];
      }

      return readSupabaseEvents(ctx, {
        walletId: agent.walletId,
        page: input.page,
        pageSize: input.pageSize,
      });
    }),

  listTransfers: publicProcedure
    .input(agentByWalletInputSchema.merge(pageInputSchema.partial()))
    .query(async ({ ctx, input }) => {
      const agent = await findAgentByWalletLooseId(ctx, input.walletId);
      if (!agent) {
        return [];
      }

      const page = input.page ?? 0;
      const pageSize = input.pageSize ?? 50;
      const rows = (await readSupabaseTransfers(ctx)).filter(
        (transfer) => transfer.walletId === agent.walletId,
      );
      return rows.slice(page * pageSize, page * pageSize + pageSize);
    }),

  policy: publicProcedure.input(agentByWalletInputSchema).query(async ({ ctx, input }) => {
    const wallet = await findWalletByLooseId(ctx, input.walletId);
    return readSupabasePolicy(ctx, wallet);
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

  // There is deliberately no server-side "register an agent" write. An agent
  // exists because a wallet was deployed onchain and a signer was authorised
  // there; recordCreatedWallet below records that deployment against the
  // signed-in owner. The old register mutation wrote straight to a database
  // production no longer has, under a hardcoded organisation and a placeholder
  // factory address, so it could only ever fail or fabricate.
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

  syncSignerState: protectedProcedure
    .input(agentSignerSyncInputSchema)
    .mutation(async ({ ctx, input }) => {
      const signerAddress = input.signerAddress.toLowerCase() as `0x${string}`;
      if (signerAddress === zeroAddress) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Zero address cannot be an agent signer.",
        });
      }

      const wallet = await readSupabaseWalletByLooseId(ctx, input.walletAddress);
      if (!wallet || wallet.address.toLowerCase() !== input.walletAddress.toLowerCase()) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Governed wallet was not found for the signed-in owner.",
        });
      }

      if (wallet.ownerAddress.toLowerCase() !== ctx.session.walletAddress.toLowerCase()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the governed wallet owner can sync signer state.",
        });
      }

      const result = await syncSupabaseSignerState(ctx, {
        authorized: input.action === "authorize",
        signerAddress,
        wallet,
      });

      if (!result.ok) {
        throw new TRPCError({
          code: "SERVICE_UNAVAILABLE",
          message: result.message,
        });
      }

      return {
        dataSource: "supabase" as const,
        signers: result.data.signers,
        status: result.data.status,
      };
    }),
});
