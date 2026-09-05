import {
  ARC_NETWORK_NAME,
  agentByWalletInputSchema,
  arcChain,
  policyUpdateInputSchema,
} from "@arcanum/shared";
import { TRPCError } from "@trpc/server";
import { http, createPublicClient, isAddress } from "viem";
import { z } from "zod";

import { readWalletPolicyChainState } from "../chain";
import {
  categoryNamesFromMask,
  readSupabasePolicies,
  readSupabasePolicy,
  readSupabaseWalletByLooseId,
  readSupabaseWallets,
  recordSupabaseDeployedPolicy,
} from "../supabase";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { findWalletByLooseId } from "./helpers";

function onChainPolicyWriteOnly(): never {
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "Policy updates must be submitted onchain by the governed wallet owner.",
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
  chain: arcChain,
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
        message: `${ARC_NETWORK_NAME} RPC is unavailable. Please retry.`,
        cause: error,
      });
    });

    if (!bytecode || bytecode === "0x") {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: `No governed wallet contract found at this address on ${ARC_NETWORK_NAME}.`,
      });
    }

    try {
      const [owner, policy] = await Promise.all([
        arcReadClient.readContract({
          address,
          abi: guardedWalletReadAbi,
          functionName: "owner",
        }),
        arcReadClient.readContract({
          address,
          abi: guardedWalletReadAbi,
          functionName: "policy",
        }),
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
        message: `Failed to read policy from ${ARC_NETWORK_NAME}. Please retry.`,
        cause: error,
      });
    }
  }),

  // The doctrine is what the dashboard claims the wallet enforces, so it reads
  // the Supabase read model, which fails closed on outage.
  get: publicProcedure.input(agentByWalletInputSchema).query(async ({ ctx, input }) => {
    const wallet = await findWalletByLooseId(ctx, input.walletId);
    return readSupabasePolicy(ctx, wallet);
  }),

  update: protectedProcedure.input(policyUpdateInputSchema).mutation(async ({ ctx, input }) => {
    const wallet = await findWalletByLooseId(ctx, input.walletId);

    if (!wallet) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Wallet not found" });
    }

    return onChainPolicyWriteOnly();
  }),

  /**
   * Mirror a policy revision that is already confirmed onchain into the read
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

      // Never trust the caps the client claims to have deployed: read back what
      // the wallet actually enforces and mirror that.
      const chainPolicy = await readWalletPolicyChainState(walletAddress as `0x${string}`);

      if (!chainPolicy) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            `The wallet policy could not be read from ${ARC_NETWORK_NAME}; ` +
            "nothing was recorded.",
        });
      }

      const toUsdc = (value: bigint) => Number(value) / 1e6;

      const result = await recordSupabaseDeployedPolicy(ctx, wallet, {
        walletAddress: walletAddress as `0x${string}`,
        txHash: input.txHash as `0x${string}`,
        perTxCap: toUsdc(chainPolicy.perTxCap),
        dailyCap: toUsdc(chainPolicy.daily24hCap),
        monthlyCap: toUsdc(chainPolicy.monthlyRollingCap),
        escalationThreshold: toUsdc(chainPolicy.escalationThreshold),
        allowedCategories: categoryNamesFromMask(Number(chainPolicy.allowedCategories)),
        requireAllowlist: chainPolicy.requireAllowlist,
      });

      if (!result.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.message,
        });
      }

      return result.data;
    }),

  count: publicProcedure.query(async ({ ctx }) => {
    // Count the doctrines of every governed wallet the caller owns from the
    // read model; a read-model outage fails closed rather than reporting zero.
    const wallets = await readSupabaseWallets(ctx);
    const policiesPerWallet = await Promise.all(
      wallets.map((wallet) => readSupabasePolicies(ctx, wallet)),
    );
    return policiesPerWallet.reduce((sum, rows) => sum + rows.length, 0);
  }),
});
