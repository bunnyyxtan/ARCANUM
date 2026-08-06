import { FALLBACK_TENANT_ID } from "@arcanum/db";
import { orgUpdateInputSchema } from "@arcanum/shared";
import { TRPCError } from "@trpc/server";

import { fallbackOrgId } from "../mock-fallback";
import {
  readSupabaseOrgMembers,
  readSupabaseOrganization,
  renameSupabaseOrganization,
} from "../supabase-org";
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

type OrgContext = Parameters<typeof tenantIdFor>[0] & {
  session: { walletAddress: string } | null;
};

async function currentOrgFor(ctx: OrgContext) {
  // Signed out there is no organisation to look up, and the header says so
  // rather than reporting an outage.
  if (!ctx.session) {
    return orgForSession(ctx);
  }

  const stored = await failClosed("org.getCurrent", () => readSupabaseOrganization(ctx));

  return stored ? { ...baseOrg, ...stored, tenantId: tenantIdFor(ctx) } : orgForSession(ctx);
}

export const orgRouter = router({
  currentOrg: publicProcedure.query(({ ctx }) => currentOrgFor(ctx)),

  getCurrent: publicProcedure.query(({ ctx }) => currentOrgFor(ctx)),

  members: publicProcedure.query(({ ctx }) => listMembersFor(ctx)),

  listMembers: publicProcedure.query(({ ctx }) => listMembersFor(ctx)),

  update: protectedProcedure.input(orgUpdateInputSchema).mutation(async ({ ctx, input }) => {
    requireRole(ctx.session.role, ["owner"]);
    const updated = await failClosed("org.update", () =>
      renameSupabaseOrganization(ctx, input.name),
    );

    if (!updated) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Organization settings could not be saved to the live read model.",
      });
    }

    return {
      organization: { ...baseOrg, ...updated, tenantId: tenantIdFor(ctx) },
      defaultPolicyTemplate: input.defaultPolicyTemplate,
      notifications: input.notifications,
    };
  }),
});

// Team membership fails closed: a read-model outage must not render an empty
// member list that looks like everyone lost access. Signed out is different --
// there is no team to show, and an empty list is the truthful answer.
function listMembersFor(ctx: OrgContext) {
  if (!ctx.session) {
    return Promise.resolve([]);
  }

  return failClosed("org.listMembers", () => readSupabaseOrgMembers(ctx));
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
