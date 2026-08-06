import { FALLBACK_TENANT_ID } from "@arcanum/db";
import {
  orgCreateInputSchema,
  orgMemberAddInputSchema,
  orgMemberRemoveInputSchema,
  orgUpdateInputSchema,
} from "@arcanum/shared";
import { TRPCError } from "@trpc/server";

import { fallbackOrgId } from "../mock-fallback";
import { DEFAULT_WORKSPACE_NAME, readCallerMembership, readModelUnavailable } from "../supabase";
import {
  addWorkspaceMember,
  createWorkspaceForCaller,
  readSupabaseOrgMembers,
  readSupabaseOrganization,
  removeWorkspaceMember,
  renameSupabaseOrganization,
} from "../supabase-org";
import { protectedProcedure, publicProcedure, router } from "../trpc";
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
  // The client has to tell three states apart -- not signed in, signed in with
  // no workspace, and signed in with one -- to know whether to offer sign-in,
  // offer to create a workspace, or render the product. Matching on the
  // workspace name would work until someone names their workspace badly.
  isSignedIn: false,
  hasWorkspace: false,
  // Sign-in provisions a workspace under a placeholder name shared by every new
  // workspace. Saying whether it still carries that placeholder is what lets the
  // product ask its owner to name it once, instead of leaving every workspace on
  // earth called the same thing.
  hasCustomName: false,
  callerRole: null as string | null,
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
  if (!stored) {
    return orgForSession(ctx);
  }

  const membership = await failClosed("org.getCurrent.membership", () =>
    readCallerMembership(ctx),
  );

  return {
    ...baseOrg,
    ...stored,
    tenantId: tenantIdFor(ctx),
    isSignedIn: true,
    hasWorkspace: true,
    hasCustomName: stored.name !== DEFAULT_WORKSPACE_NAME,
    callerRole: membership?.role ?? null,
  };
}

export const orgRouter = router({
  currentOrg: publicProcedure.query(({ ctx }) => currentOrgFor(ctx)),

  getCurrent: publicProcedure.query(({ ctx }) => currentOrgFor(ctx)),

  members: publicProcedure.query(({ ctx }) => listMembersFor(ctx)),

  listMembers: publicProcedure.query(({ ctx }) => listMembersFor(ctx)),

  // Self-serve provisioning. Until this existed, a wallet that had never been
  // added to the database by hand signed in to an empty product with no way
  // forward.
  create: protectedProcedure.input(orgCreateInputSchema).mutation(async ({ ctx, input }) => {
    const organization = await workspaceWrite("org.create", () =>
      createWorkspaceForCaller(ctx, input.name),
    );

    return {
      ...baseOrg,
      ...organization,
      tenantId: tenantIdFor(ctx),
      isSignedIn: true,
      hasWorkspace: true,
      hasCustomName: organization.name !== DEFAULT_WORKSPACE_NAME,
      callerRole: "owner" as string | null,
    };
  }),

  addMember: protectedProcedure.input(orgMemberAddInputSchema).mutation(async ({ ctx, input }) => {
    const added = await workspaceWrite("org.addMember", () =>
      addWorkspaceMember(ctx, input.walletAddress, input.role),
    );

    if (!added) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "You do not have a workspace to add people to yet.",
      });
    }

    return { members: await listMembersFor(ctx) };
  }),

  removeMember: protectedProcedure
    .input(orgMemberRemoveInputSchema)
    .mutation(async ({ ctx, input }) => {
      const outcome = await workspaceWrite("org.removeMember", () =>
        removeWorkspaceMember(ctx, input.walletAddress),
      );

      if (outcome === null) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "You do not have a workspace yet.",
        });
      }

      return { members: await listMembersFor(ctx) };
    }),

  update: protectedProcedure.input(orgUpdateInputSchema).mutation(async ({ ctx, input }) => {
    // Who may rename is decided by the database, in the same transaction as the
    // rename itself. The session's own role field is useless here: it comes
    // from a user table production cannot reach, so every caller -- the real
    // owner included -- arrives claiming to be a viewer.
    const updated = await workspaceWrite("org.update", () =>
      renameSupabaseOrganization(ctx, input.name),
    );

    if (!updated) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "You do not have a workspace to rename yet.",
      });
    }

    return {
      organization: { ...baseOrg, ...updated, tenantId: tenantIdFor(ctx) },
      defaultPolicyTemplate: input.defaultPolicyTemplate,
      notifications: input.notifications,
    };
  }),
});

// The rules about workspaces -- one per wallet, at least one owner, only an
// owner may change access -- are enforced in the database, because that is the
// only place two simultaneous callers can be arbitrated. Their messages are
// therefore the only explanation of why a write was refused, so they are
// translated here into something the caller can act on. Anything unrecognised
// is still treated as an outage rather than reported as the user's fault.
const workspaceWriteErrors: Array<[RegExp, TRPCError["code"], string]> = [
  [
    /only a workspace owner can rename/i,
    "FORBIDDEN",
    "Only the workspace owner can change these settings.",
  ],
  [/only a workspace owner/i, "FORBIDDEN", "Only a workspace owner can change who has access."],
  [/workspace does not exist/i, "NOT_FOUND", "That workspace no longer exists."],
  [
    /already belongs to another workspace/i,
    "CONFLICT",
    "That wallet already belongs to another workspace.",
  ],
  [/already belongs to a workspace/i, "CONFLICT", "This wallet already has a workspace."],
  [/at least one owner/i, "BAD_REQUEST", "A workspace has to keep at least one owner."],
  [/unknown role/i, "BAD_REQUEST", "That role does not exist."],
  [/not a valid address/i, "BAD_REQUEST", "That is not a valid wallet address."],
  [/2 to 120 characters/i, "BAD_REQUEST", "A workspace name has to be 2 to 120 characters."],
];

async function workspaceWrite<T>(label: string, operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    for (const [pattern, code, explanation] of workspaceWriteErrors) {
      if (pattern.test(message)) {
        throw new TRPCError({ code, message: explanation });
      }
    }

    throw readModelUnavailable(label, error);
  }
}

// Team membership fails closed: a read-model outage must not render an empty
// member list that looks like everyone lost access. Signed out is different --
// there is no team to show, and an empty list is the truthful answer.
function listMembersFor(ctx: OrgContext) {
  if (!ctx.session) {
    return Promise.resolve([]);
  }

  return failClosed("org.listMembers", () => readSupabaseOrgMembers(ctx));
}

// A signed-in wallet that governs nothing yet has no organisation to name, and
// saying so is honest. Inventing a plausible workspace name here would make an
// unprovisioned account -- or a wiped one -- look like a healthy one.
function orgForSession(ctx: { session: { walletAddress: string } | null }) {
  const wallet = ctx.session?.walletAddress ?? "0x0000000000000000000000000000000000000000";
  return {
    ...baseOrg,
    name: ctx.session ? "No Workspace Yet" : "Connect Wallet",
    ownerWallet: wallet,
    multisigAddress: wallet,
    isSignedIn: Boolean(ctx.session),
    hasWorkspace: false,
  };
}
