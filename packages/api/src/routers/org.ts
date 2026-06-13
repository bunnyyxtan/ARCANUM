import { FALLBACK_TENANT_ID } from "@arcanum/db";
import { organizations, users } from "@arcanum/db/schema";
import { orgUpdateInputSchema } from "@arcanum/shared";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";

import { fallbackMembers, fallbackOrgId } from "../mock-fallback";
import { protectedProcedure, publicProcedure, requireRole, router } from "../trpc";
import { canUseDemoFallback, readDbOrFallback, tenantIdFor, writeDbOrFallback } from "./helpers";

const fallbackOrg = {
  id: fallbackOrgId,
  tenantId: FALLBACK_TENANT_ID,
  name: "Demo Workspace",
  type: "DAO" as const,
  createdAt: new Date("2026-06-08T02:00:00.000Z"),
  ownerWallet:
    process.env.ARCANUM_DEMO_OWNER_WALLET ?? "0x70b474010e1bf0c4a087a3eadeb157ea515872f6",
  multisigAddress: "0x1111000000000000000000000000000000000da0",
  chainId: 5042002,
};

export const orgRouter = router({
  currentOrg: publicProcedure.query(async ({ ctx }) => {
    if (canUseDemoFallback(ctx)) {
      return fallbackOrg;
    }

    const tenantId = tenantIdFor(ctx);
    const emptyOrg = orgForSession(ctx);
    if (!canUseDemoFallback(ctx)) {
      return emptyOrg;
    }

    return (
      (await readDbOrFallback(
        "org.currentOrg",
        () =>
          ctx.db.query.organizations.findFirst({
            where: eq(organizations.tenantId, tenantId),
          }),
        undefined,
      )) ?? (canUseDemoFallback(ctx) ? fallbackOrg : emptyOrg)
    );
  }),

  getCurrent: publicProcedure.query(async ({ ctx }) => {
    if (canUseDemoFallback(ctx)) {
      return fallbackOrg;
    }

    const tenantId = tenantIdFor(ctx);
    const emptyOrg = orgForSession(ctx);
    if (!canUseDemoFallback(ctx)) {
      return emptyOrg;
    }

    return (
      (await readDbOrFallback(
        "org.getCurrent",
        () =>
          ctx.db.query.organizations.findFirst({
            where: eq(organizations.tenantId, tenantId),
          }),
        undefined,
      )) ?? (canUseDemoFallback(ctx) ? fallbackOrg : emptyOrg)
    );
  }),

  members: publicProcedure.query(async ({ ctx }) => {
    if (canUseDemoFallback(ctx)) {
      return fallbackMembers;
    }

    const tenantId = tenantIdFor(ctx);
    if (!canUseDemoFallback(ctx)) {
      return [];
    }

    const rows = await readDbOrFallback(
      "org.members",
      () =>
        ctx.db.query.users.findMany({
          where: eq(users.tenantId, tenantId),
          orderBy: desc(users.createdAt),
        }),
      [],
    );

    return rows.length > 0 ? rows : canUseDemoFallback(ctx) ? fallbackMembers : [];
  }),

  listMembers: publicProcedure.query(async ({ ctx }) => {
    if (canUseDemoFallback(ctx)) {
      return fallbackMembers;
    }

    const tenantId = tenantIdFor(ctx);
    if (!canUseDemoFallback(ctx)) {
      return [];
    }

    const rows = await readDbOrFallback(
      "org.listMembers",
      () =>
        ctx.db.query.users.findMany({
          where: eq(users.tenantId, tenantId),
          orderBy: desc(users.createdAt),
        }),
      [],
    );

    return rows.length > 0 ? rows : canUseDemoFallback(ctx) ? fallbackMembers : [];
  }),

  update: protectedProcedure.input(orgUpdateInputSchema).mutation(async ({ ctx, input }) => {
    const tenantId = tenantIdFor(ctx);
    requireRole(ctx.session.role, ["owner"]);
    const [updated] = await writeDbOrFallback(
      "org.update",
      () =>
        ctx.db
          .update(organizations)
          .set({ name: input.name })
          .where(eq(organizations.tenantId, tenantId))
          .returning(),
      [],
    );

    if (!updated) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Organization settings could not be saved to the live read model.",
      });
    }

    return {
      organization: updated,
      defaultPolicyTemplate: input.defaultPolicyTemplate,
      notifications: input.notifications,
    };
  }),
});

function orgForSession(ctx: { session: { walletAddress: string } | null }) {
  const wallet = ctx.session?.walletAddress ?? "0x0000000000000000000000000000000000000000";
  return {
    ...fallbackOrg,
    name: ctx.session ? "Live Workspace" : "Connect Wallet",
    ownerWallet: wallet,
    multisigAddress: wallet,
  };
}
