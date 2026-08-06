import { FALLBACK_TENANT_ID } from "@arcanum/db";
import { organizations, users } from "@arcanum/db/schema";
import { orgUpdateInputSchema } from "@arcanum/shared";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";

import { fallbackOrgId } from "../mock-fallback";
import { protectedProcedure, publicProcedure, requireRole, router } from "../trpc";
import { failClosed, tenantIdFor } from "./helpers";

const baseOrg = {
  id: fallbackOrgId,
  tenantId: FALLBACK_TENANT_ID,
  name: "Live Workspace",
  type: "DAO" as const,
  createdAt: new Date("2026-06-08T02:00:00.000Z"),
  ownerWallet: "0x0000000000000000000000000000000000000000",
  multisigAddress: "0x0000000000000000000000000000000000000000",
  chainId: 5042002,
};

async function currentOrgFor(ctx: Parameters<typeof tenantIdFor>[0]) {
  const tenantId = tenantIdFor(ctx);
  const stored = await failClosed("org.getCurrent", () =>
    ctx.db.query.organizations.findFirst({
      where: eq(organizations.tenantId, tenantId),
    }),
  );

  return stored ?? orgForSession(ctx);
}

export const orgRouter = router({
  currentOrg: publicProcedure.query(({ ctx }) => currentOrgFor(ctx)),

  getCurrent: publicProcedure.query(({ ctx }) => currentOrgFor(ctx)),

  members: publicProcedure.query(({ ctx }) => listMembersFor(ctx)),

  listMembers: publicProcedure.query(({ ctx }) => listMembersFor(ctx)),

  update: protectedProcedure.input(orgUpdateInputSchema).mutation(async ({ ctx, input }) => {
    const tenantId = tenantIdFor(ctx);
    requireRole(ctx.session.role, ["owner"]);
    const [updated] = await failClosed("org.update", () =>
      ctx.db
        .update(organizations)
        .set({ name: input.name })
        .where(eq(organizations.tenantId, tenantId))
        .returning(),
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

// Team membership fails closed: a database outage must not render an empty
// member list that looks like everyone lost access.
function listMembersFor(ctx: Parameters<typeof tenantIdFor>[0]) {
  const tenantId = tenantIdFor(ctx);
  return failClosed("org.listMembers", () =>
    ctx.db.query.users.findMany({
      where: eq(users.tenantId, tenantId),
      orderBy: desc(users.createdAt),
    }),
  );
}

function orgForSession(ctx: { session: { walletAddress: string } | null }) {
  const wallet = ctx.session?.walletAddress ?? "0x0000000000000000000000000000000000000000";
  return {
    ...baseOrg,
    name: ctx.session ? "Live Workspace" : "Connect Wallet",
    ownerWallet: wallet,
    multisigAddress: wallet,
  };
}
