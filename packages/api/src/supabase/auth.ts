import type { ApiContext } from "../context";
import { createSupabaseServiceRoleClient, warnSupabase } from "./client";
import { stringField } from "./fields";
import { ownerScope } from "./scope";
import { selectRows } from "./transport";
import { ensureOwnerWorkspaceForWallet } from "./writes";

export async function syncSupabaseAuthSession(user: {
  walletAddress: string;
  tenantId: string;
  role: string;
}) {
  // Checked before anything else: the identity store is shared across hosts,
  // so a multi-tenant deployment must not issue a session at all, including
  // through the "unconfigured" path a storage-less deployment may allow.
  if (process.env.ARCANUM_DEPLOYMENT_MODE === "multi-tenant") {
    throw new Error(
      "multi-tenant mode requires tenant-scoped Supabase identity, which this build does not implement; run single-tenant",
    );
  }
  const client = createSupabaseServiceRoleClient();
  if (!client) {
    return { synced: false as const, reason: "unconfigured" as const };
  }

  try {
    await ensureOwnerWorkspaceForWallet(client, user.walletAddress);
    return { synced: true as const };
  } catch (error) {
    warnSupabase("auth.sync", error);
    return { synced: false as const, reason: "unavailable" as const };
  }
}

/**
 * The workspace a caller belongs to, resolved from their membership rather than
 * from the wallets they happen to own onchain.
 *
 * Ownership of a governed wallet used to be the only way in, which meant a
 * teammate invited to a workspace saw an empty product and a brand new visitor
 * had no way to start one. Membership is the durable answer to "whose data is
 * this", and it survives a wallet being deployed, transferred or retired.
 *
 * Resolved once per request: a single dashboard load fans out into a dozen
 * reads and every one of them asks this question.
 */
export type CallerMembership = { orgId: string; role: string; profileId: string };

const membershipByRequest = new WeakMap<ApiContext, Promise<CallerMembership | null>>();

export function readCallerMembership(ctx: ApiContext): Promise<CallerMembership | null> {
  const wallet = ownerScope(ctx);
  if (!wallet) {
    return Promise.resolve(null);
  }

  const inFlight = membershipByRequest.get(ctx);
  if (inFlight) {
    return inFlight;
  }

  const pending = resolveCallerMembership(ctx, wallet);
  membershipByRequest.set(ctx, pending);
  return pending;
}

/**
 * Drop the cached membership after a write that changes it. Creating a
 * workspace makes the caller a member mid-request, and the rest of that request
 * must not keep reading the answer from before.
 */
export function forgetCallerMembership(ctx: ApiContext) {
  membershipByRequest.delete(ctx);
}

async function resolveCallerMembership(
  ctx: ApiContext,
  wallet: string,
): Promise<CallerMembership | null> {
  const [profile] = await selectRows(ctx, "profiles", {
    filters: { wallet_address: wallet },
    limit: 1,
    select: "id",
  });

  const profileId = profile ? stringField(profile, ["id"]) : "";
  if (!profileId) {
    return null;
  }

  // Oldest membership wins. A profile should only ever have one, but a handful
  // of accounts pre-date that rule, and "whose data am I looking at" cannot be
  // answered differently from one request to the next.
  const [member] = await selectRows(ctx, "organization_members", {
    filters: { profile_id: profileId },
    limit: 1,
    order: "created_at.asc",
    select: "organization_id,role",
  });

  const orgId = member ? stringField(member, ["organization_id"]) : "";
  if (!orgId) {
    return null;
  }

  return { orgId, role: stringField(member, ["role"], "viewer"), profileId };
}
