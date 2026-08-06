import type { ApiContext } from "./context";
import { readSupabaseWallets } from "./supabase";

/**
 * Vendor review register, backed by Supabase.
 *
 * The register used to be reached through the Drizzle client, which has no
 * database production can reach, so flagging a vendor and reading a review
 * trail failed on the live site. Supabase is the read model every other surface
 * already uses, so the register lives there too.
 *
 * Rows are scoped by organisation, matching how the rest of the read model is
 * scoped: a caller only ever sees the register of organisations that own one of
 * their wallets.
 */

const FLAGS_TABLE = "vendor_flags";
const EVENTS_TABLE = "vendor_flag_events";
const HISTORY_LIMIT = 50;

export type VendorFlag = {
  id: string;
  tenantId: string | null;
  vendorAddress: string;
  flaggedBy: string;
  note: string | null;
  noteUpdatedBy: string | null;
  noteUpdatedAt: Date | null;
  removedBy: string | null;
  removedAt: Date | null;
  createdAt: Date | null;
};

export type VendorFlagEvent = {
  id: string;
  vendorAddress: string;
  eventType: VendorFlagEventType;
  actor: string;
  note: string | null;
  createdAt: Date | null;
};

export type VendorFlagWrite = {
  tenantId: string;
  vendorAddress: string;
  actor: string;
  note?: string | null;
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

export const VENDOR_FLAG_EVENT_TYPES = ["flagged", "note_updated", "unflagged"] as const;

export type VendorFlagEventType = (typeof VENDOR_FLAG_EVENT_TYPES)[number];

/**
 * Reads a column the schema declares NOT NULL. A missing value means the table
 * has drifted from the shape the register expects, which is worth failing
 * loudly over -- a blank flagger or an unattributed trail entry would quietly
 * corrupt an audit record.
 */
function requiredText(row: Row, key: string, table: string): string {
  const value = text(row, key);
  if (value === null) {
    throw new Error(`${table}.${key} is missing from the vendor review register.`);
  }
  return value;
}

function reviewEventType(row: Row): VendorFlagEventType {
  const value = text(row, "event_type");
  const known = VENDOR_FLAG_EVENT_TYPES.find((eventType) => eventType === value);
  if (!known) {
    throw new Error(`vendor_flag_events.event_type "${value}" is not a review event.`);
  }
  return known;
}

function flagFromRow(row: Row): VendorFlag {
  return {
    id: requiredText(row, "id", FLAGS_TABLE),
    tenantId: text(row, "tenant_id"),
    vendorAddress: requiredText(row, "vendor_address", FLAGS_TABLE),
    flaggedBy: requiredText(row, "flagged_by", FLAGS_TABLE),
    note: text(row, "note"),
    noteUpdatedBy: text(row, "note_updated_by"),
    noteUpdatedAt: date(row, "note_updated_at"),
    removedBy: text(row, "removed_by"),
    removedAt: date(row, "removed_at"),
    createdAt: date(row, "created_at"),
  };
}

function eventFromRow(row: Row): VendorFlagEvent {
  return {
    id: requiredText(row, "id", EVENTS_TABLE),
    vendorAddress: requiredText(row, "vendor_address", EVENTS_TABLE),
    eventType: reviewEventType(row),
    actor: requiredText(row, "actor", EVENTS_TABLE),
    note: text(row, "note"),
    createdAt: date(row, "created_at"),
  };
}

function registerClient(ctx: ApiContext) {
  const client = ctx.supabase;
  if (!client) {
    // The router turns this into the register-unavailable error. Failing here
    // keeps a misconfigured deployment from reading as "no flags".
    throw new Error("Supabase service role is not configured.");
  }
  return client;
}

/** Organisations whose register this caller is allowed to touch. */
async function callerOrgIds(ctx: ApiContext): Promise<string[]> {
  const wallets = await readSupabaseWallets(ctx);
  return [
    ...new Set(
      wallets.map((wallet) => wallet.orgId).filter((orgId): orgId is string => Boolean(orgId)),
    ),
  ];
}

/**
 * The organisation new review state is written under. A caller with wallets in
 * several organisations writes to the first one, which is the same organisation
 * their wallet list is anchored to.
 */
async function writeOrgId(ctx: ApiContext): Promise<string | null> {
  const [orgId] = await callerOrgIds(ctx);
  return orgId ?? null;
}

async function activeFlagRow(
  ctx: ApiContext,
  orgId: string,
  vendorAddress: string,
): Promise<Row | null> {
  const client = registerClient(ctx);
  const [row] = await client.selectRows(FLAGS_TABLE, {
    filters: { organization_id: orgId, vendor_address: vendorAddress },
    limit: 1,
  });
  return row ?? null;
}

export async function listVendorFlags(ctx: ApiContext): Promise<VendorFlag[]> {
  const client = registerClient(ctx);
  const orgIds = await callerOrgIds(ctx);
  const rows = (
    await Promise.all(
      orgIds.map((organization_id) =>
        client.selectRows(FLAGS_TABLE, {
          filters: { organization_id },
          order: "created_at.desc",
        }),
      ),
    )
  ).flat();

  // An unflagged vendor keeps its row so the trail survives, so the live list
  // is the set of rows that were never cleared.
  return rows.filter((row) => !row.removed_at).map(flagFromRow);
}

export async function listVendorFlagHistory(
  ctx: ApiContext,
  vendorAddress: string,
): Promise<VendorFlagEvent[]> {
  const client = registerClient(ctx);
  const orgIds = await callerOrgIds(ctx);
  const rows = (
    await Promise.all(
      orgIds.map((organization_id) =>
        client.selectRows(EVENTS_TABLE, {
          filters: { organization_id, vendor_address: vendorAddress },
          order: "created_at.desc",
          limit: HISTORY_LIMIT,
        }),
      ),
    )
  ).flat();

  return rows
    .map(eventFromRow)
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .slice(0, HISTORY_LIMIT);
}

async function recordEvent(
  ctx: ApiContext,
  orgId: string,
  input: {
    tenantId: string;
    vendorAddress: string;
    eventType: VendorFlagEventType;
    actor: string;
    note: string | null;
  },
): Promise<void> {
  const client = registerClient(ctx);
  await client.upsertRows(EVENTS_TABLE, [
    {
      organization_id: orgId,
      tenant_id: input.tenantId,
      vendor_address: input.vendorAddress,
      event_type: input.eventType,
      actor: input.actor,
      note: input.note,
    },
  ]);
}

export async function flagVendor(
  ctx: ApiContext,
  input: VendorFlagWrite,
): Promise<VendorFlag | null> {
  const client = registerClient(ctx);
  const orgId = await writeOrgId(ctx);
  if (!orgId) {
    return null;
  }

  const note = input.note ? input.note : null;
  // Re-flagging is a fresh flag: the flagger owns the note again, so any
  // previous "last edited by" trail is cleared and a prior unflag is
  // superseded. The cycle that came before stays in the event trail.
  const [row] = await client.upsertRows(
    FLAGS_TABLE,
    [
      {
        organization_id: orgId,
        tenant_id: input.tenantId,
        vendor_address: input.vendorAddress,
        flagged_by: input.actor,
        note,
        note_updated_by: null,
        note_updated_at: null,
        removed_by: null,
        removed_at: null,
        created_at: new Date().toISOString(),
      },
    ],
    "organization_id,vendor_address",
  );

  if (!row) {
    return null;
  }

  await recordEvent(ctx, orgId, {
    tenantId: input.tenantId,
    vendorAddress: input.vendorAddress,
    eventType: "flagged",
    actor: input.actor,
    note,
  });

  return flagFromRow(row);
}

export async function updateVendorFlagNote(
  ctx: ApiContext,
  input: VendorFlagWrite,
): Promise<VendorFlag | null> {
  const client = registerClient(ctx);
  const orgId = await writeOrgId(ctx);
  if (!orgId) {
    return null;
  }

  const existing = await activeFlagRow(ctx, orgId, input.vendorAddress);
  if (!existing || existing.removed_at) {
    return null;
  }

  const note = input.note ? input.note : null;
  // Only the note moves: who flagged the vendor and when stays intact, and the
  // editor is stamped so an approver can see who last touched it.
  const [row] = await client.patchRows(
    FLAGS_TABLE,
    {
      note,
      note_updated_by: input.actor,
      note_updated_at: new Date().toISOString(),
    },
    { organization_id: orgId, vendor_address: input.vendorAddress },
  );

  if (!row) {
    return null;
  }

  await recordEvent(ctx, orgId, {
    tenantId: input.tenantId,
    vendorAddress: input.vendorAddress,
    eventType: "note_updated",
    actor: input.actor,
    note,
  });

  return flagFromRow(row);
}

export async function unflagVendor(
  ctx: ApiContext,
  input: Omit<VendorFlagWrite, "note">,
): Promise<{ cleared: boolean }> {
  const client = registerClient(ctx);
  const orgId = await writeOrgId(ctx);
  if (!orgId) {
    return { cleared: false };
  }

  const existing = await activeFlagRow(ctx, orgId, input.vendorAddress);
  // Already unflagged (or never flagged) is a legitimate idempotent success,
  // and logging an event for it would invent review activity that never
  // happened.
  if (!existing || existing.removed_at) {
    return { cleared: false };
  }

  await client.patchRows(
    FLAGS_TABLE,
    { removed_by: input.actor, removed_at: new Date().toISOString() },
    { organization_id: orgId, vendor_address: input.vendorAddress },
  );

  await recordEvent(ctx, orgId, {
    tenantId: input.tenantId,
    vendorAddress: input.vendorAddress,
    eventType: "unflagged",
    actor: input.actor,
    note: null,
  });

  return { cleared: true };
}
