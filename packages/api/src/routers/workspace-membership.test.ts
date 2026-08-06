import { describe, expect, it, vi } from "vitest";

import type { ApiContext } from "../context";
import { readSupabaseWallets } from "../supabase";
import { orgRouter } from "./org";

// What a caller may see used to depend on which governed wallets they owned on
// chain. That made a workspace unshareable: an invited teammate owns none of
// them, so the product rendered empty for everyone but the deployer. Membership
// is the anchor now, and these tests pin down both halves of the change -- a
// teammate sees the workspace, and a stranger still sees only their own.

process.env.ARCANUM_DEMO_OWNER_WALLET = "0x1111111111111111111111111111111111111111";

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG = "22222222-2222-4222-8222-222222222222";
const TENANT = "00000000-0000-0000-0000-000000000001";

const OWNER = "0x1111111111111111111111111111111111111111";
const TEAMMATE = "0x2222222222222222222222222222222222222222";
const STRANGER = "0x3333333333333333333333333333333333333333";
const NEWCOMER = "0x4444444444444444444444444444444444444444";

type Row = Record<string, unknown>;

function createReadModel() {
  let tick = 0;
  const stamp = () => new Date(Date.UTC(2026, 0, 1) + tick++ * 1000).toISOString();

  const wallet = (id: string, orgId: string, owner: string): Row => ({
    id,
    organization_id: orgId,
    wallet_address: `0xaaaa${id.padEnd(36, "0")}`.slice(0, 42),
    owner_address: owner,
    label: id,
    status: "active",
    created_at: stamp(),
  });

  const tables: Record<string, Row[]> = {
    governed_wallets: [
      wallet("wallet-a", ORG, OWNER),
      wallet("wallet-b", ORG, OWNER),
      // Owned by the workspace owner but filed under a different organisation,
      // the way pre-workspace data was.
      wallet("wallet-legacy", OTHER_ORG, OWNER),
      wallet("wallet-stranger", OTHER_ORG, STRANGER),
    ],
    organizations: [{ id: ORG, name: "Arcanum Workspace", created_at: stamp() }],
    organization_members: [
      { id: "m-owner", organization_id: ORG, profile_id: "p-owner", role: "owner" },
      { id: "m-mate", organization_id: ORG, profile_id: "p-mate", role: "viewer" },
    ],
    profiles: [
      { id: "p-owner", wallet_address: OWNER, display_name: "Owner", created_at: stamp() },
      { id: "p-mate", wallet_address: TEAMMATE, display_name: "Teammate", created_at: stamp() },
      { id: "p-lone", wallet_address: STRANGER, display_name: "Stranger", created_at: stamp() },
    ],
  };

  const tableOf = (name: string): Row[] => {
    const rows = tables[name];
    if (!rows) {
      throw new Error(`an unexpected table was read: ${name}`);
    }
    return rows;
  };

  const matches = (row: Row, filters?: Record<string, unknown>) =>
    Object.entries(filters ?? {}).every(([key, value]) => row[key] === value);

  const callFunction = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    if (fn === "workspace_create") {
      return {
        id: "33333333-3333-4333-8333-333333333333",
        name: args.p_name,
        slug: "fresh-workspace",
        created_at: stamp(),
      };
    }
    return { member: { id: "m-new", role: args.p_role ?? "viewer" } };
  });

  const client = {
    selectRows: async (table: string, opts?: { filters?: Record<string, unknown>; limit?: number }) => {
      const options = opts ?? {};
      const rows = tableOf(table).filter((row) => matches(row, options.filters));
      return (options.limit ? rows.slice(0, options.limit) : rows).map((row) => ({ ...row }));
    },
    patchRows: async (table: string, patch: Row, filters: Record<string, unknown>) => {
      const hits = tableOf(table).filter((row) => matches(row, filters));
      for (const row of hits) {
        Object.assign(row, patch);
      }
      return hits.map((row) => ({ ...row }));
    },
    upsertRows: async () => {
      throw new Error("these paths must not insert rows directly");
    },
    callFunction,
  };

  return { client, tables, callFunction };
}

function contextFor(
  actor: string | null,
  readModel: ReturnType<typeof createReadModel>,
): ApiContext {
  return {
    db: null as never,
    session: actor
      ? { walletAddress: actor, tenantId: TENANT, role: "viewer", expiresAt: Date.now() + 60_000 }
      : null,
    publicClient: null as never,
    supabase: readModel.client as unknown as ApiContext["supabase"],
    requestFingerprint: null,
    env: { authConfigured: true, allowDevAuth: false },
  } as unknown as ApiContext;
}

const callerFor = (actor: string | null, readModel: ReturnType<typeof createReadModel>) =>
  orgRouter.createCaller(contextFor(actor, readModel));

describe("workspace scoping", () => {
  it("shows a teammate the workspace's wallets even though they own none", async () => {
    const readModel = createReadModel();

    const wallets = await readSupabaseWallets(contextFor(TEAMMATE, readModel));

    expect(wallets.map((entry) => entry.id).sort()).toEqual(["wallet-a", "wallet-b"]);
  });

  it("keeps showing an owner the wallets they own outside their workspace", async () => {
    const readModel = createReadModel();

    const wallets = await readSupabaseWallets(contextFor(OWNER, readModel));

    expect(wallets.map((entry) => entry.id).sort()).toEqual([
      "wallet-a",
      "wallet-b",
      "wallet-legacy",
    ]);
  });

  it("shows a wallet with no membership only what it owns", async () => {
    const readModel = createReadModel();

    const wallets = await readSupabaseWallets(contextFor(STRANGER, readModel));

    expect(wallets.map((entry) => entry.id)).toEqual(["wallet-stranger"]);
  });

  it("shows a signed-out caller nothing", async () => {
    const readModel = createReadModel();

    expect(await readSupabaseWallets(contextFor(null, readModel))).toEqual([]);
  });

  it("names the workspace for a teammate instead of claiming they have none", async () => {
    const readModel = createReadModel();

    const org = await callerFor(TEAMMATE, readModel).currentOrg();

    expect(org.name).toBe("Arcanum Workspace");
  });

  it("still says there is no workspace for a wallet that belongs to none", async () => {
    const readModel = createReadModel();

    const org = await callerFor(NEWCOMER, readModel).currentOrg();

    expect(org.name).toBe("No Workspace Yet");
  });
});

describe("workspace provisioning", () => {
  it("creates a workspace for a newcomer and hands the name to the database", async () => {
    const readModel = createReadModel();

    const org = await callerFor(NEWCOMER, readModel).create({ name: "Fresh Workspace" });

    expect(org.name).toBe("Fresh Workspace");
    expect(readModel.callFunction).toHaveBeenCalledWith("workspace_create", {
      p_wallet: NEWCOMER,
      p_name: "Fresh Workspace",
    });
  });

  it("reports a second workspace as a conflict rather than an outage", async () => {
    const readModel = createReadModel();
    readModel.callFunction.mockRejectedValueOnce(
      new Error("rpc workspace_create failed with 400: wallet already belongs to a workspace"),
    );

    await expect(callerFor(OWNER, readModel).create({ name: "Second Workspace" })).rejects.toThrow(
      /already has a workspace/i,
    );
  });

  it("refuses to add a teammate when the caller has no workspace, without calling the database", async () => {
    const readModel = createReadModel();

    await expect(
      callerFor(NEWCOMER, readModel).addMember({ walletAddress: TEAMMATE, role: "viewer" }),
    ).rejects.toThrow(/do not have a workspace/i);
    expect(readModel.callFunction).not.toHaveBeenCalled();
  });

  it("passes the database's refusal of a non-owner through as forbidden", async () => {
    const readModel = createReadModel();
    readModel.callFunction.mockRejectedValueOnce(
      new Error(
        "rpc workspace_add_member failed with 400: workspace_add_member: only a workspace owner can change membership",
      ),
    );

    await expect(
      callerFor(TEAMMATE, readModel).addMember({ walletAddress: NEWCOMER, role: "viewer" }),
    ).rejects.toThrow(/only a workspace owner/i);
  });

  it("explains that the last owner cannot be removed", async () => {
    const readModel = createReadModel();
    readModel.callFunction.mockRejectedValueOnce(
      new Error(
        "rpc workspace_remove_member failed with 400: a workspace must keep at least one owner",
      ),
    );

    await expect(
      callerFor(OWNER, readModel).removeMember({ walletAddress: OWNER }),
    ).rejects.toThrow(/at least one owner/i);
  });

  it("adds a teammate to the caller's workspace and reports the new team", async () => {
    const readModel = createReadModel();

    const result = await callerFor(OWNER, readModel).addMember({
      walletAddress: NEWCOMER,
      role: "approver",
    });

    expect(readModel.callFunction).toHaveBeenCalledWith("workspace_add_member", {
      p_org: ORG,
      p_actor: OWNER,
      p_wallet: NEWCOMER,
      p_role: "approver",
    });
    expect(result.members.map((member) => member.walletAddress)).toContain(TEAMMATE);
  });
});
