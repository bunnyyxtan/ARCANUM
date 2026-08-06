import { describe, expect, it } from "vitest";

import type { ApiContext } from "../context";
import { orgRouter } from "./org";

// Who may rename the workspace is decided by the read model, never by the role
// carried in the session. That role is loaded from a user table production
// cannot reach, so in production every caller -- including the real owner --
// arrives as a viewer. These tests pin the rule down: membership decides, and a
// session claiming otherwise changes nothing in either direction.

// The wallet mapper resolves an owner fallback from the environment; without it
// it reaches for a demo fixture that does not exist in a unit test run.
process.env.ARCANUM_DEMO_OWNER_WALLET = "0x1111111111111111111111111111111111111111";

const ORG = "11111111-1111-4111-8111-111111111111";
const TENANT = "00000000-0000-0000-0000-000000000001";

const OWNER = "0x1111111111111111111111111111111111111111";
const TEAMMATE = "0x2222222222222222222222222222222222222222";
const OUTSIDER = "0x3333333333333333333333333333333333333333";

type Row = Record<string, unknown>;

function createReadModel() {
  let tick = 0;
  const stamp = () => new Date(Date.UTC(2026, 0, 1) + tick++ * 1000).toISOString();

  const walletFor = (owner: string): Row => ({
    id: `wallet-${owner.slice(2, 6)}`,
    organization_id: ORG,
    wallet_address: `0xaaaa${owner.slice(6)}`,
    owner_address: owner,
    label: "Test wallet",
    status: "active",
    created_at: stamp(),
  });

  const profileFor = (wallet: string, name: string): Row => ({
    id: `profile-${wallet.slice(2, 6)}`,
    wallet_address: wallet,
    display_name: name,
    created_at: stamp(),
  });

  const tables = {
    // Every caller governs a wallet in the same organisation, so membership --
    // not wallet ownership -- is the only thing separating them.
    governed_wallets: [walletFor(OWNER), walletFor(TEAMMATE), walletFor(OUTSIDER)],
    organizations: [{ id: ORG, name: "Arcanum Workspace", created_at: stamp() }] as Row[],
    organization_members: [
      { id: "member-owner", organization_id: ORG, profile_id: "profile-1111", role: "owner" },
      { id: "member-mate", organization_id: ORG, profile_id: "profile-2222", role: "approver" },
    ] as Row[],
    profiles: [profileFor(OWNER, "Owner"), profileFor(TEAMMATE, "Teammate")] as Row[],
  };

  const tableOf = (name: string): Row[] => {
    const rows = (tables as Record<string, Row[]>)[name];
    if (!rows) {
      throw new Error(`the organisation router touched an unexpected table: ${name}`);
    }
    return rows;
  };

  const matches = (row: Row, filters?: Record<string, unknown>) =>
    Object.entries(filters ?? {}).every(([key, value]) => row[key] === value);

  const client = {
    selectRows: async (table: string, opts: Record<string, never> | undefined = undefined) => {
      const options = (opts ?? {}) as { filters?: Record<string, unknown>; limit?: number };
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
      throw new Error("renaming a workspace must not insert rows");
    },
  };

  return { client, tables };
}

// Sessions carry a checksummed address while profiles store it lowercased, so
// the caller here is deliberately mixed case.
function callerAs(
  actor: string,
  readModel: ReturnType<typeof createReadModel>,
  role: "owner" | "viewer" = "viewer",
) {
  const ctx = {
    db: null as never,
    session: {
      walletAddress: actor,
      tenantId: TENANT,
      role,
      expiresAt: Date.now() + 60_000,
    },
    publicClient: null as never,
    supabase: readModel.client as unknown as ApiContext["supabase"],
    requestFingerprint: null,
    env: { authConfigured: true, allowDevAuth: false },
  } as unknown as ApiContext;
  return orgRouter.createCaller(ctx);
}

const renameInput = {
  name: "Renamed Workspace",
  defaultPolicyTemplate: "std-research-v3",
  notifications: { email: true, slack: false, discord: false },
};

describe("workspace ownership", () => {
  it("lets the owner rename the workspace even though the session says viewer", async () => {
    const readModel = createReadModel();

    const result = await callerAs(OWNER.toUpperCase().replace("0X", "0x"), readModel).update(
      renameInput,
    );

    expect(result.organization.name).toBe("Renamed Workspace");
    expect(readModel.tables.organizations[0]?.name).toBe("Renamed Workspace");
  });

  it("refuses a teammate who is not the owner and leaves the name alone", async () => {
    const readModel = createReadModel();

    await expect(callerAs(TEAMMATE, readModel).update(renameInput)).rejects.toThrow(/owner/i);
    expect(readModel.tables.organizations[0]?.name).toBe("Arcanum Workspace");
  });

  it("refuses a wallet with no membership, whatever its session claims", async () => {
    const readModel = createReadModel();

    await expect(callerAs(OUTSIDER, readModel, "owner").update(renameInput)).rejects.toThrow(
      /owner/i,
    );
    expect(readModel.tables.organizations[0]?.name).toBe("Arcanum Workspace");
  });
});
