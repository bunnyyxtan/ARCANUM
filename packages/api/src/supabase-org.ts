import type { ApiContext } from "./context";
import {
  DEFAULT_WORKSPACE_NAME,
  forgetCallerMembership,
  readCallerMembership,
  readSupabaseWallets,
} from "./supabase";

/**
 * Organisation and team membership, backed by Supabase.
 *
 * These reads used to go through the Drizzle client, which has no database
 * production can reach, so the workspace name in the header and the whole team
 * list on the settings page failed on the live site. Supabase is the read model
 * every other surface already uses.
 *
 * A caller is scoped to the organisation they are a member of. Membership, not
 * wallet ownership, is what makes a workspace shared: a teammate who owns no
 * governed wallet still belongs here, and a visitor who belongs to none is
 * offered one rather than shown an empty product.
 */

const ORGANIZATIONS_TABLE = "organizations";
const MEMBERS_TABLE = "organization_members";
const PROFILES_TABLE = "profiles";

export type StoredOrganization = {
  id: string;
  name: string;
  createdAt: Date;
  ownerWallet: string;
  multisigAddress: string;
};

export type OrganizationMember = {
  id: string;
  displayName: string;
  walletAddress: string;
  role: string;
  createdAt: Date | null;
};

type Row = Record<string, unknown>;

function text(row: Row, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function date(row: Row, key: string): Date | null {
  const value = row[key];
  if (typeof value !== "string") {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function orgClient(ctx: ApiContext) {
  const client = ctx.supabase;
  if (!client) {
    throw new Error("Supabase service role is not configured.");
  }
  return client;
}

/**
 * The caller's organisation, together with the wallet that anchors it.
 *
 * Membership decides the organisation. The anchor wallet is only used for
 * display, so a workspace whose first governed wallet has not been deployed yet
 * falls back to the member's own address rather than inventing one.
 */
async function callerOrg(ctx: ApiContext): Promise<{ orgId: string; ownerWallet: string } | null> {
  const [membership, wallets] = await Promise.all([
    readCallerMembership(ctx),
    readSupabaseWallets(ctx),
  ]);

  if (membership) {
    const anchor = wallets.find((wallet) => wallet.orgId === membership.orgId);
    return {
      orgId: membership.orgId,
      ownerWallet:
        anchor?.ownerAddress ?? anchor?.address ?? ctx.session?.walletAddress.toLowerCase() ?? "",
    };
  }

  // No membership row: fall back to the organisation that owns the caller's
  // wallets, which is how every workspace created before this existed is filed.
  const anchor = wallets.find((wallet) => Boolean(wallet.orgId));
  if (!anchor?.orgId) {
    return null;
  }
  return {
    orgId: anchor.orgId,
    ownerWallet: anchor.ownerAddress ?? anchor.address,
  };
}

function rowFromRpc(result: unknown): Row | null {
  const candidate = Array.isArray(result) ? result[0] : result;
  return candidate && typeof candidate === "object" ? (candidate as Row) : null;
}

function organizationFrom(
  row: Row,
  anchor: { orgId: string; ownerWallet: string },
): StoredOrganization {
  return {
    id: text(row, "id") ?? anchor.orgId,
    name: text(row, "name") ?? DEFAULT_WORKSPACE_NAME,
    createdAt: date(row, "created_at") ?? new Date(0),
    ownerWallet: anchor.ownerWallet,
    // The organisation's Safe is the address that actually holds the funds;
    // without one, the wallet that anchors the organisation is the honest
    // stand-in rather than a zero address.
    multisigAddress: text(row, "safe_address") ?? anchor.ownerWallet,
  };
}

export async function readSupabaseOrganization(
  ctx: ApiContext,
): Promise<StoredOrganization | null> {
  const client = orgClient(ctx);
  const anchor = await callerOrg(ctx);
  if (!anchor) {
    return null;
  }

  const [row] = await client.selectRows(ORGANIZATIONS_TABLE, {
    filters: { id: anchor.orgId },
    limit: 1,
  });

  if (!row) {
    // The caller owns a governed wallet whose organisation has gone missing.
    // That is a broken read model, not an account waiting to be set up, and
    // dressing it up as a fresh workspace would hide real data loss.
    throw new Error(`Organization ${anchor.orgId} is missing from the read model.`);
  }

  return organizationFrom(row, anchor);
}

export async function readSupabaseOrgMembers(ctx: ApiContext): Promise<OrganizationMember[]> {
  const client = orgClient(ctx);
  const anchor = await callerOrg(ctx);
  if (!anchor) {
    return [];
  }

  const memberRows = await client.selectRows(MEMBERS_TABLE, {
    filters: { organization_id: anchor.orgId },
    order: "created_at.desc",
  });

  // The REST client filters on equality only, so profiles are resolved one call
  // per member. Membership lists are small, and the alternative -- reading
  // every profile in the database -- would leak other tenants' members.
  const profiles = await Promise.all(
    memberRows.map(async (member) => {
      const profileId = text(member, "profile_id");
      if (!profileId) {
        return null;
      }
      const [profile] = await client.selectRows(PROFILES_TABLE, {
        filters: { id: profileId },
        limit: 1,
      });
      return profile ?? null;
    }),
  );

  return memberRows.flatMap((member, index) => {
    const profile = profiles[index];
    const walletAddress = profile ? text(profile, "wallet_address") : null;
    // A membership row with no reachable profile has no identity to show, and
    // rendering a blank teammate would misrepresent who holds access.
    if (!profile || !walletAddress) {
      return [];
    }
    return [
      {
        id: text(profile, "id") ?? text(member, "id") ?? walletAddress,
        displayName: text(profile, "display_name") ?? walletAddress,
        walletAddress,
        role: text(member, "role") ?? "member",
        createdAt: date(member, "created_at"),
      },
    ];
  });
}

export async function renameSupabaseOrganization(
  ctx: ApiContext,
  name: string,
): Promise<StoredOrganization | null> {
  const client = orgClient(ctx);
  const anchor = await callerOrg(ctx);
  const actor = ctx.session?.walletAddress.toLowerCase();
  if (!anchor || !actor) {
    return null;
  }

  // Ownership is proved inside the function, under the same row lock as the
  // write. Checking it here first and patching afterwards would leave a window
  // in which an owner revoked mid-request still gets their rename through.
  const row = rowFromRpc(
    await client.callFunction("workspace_rename", {
      p_org: anchor.orgId,
      p_actor: actor,
      p_name: name,
    }),
  );

  return row ? organizationFrom(row, anchor) : null;
}

/**
 * Create a workspace for a signed-in wallet that has none, and make that wallet
 * its owner.
 *
 * A profile, an organisation and a membership row change together. Supabase
 * REST has no transactions, so the work happens inside one Postgres function:
 * a half-created workspace -- an organisation nobody owns -- could not be
 * repaired from inside the product.
 */
export async function createWorkspaceForCaller(
  ctx: ApiContext,
  name: string,
): Promise<StoredOrganization> {
  const client = orgClient(ctx);
  const wallet = ctx.session?.walletAddress.toLowerCase();
  if (!wallet) {
    throw new Error("A workspace can only be created for a signed-in wallet.");
  }

  const row = rowFromRpc(
    await client.callFunction("workspace_create", { p_wallet: wallet, p_name: name }),
  );

  if (!row) {
    throw new Error("workspace_create returned no organisation.");
  }

  forgetCallerMembership(ctx);

  return organizationFrom(row, { orgId: text(row, "id") ?? "", ownerWallet: wallet });
}

/**
 * Add a wallet to the caller's workspace, or change the role it already holds.
 * The database checks that the caller is an owner; the API never decides that
 * from the session, which carries no trustworthy role.
 */
export async function addWorkspaceMember(
  ctx: ApiContext,
  memberWallet: string,
  role: string,
): Promise<boolean> {
  const client = orgClient(ctx);
  const anchor = await callerOrg(ctx);
  const actor = ctx.session?.walletAddress.toLowerCase();
  if (!anchor || !actor) {
    return false;
  }

  const result = rowFromRpc(
    await client.callFunction("workspace_add_member", {
      p_org: anchor.orgId,
      p_actor: actor,
      p_wallet: memberWallet.toLowerCase(),
      p_role: role,
    }),
  );

  forgetCallerMembership(ctx);

  return Boolean(result);
}

/**
 * Remove a wallet from the caller's workspace. Removing someone who is not a
 * member reports no change rather than failing, so a double click on the
 * settings page cannot produce a scary error.
 */
export async function removeWorkspaceMember(
  ctx: ApiContext,
  memberWallet: string,
): Promise<boolean | null> {
  const client = orgClient(ctx);
  const anchor = await callerOrg(ctx);
  const actor = ctx.session?.walletAddress.toLowerCase();
  if (!anchor || !actor) {
    // No workspace at all is a different answer from "that person was not in it".
    return null;
  }

  const result = rowFromRpc(
    await client.callFunction("workspace_remove_member", {
      p_org: anchor.orgId,
      p_actor: actor,
      p_wallet: memberWallet.toLowerCase(),
    }),
  );

  forgetCallerMembership(ctx);

  return Boolean(result);
}
