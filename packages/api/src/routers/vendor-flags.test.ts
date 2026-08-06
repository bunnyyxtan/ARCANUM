import { describe, expect, it } from "vitest";

import type { ApiContext } from "../context";
import { vendorFlagsRouter } from "./vendor-flags";

// The review trail's guarantees -- append-only history, idempotent unflag, a
// re-flag that resets the live row, and strict organisation isolation -- are
// properties of the router, so they are exercised against a stand-in read model
// rather than a live database. Production storage is shared, and a test that
// writes real review records into it would corrupt an audit trail.

// The read model resolves an owner fallback from the environment while mapping
// wallet rows; without it the mapper reaches for a demo fixture that does not
// exist in a unit test run.
process.env.ARCANUM_DEMO_OWNER_WALLET = "0x1111111111111111111111111111111111111111";

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER_ORG = "22222222-2222-4222-8222-222222222222";
const TENANT = "00000000-0000-0000-0000-000000000001";

const FLAGGER = "0x1111111111111111111111111111111111111111";
const EDITOR = "0x2222222222222222222222222222222222222222";
const CLEARER = "0x3333333333333333333333333333333333333333";
const OUTSIDER = "0x4444444444444444444444444444444444444444";

type Row = Record<string, unknown>;

type FakeOptions = { failFlagWrites?: boolean };

function createReadModel(options: FakeOptions = {}) {
  // Timestamps advance by a fixed step so ordering assertions never depend on
  // wall-clock ties.
  let tick = 0;
  const stamp = () => new Date(Date.UTC(2026, 0, 1) + tick++ * 1000).toISOString();

  const walletFor = (owner: string, organizationId: string): Row => ({
    id: `wallet-${owner.slice(2, 6)}`,
    organization_id: organizationId,
    wallet_address: `0xaaaa${owner.slice(6)}`,
    owner_address: owner,
    label: "Test wallet",
    status: "active",
    created_at: stamp(),
  });

  // Reviewers belong to their organisation through membership, which is what
  // the register scopes on. Owning a governed wallet is no longer the way in.
  const profileFor = (wallet: string): Row => ({
    id: `profile-${wallet.slice(2, 6)}`,
    wallet_address: wallet,
    display_name: `Reviewer ${wallet.slice(2, 6)}`,
    created_at: stamp(),
  });

  const memberFor = (wallet: string, organizationId: string, role: string): Row => ({
    id: `member-${wallet.slice(2, 6)}`,
    organization_id: organizationId,
    profile_id: `profile-${wallet.slice(2, 6)}`,
    role,
    created_at: stamp(),
  });

  const tables = {
    governed_wallets: [
      walletFor(FLAGGER, ORG),
      walletFor(EDITOR, ORG),
      walletFor(CLEARER, ORG),
      walletFor(OUTSIDER, OTHER_ORG),
    ],
    profiles: [profileFor(FLAGGER), profileFor(EDITOR), profileFor(CLEARER), profileFor(OUTSIDER)],
    organization_members: [
      memberFor(FLAGGER, ORG, "owner"),
      memberFor(EDITOR, ORG, "approver"),
      memberFor(CLEARER, ORG, "approver"),
      memberFor(OUTSIDER, OTHER_ORG, "owner"),
    ],
    vendor_flags: [] as Row[],
    vendor_flag_events: [] as Row[],
  };

  const tableOf = (name: string): Row[] => {
    const rows = (tables as Record<string, Row[]>)[name];
    if (!rows) {
      throw new Error(`the review register touched an unexpected table: ${name}`);
    }
    return rows;
  };

  const matches = (row: Row, filters?: Record<string, unknown>) =>
    Object.entries(filters ?? {}).every(([key, value]) => row[key] === value);

  const client = {
    selectRows: async (table: string, opts: Record<string, never> | undefined = undefined) => {
      const options = (opts ?? {}) as {
        filters?: Record<string, unknown>;
        order?: string;
        limit?: number;
      };
      let rows = tableOf(table).filter((row) => matches(row, options.filters));
      if (options.order) {
        const [column = "created_at", direction = "asc"] = options.order.split(".");
        rows = [...rows].sort((a, b) => {
          const left = String(a[column] ?? "");
          const right = String(b[column] ?? "");
          return direction === "desc" ? right.localeCompare(left) : left.localeCompare(right);
        });
      }
      if (options.limit) {
        rows = rows.slice(0, options.limit);
      }
      return rows.map((row) => ({ ...row }));
    },

    upsertRows: async (table: string, rows: Row[], onConflict?: string) => {
      if (table === "vendor_flags" && options.failFlagWrites) {
        throw new Error("vendor_flags write rejected");
      }
      const keys = onConflict?.split(",") ?? [];
      const stored = tableOf(table);
      return rows.map((row) => {
        const existing = keys.length
          ? stored.find((candidate) => keys.every((key) => candidate[key] === row[key]))
          : undefined;
        if (existing) {
          Object.assign(existing, row);
          return { ...existing };
        }
        const inserted: Row = {
          id: `${table}-${stored.length + 1}`,
          created_at: stamp(),
          ...row,
        };
        stored.push(inserted);
        return { ...inserted };
      });
    },

    patchRows: async (table: string, patch: Row, filters: Record<string, unknown>) => {
      const stored = tableOf(table);
      const hits = stored.filter((row) => matches(row, filters));
      for (const row of hits) {
        Object.assign(row, patch);
      }
      return hits.map((row) => ({ ...row }));
    },

    // Stands in for the vendor_flag_apply database function: it applies the
    // state change and appends the matching audit event as one step, the same
    // contract the real function keeps inside a transaction.
    callFunction: async (fn: string, args: Record<string, unknown>) => {
      if (fn !== "vendor_flag_apply") {
        throw new Error(`the review register called an unexpected function: ${fn}`);
      }
      if (options.failFlagWrites) {
        throw new Error("vendor_flag_apply rejected");
      }

      const org = args.p_org as string;
      const tenant = args.p_tenant as string;
      const vendor = args.p_vendor as string;
      const action = args.p_action as string;
      const actor = args.p_actor as string;
      const note = (args.p_note as string | null) ?? null;

      const flags = tableOf("vendor_flags");
      const events = tableOf("vendor_flag_events");
      const existing = flags.find(
        (row) => row.organization_id === org && row.vendor_address === vendor,
      );

      let row: Row;
      if (action === "flag") {
        const fresh = {
          tenant_id: tenant,
          flagged_by: actor,
          note,
          note_updated_by: null,
          note_updated_at: null,
          removed_by: null,
          removed_at: null,
          created_at: stamp(),
        };
        if (existing) {
          Object.assign(existing, fresh);
          row = existing;
        } else {
          row = {
            id: `vendor_flags-${flags.length + 1}`,
            organization_id: org,
            vendor_address: vendor,
            ...fresh,
          };
          flags.push(row);
        }
      } else if (!existing || existing.removed_at) {
        // Nothing active to edit or clear: no write, no event.
        return null;
      } else if (action === "note") {
        Object.assign(existing, { note, note_updated_by: actor, note_updated_at: stamp() });
        row = existing;
      } else {
        Object.assign(existing, { removed_by: actor, removed_at: stamp() });
        row = existing;
      }

      events.push({
        id: `vendor_flag_events-${events.length + 1}`,
        organization_id: org,
        tenant_id: tenant,
        vendor_address: vendor,
        event_type:
          action === "flag" ? "flagged" : action === "note" ? "note_updated" : "unflagged",
        actor,
        note: action === "unflag" ? null : note,
        created_at: stamp(),
      });

      return { ...row };
    },
  };

  return { client, tables };
}

function callerAs(actor: string, readModel: ReturnType<typeof createReadModel>) {
  const ctx = {
    db: null as never,
    session: {
      walletAddress: actor,
      tenantId: TENANT,
      role: "owner",
      expiresAt: Date.now() + 60_000,
    },
    publicClient: null as never,
    supabase: readModel.client as unknown as ApiContext["supabase"],
    requestFingerprint: null,
    env: { authConfigured: true, allowDevAuth: false },
  } as unknown as ApiContext;
  return vendorFlagsRouter.createCaller(ctx);
}

const VENDOR = "0xf45c70f2b08397419b11751041c0d9547ccedead";
const OTHER_VENDOR = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";

describe("vendor flag review trail", () => {
  it("keeps every event across flag -> edit -> unflag -> re-flag", async () => {
    const readModel = createReadModel();

    await callerAs(FLAGGER, readModel).flag({
      vendorAddress: VENDOR,
      note: "Suspicious invoice pattern",
    });
    await callerAs(EDITOR, readModel).updateNote({
      vendorAddress: VENDOR,
      note: "Confirmed duplicate invoices",
    });
    await callerAs(CLEARER, readModel).unflag({ vendorAddress: VENDOR });
    const reflag = await callerAs(FLAGGER, readModel).flag({
      vendorAddress: VENDOR,
      note: "Flagging again",
    });

    const events = readModel.tables.vendor_flag_events;
    expect(events.map((event) => event.event_type)).toEqual([
      "flagged",
      "note_updated",
      "unflagged",
      "flagged",
    ]);
    expect(events.map((event) => event.actor)).toEqual([FLAGGER, EDITOR, CLEARER, FLAGGER]);
    expect(events.map((event) => event.note)).toEqual([
      "Suspicious invoice pattern",
      "Confirmed duplicate invoices",
      null,
      "Flagging again",
    ]);

    // The re-flag also resets the live flag row: active again, owned by the new
    // flagger, with the previous edit and unflag stamps cleared.
    expect(reflag.flag.removedAt).toBeNull();
    expect(reflag.flag.removedBy).toBeNull();
    expect(reflag.flag.noteUpdatedBy).toBeNull();
    expect(reflag.flag.flaggedBy).toBe(FLAGGER);
    expect(reflag.flag.note).toBe("Flagging again");

    // The history endpoint surfaces the same trail, newest first.
    const history = await callerAs(FLAGGER, readModel).history({ vendorAddress: VENDOR });
    expect(history.map((entry) => entry.eventType)).toEqual([
      "flagged",
      "unflagged",
      "note_updated",
      "flagged",
    ]);
  });

  it("records no extra event when unflagging an already-unflagged vendor", async () => {
    const readModel = createReadModel();

    await callerAs(FLAGGER, readModel).flag({ vendorAddress: VENDOR, note: "check" });
    await callerAs(CLEARER, readModel).unflag({ vendorAddress: VENDOR });
    const second = await callerAs(EDITOR, readModel).unflag({ vendorAddress: VENDOR });

    expect(second).toEqual({ flagged: false });
    expect(readModel.tables.vendor_flag_events.map((event) => event.event_type)).toEqual([
      "flagged",
      "unflagged",
    ]);

    // A never-flagged vendor behaves the same: idempotent success, no event.
    await callerAs(CLEARER, readModel).unflag({ vendorAddress: OTHER_VENDOR });
    expect(
      readModel.tables.vendor_flag_events.filter((event) => event.vendor_address === OTHER_VENDOR),
    ).toEqual([]);
  });

  it("leaves no orphan event when the flag write fails", async () => {
    const readModel = createReadModel({ failFlagWrites: true });

    await expect(
      callerAs(FLAGGER, readModel).flag({ vendorAddress: VENDOR, note: "should not persist" }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });

    expect(readModel.tables.vendor_flag_events).toEqual([]);
    expect(readModel.tables.vendor_flags).toEqual([]);
  });

  it("never shows one organisation's review register to another", async () => {
    const readModel = createReadModel();

    await callerAs(FLAGGER, readModel).flag({ vendorAddress: VENDOR, note: "internal review" });

    // The outsider owns a wallet in a different organisation.
    expect(await callerAs(OUTSIDER, readModel).list()).toEqual([]);
    expect(await callerAs(OUTSIDER, readModel).history({ vendorAddress: VENDOR })).toEqual([]);

    // Their own flag lands in their own organisation and stays invisible here.
    await callerAs(OUTSIDER, readModel).flag({ vendorAddress: VENDOR, note: "separate register" });
    const insiderFlags = await callerAs(FLAGGER, readModel).list();
    expect(insiderFlags).toHaveLength(1);
    expect(insiderFlags[0]?.note).toBe("internal review");
  });
});
