import type { ApiContext } from "./context";
import { readSupabaseWallets } from "./supabase";

/**
 * Organisation and team membership, backed by Supabase.
 *
 * These reads used to go through the Drizzle client, which has no database
 * production can reach, so the workspace name in the header and the whole team
 * list on the settings page failed on the live site. Supabase is the read model
 * every other surface already uses.
 *
 * A caller is scoped to the organisation that owns their governed wallets,
 * which is the same anchor the wallet, ledger and vendor surfaces use.
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
 * The caller's organisation, together with the wallet that anchors it. Both
 * come from the same governed wallet lookup, so an account with no wallet has
 * no organisation rather than a guessed one.
 */
async function callerOrg(ctx: ApiContext): Promise<{ orgId: string; ownerWallet: string } | null> {
  const wallets = await readSupabaseWallets(ctx);
  const anchor = wallets.find((wallet) => Boolean(wallet.orgId));
  if (!anchor?.orgId) {
    return null;
  }
  return {
    orgId: anchor.orgId,
    ownerWallet: anchor.ownerAddress ?? anchor.address,
  };
}

function organizationFrom(
  row: Row,
  anchor: { orgId: string; ownerWallet: string },
): StoredOrganization {
  return {
    id: text(row, "id") ?? anchor.orgId,
    name: text(row, "name") ?? "Arcanum Workspace",
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

  return row ? organizationFrom(row, anchor) : null;
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
  if (!anchor) {
    return null;
  }

  const [row] = await client.patchRows(
    ORGANIZATIONS_TABLE,
    { name, updated_at: new Date().toISOString() },
    { id: anchor.orgId },
  );

  return row ? organizationFrom(row, anchor) : null;
}
