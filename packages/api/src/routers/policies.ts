import { GuardedWalletAbi } from "@arcanum/contracts";
import {
  ARC_NETWORK_NAME,
  agentByWalletInputSchema,
  arcChain,
  policyUpdateInputSchema,
} from "@arcanum/shared";
import { TRPCError } from "@trpc/server";
import { http, createPublicClient, formatUnits, isAddress } from "viem";
import { z } from "zod";

import { readWalletPolicySnapshot, verifyPolicyUpdatedReceipt } from "../chain";
import {
  categoryNamesFromMask,
  readSupabasePolicies,
  readSupabasePolicy,
  readSupabaseWallets,
  recordSupabaseDeployedPolicy,
} from "../supabase";
import { protectedProcedure, publicProcedure, router } from "../trpc";
import { findWalletByLooseId, requireChainWalletOwner, requireWalletOwner } from "./helpers";

function onChainPolicyWriteOnly(): never {
  throw new TRPCError({
    code: "PRECONDITION_FAILED",
    message: "Policy updates must be submitted onchain by the governed wallet owner.",
  });
}

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
  perTxCap: z.string(),
  dailyCap: z.string(),
  monthlyCap: z.string(),
  escalationThreshold: z.string(),
  allowedCategories: z.array(z.string().min(1)).max(8),
  requireAllowlist: z.boolean(),
  freezeOnBlockedVendor: z.boolean(),
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
          abi: GuardedWalletAbi,
          functionName: "owner",
        }),
        arcReadClient.readContract({
          address,
          abi: GuardedWalletAbi,
          functionName: "policy",
        }),
      ]);
      return {
        owner,
        policy: {
          perTxCap: policy[0].toString(),
          daily24hCap: policy[1].toString(),
          monthlyCap: policy[2].toString(),
          allowedCategories: policy[3].toString(),
          escalationThreshold: policy[4].toString(),
          requireAllowlist: policy[5],
          freezeOnBlockedVendor: policy[6],
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
      const wallet = await requireWalletOwner(ctx, walletAddress);

      let policyEvent: Awaited<ReturnType<typeof verifyPolicyUpdatedReceipt>>;
      try {
        policyEvent = await verifyPolicyUpdatedReceipt(
          ctx.publicClient,
          input.txHash as `0x${string}`,
          walletAddress as `0x${string}`,
        );
      } catch (error) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `The transaction is not a successful policy update on ${ARC_NETWORK_NAME}; nothing was recorded.`,
          cause: error,
        });
      }

      // Re-check immediately before the mirror write so a transfer during
      // receipt verification cannot let the former owner commit metadata.
      await requireChainWalletOwner(ctx, wallet.address);
      const snapshot = await readWalletPolicySnapshot(
        ctx.publicClient,
        wallet.address as `0x${string}`,
      );
      const receiptVersion = Number(policyEvent.version);
      const chainVersion = Number(snapshot.policyVersion);
      const staleReceipt = receiptVersion !== chainVersion;
      const chainPolicy = staleReceipt ? snapshot.policy : policyEvent.policy;

      const result = await recordSupabaseDeployedPolicy(ctx, wallet, {
        walletAddress: walletAddress as `0x${string}`,
        txHash: input.txHash as `0x${string}`,
        perTxCap: formatUnits(chainPolicy.perTxCap, 6),
        dailyCap: formatUnits(chainPolicy.daily24hCap, 6),
        monthlyCap: formatUnits(chainPolicy.monthlyCap, 6),
        escalationThreshold: formatUnits(chainPolicy.escalationThreshold, 6),
        allowedCategories: categoryNamesFromMask(Number(chainPolicy.allowedCategories)),
        requireAllowlist: chainPolicy.requireAllowlist,
        freezeOnBlockedVendor: chainPolicy.freezeOnBlockedVendor,
        version: chainVersion,
      });

      if (!result.ok) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.message,
        });
      }

      return {
        ...result.data,
        staleReceipt,
        message: staleReceipt
          ? `Receipt policy version ${receiptVersion} was stale; current chain version ${chainVersion} was recorded.`
          : undefined,
      };
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
