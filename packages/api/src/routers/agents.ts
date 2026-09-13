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
import { formatUnits } from "viem";
import { z } from "zod";

import { verifyCreatedWalletDeployment } from "../chain";
import {
  categoryNamesFromMask,
  readSupabaseAgents,
  readSupabaseEvents,
  readSupabaseLegacyWalletCount,
  readSupabasePolicy,
  readSupabaseTransfers,
  recordSupabaseCreatedWallet,
  syncSupabaseSignerState,
} from "../supabase";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import {
  actorFor,
  failClosed,
  findAgentByWalletLooseId,
  findWalletByLooseId,
  requireChainWalletOwner,
  requireWalletOwner,
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
    .query(async ({ ctx, input }) => {
      const [agents, legacyWalletCount] = await Promise.all([
        readSupabaseAgents(ctx, input?.status),
        readSupabaseLegacyWalletCount(ctx),
      ]);
      return { agents, legacyWalletCount };
    }),

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
      const rows = await readSupabaseTransfers(ctx, {
        walletId: agent.walletId,
        limit: Math.min((page + 1) * pageSize + 1, 1_000),
      });
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
      // A deployment receipt proves who created the wallet, but a delayed
      // retry must not let a former owner mutate the mirror after a later
      // OwnershipTransferred event.
      await requireChainWalletOwner(ctx, input.walletAddress);

      try {
        const deployment = await verifyCreatedWalletDeployment(ctx.publicClient, {
          deployTxHash: input.deployTxHash,
          ownerAddress: ctx.session.walletAddress as `0x${string}`,
          walletAddress: input.walletAddress,
          chainId: input.chainId,
        });
        await requireChainWalletOwner(ctx, input.walletAddress);

        const policy = deployment.initialPolicy;
        const result = await recordSupabaseCreatedWallet(ctx, {
          walletAddress: input.walletAddress,
          ownerAddress: ctx.session.walletAddress as `0x${string}`,
          label: deployment.label,
          deployTxHash: input.deployTxHash,
          chainId: input.chainId,
          perTxCap: formatUnits(policy.perTxCap, 6),
          dailyCap: formatUnits(policy.daily24hCap, 6),
          monthlyCap: formatUnits(policy.monthlyCap, 6),
          escalationThreshold: formatUnits(policy.escalationThreshold, 6),
          allowedCategories: categoryNamesFromMask(Number(policy.allowedCategories)),
          requireAllowlist: policy.requireAllowlist,
          freezeOnBlockedVendor: policy.freezeOnBlockedVendor,
          signers: [...deployment.initialSigners],
          council: [...deployment.escalationCouncil],
          quorum: deployment.quorum,
        });

        if (result.ok) {
          return {
            dataSource: "supabase" as const,
            wallet: result.data.wallet,
            agent: result.data.agent,
          };
        }

        if (result.reason === "forbidden") {
          throw new TRPCError({ code: "FORBIDDEN", message: result.message });
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
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "The deployment transaction is not a successful WalletCreated event for this owner and wallet.",
          cause: error,
        });
      }
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

      // Resolve by chain wallet address without trusting the read model's
      // owner_address. Ownership can be one event ahead of Supabase while an
      // OwnershipTransferred mirror update is being retried.
      const wallet = await requireWalletOwner(ctx, input.walletAddress);

      const result = await syncSupabaseSignerState(ctx, {
        signerAddress,
        wallet,
      });

      if (!result.ok) {
        throw new TRPCError({
          code: result.reason === "forbidden" ? "FORBIDDEN" : "SERVICE_UNAVAILABLE",
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
