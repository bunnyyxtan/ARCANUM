import { policies } from "@arcanum/db/schema";
import { agentByWalletInputSchema, arcTestnet, policyUpdateInputSchema } from "@arcanum/shared";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { createPublicClient, http, isAddress } from "viem";
import { z } from "zod";

import { fallbackPolicies } from "../mock-fallback";
import {
  readSupabasePolicy,
  readSupabaseWalletByLooseId,
  recordSupabaseDeployedPolicy,
} from "../supabase";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { canUseDemoFallback, findWalletByLooseId, readDbOrFallback, tenantIdFor } from "./helpers";

function onChainPolicyWriteOnly(): never {
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "Policy updates must be submitted on-chain by the governed wallet owner.",
  });
}

const guardedWalletReadAbi = [
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "owner", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "policy",
    inputs: [],
    outputs: [
      { name: "perTxCap", type: "uint256" },
      { name: "daily24hCap", type: "uint256" },
      { name: "monthlyRollingCap", type: "uint256" },
      { name: "allowedCategories", type: "uint256" },
      { name: "escalationThreshold", type: "uint256" },
      { name: "requireAllowlist", type: "bool" },
    ],
    stateMutability: "view",
  },
] as const;

const arcReadClient = createPublicClient({
  chain: arcTestnet,
  transport: http(undefined, { retryCount: 2, timeout: 15_000 }),
});

const onChainPolicyInputSchema = z.object({
  walletAddress: z
    .string()
    .refine((value) => isAddress(value), { message: "Invalid wallet address" }),
});

const deployedPolicyInputSchema = z.object({
  walletAddress: z
    .string()
    .refine((value) => isAddress(value), { message: "Invalid wallet address" }),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid transaction hash"),
  perTxCap: z.number().nonnegative(),
  dailyCap: z.number().nonnegative(),
  monthlyCap: z.number().nonnegative(),
  escalationThreshold: z.number().nonnegative(),
  allowedCategories: z.array(z.string().min(1)).max(8),
  requireAllowlist: z.boolean(),
});

export const policiesRouter = router({
  readOnChain: publicProcedure.input(onChainPolicyInputSchema).query(async ({ input }) => {
    const address = input.walletAddress as `0x${string}`;

    const bytecode = await arcReadClient.getCode({ address }).catch((error: unknown) => {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Arc Testnet RPC is unavailable. Please retry.",
        cause: error,
      });
    });

    if (!bytecode || bytecode === "0x") {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No governed wallet contract found at this address on Arc Testnet.",
      });
    }

    try {
      const [owner, policy] = await Promise.all([
        arcReadClient.readContract({ address, abi: guardedWalletReadAbi, functionName: "owner" }),
        arcReadClient.readContract({ address, abi: guardedWalletReadAbi, functionName: "policy" }),
      ]);
      return {
        owner,
        policy: {
          perTxCap: policy[0].toString(),
          daily24hCap: policy[1].toString(),
          monthlyRollingCap: policy[2].toString(),
          allowedCategories: policy[3].toString(),
          escalationThreshold: policy[4].toString(),
          requireAllowlist: policy[5],
        },
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to read policy from Arc Testnet. Please retry.",
        cause: error,
      });
    }
  }),

  get: publicProcedure.input(agentByWalletInputSchema).query(async ({ ctx, input }) => {
    if (canUseDemoFallback(ctx)) {
      const wallet = await findWalletByLooseId(ctx, input.walletId);
      return fallbackPolicies.find((policy) => policy.walletId === wallet?.id) ?? null;
    }

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
      "policies.get",
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

    return row ?? fallbackPolicies.find((policy) => policy.walletId === wallet?.id) ?? null;
  }),

  update: protectedProcedure.input(policyUpdateInputSchema).mutation(async ({ ctx, input }) => {
    const wallet = await findWalletByLooseId(ctx, input.walletId);

    if (!wallet) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Wallet not found" });
    }

    return onChainPolicyWriteOnly();
  }),

  /**
   * Mirror a policy revision that is already confirmed on-chain into the read
   * model. Without this the dashboard keeps showing the previous caps while the
   * wallet enforces the new ones.
   */
  recordDeployed: protectedProcedure
    .input(deployedPolicyInputSchema)
    .mutation(async ({ ctx, input }) => {
      const walletAddress = input.walletAddress.toLowerCase();
      const wallet = await readSupabaseWalletByLooseId(ctx, walletAddress);

      if (!wallet || wallet.address.toLowerCase() !== walletAddress) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Governed wallet was not found for the signed-in owner.",
        });
      }

      if (wallet.ownerAddress.toLowerCase() !== ctx.session.walletAddress.toLowerCase()) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only the governed wallet owner can record a policy deployment.",
        });
      }

      const result = await recordSupabaseDeployedPolicy(ctx, wallet, {
        ...input,
        walletAddress: walletAddress as `0x${string}`,
        txHash: input.txHash as `0x${string}`,
      });

      if (!result.ok) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: result.message });
      }

      return result.data;
    }),

  count: publicProcedure.query(async ({ ctx }) => {
    if (canUseDemoFallback(ctx)) {
      return fallbackPolicies.length;
    }

    const tenantId = tenantIdFor(ctx);

    if (!canUseDemoFallback(ctx)) {
      return 0;
    }

    const [row] = await readDbOrFallback(
      "policies.count",
      () =>
        ctx.db
          .select({ count: sql<number>`count(*)::int` })
          .from(policies)
          .where(eq(policies.tenantId, tenantId)),
      [],
    );

    return row?.count ?? fallbackPolicies.length;
  }),
});
