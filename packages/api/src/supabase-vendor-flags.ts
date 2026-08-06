import type { ApiContext } from "./context";
import { readCallerMembership, readSupabaseWallets } from "./supabase";

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

/**
 * Organisations whose register this caller is allowed to touch. The workspace
 * they belong to comes first, so a teammate who owns no governed wallet can
 * still work the register, and writes land in the workspace rather than in
 * whichever organisation happens to own their oldest wallet.
 */
async function callerOrgIds(ctx: ApiContext): Promise<string[]> {
  const [membership, wallets] = await Promise.all([
    readCallerMembership(ctx),
    readSupabaseWallets(ctx),
  ]);

  return [
    ...new Set(
      [membership?.orgId, ...wallets.map((wallet) => wallet.orgId)].filter(
        (orgId): orgId is string => Boolean(orgId),
      ),
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

type FlagAction = "flag" | "note" | "unflag";

/**
 * Apply a review change and record its audit event as one indivisible step.
 *
 * The REST tables have no transactions, so a state write followed by an event
 * write can tear: a vendor left flagged with nothing in the trail to say who
 * did it, which is exactly the kind of gap a review register exists to prevent.
 * The database function does both inside one transaction and takes a row lock,
 * so concurrent reviewers queue instead of racing.
 *
 * Returns the resulting flag row, or null when there was nothing active to edit
 * or clear -- in that case nothing is written and no event is invented.
 */
async function applyFlagChange(
  ctx: ApiContext,
  orgId: string,
  action: FlagAction,
  input: {
    tenantId: string;
    vendorAddress: string;
    actor: string;
    note?: string | null;
  },
): Promise<Row | null> {
  const client = registerClient(ctx);
  const result = await client.callFunction("vendor_flag_apply", {
    p_org: orgId,
    p_tenant: input.tenantId,
    p_vendor: input.vendorAddress,
    p_action: action,
    p_actor: input.actor,
    p_note: input.note ?? null,
  });

  if (result === null || result === undefined) {
    return null;
  }

  if (typeof result !== "object" || Array.isArray(result)) {
    throw new Error(`vendor_flag_apply returned an unexpected result for ${action}.`);
  }

  return result as Row;
}

export async function flagVendor(
  ctx: ApiContext,
  input: VendorFlagWrite,
): Promise<VendorFlag | null> {
  const orgId = await writeOrgId(ctx);
  if (!orgId) {
    return null;
  }

  // Re-flagging is a fresh flag: the flagger owns the note again, so any
  // previous "last edited by" trail is cleared and a prior unflag is
  // superseded. The cycle that came before stays in the event trail.
  const row = await applyFlagChange(ctx, orgId, "flag", {
    tenantId: input.tenantId,
    vendorAddress: input.vendorAddress,
    actor: input.actor,
    note: input.note ? input.note : null,
  });

  return row ? flagFromRow(row) : null;
}

export async function updateVendorFlagNote(
  ctx: ApiContext,
  input: VendorFlagWrite,
): Promise<VendorFlag | null> {
  const orgId = await writeOrgId(ctx);
  if (!orgId) {
    return null;
  }

  // Only the note moves: who flagged the vendor and when stays intact, and the
  // editor is stamped so an approver can see who last touched it. A vendor that
  // is not currently flagged has no note to edit, and comes back null.
  const row = await applyFlagChange(ctx, orgId, "note", {
    tenantId: input.tenantId,
    vendorAddress: input.vendorAddress,
    actor: input.actor,
    note: input.note ? input.note : null,
  });

  return row ? flagFromRow(row) : null;
}

export async function unflagVendor(
  ctx: ApiContext,
  input: Omit<VendorFlagWrite, "note">,
): Promise<{ cleared: boolean }> {
  const orgId = await writeOrgId(ctx);
  if (!orgId) {
    return { cleared: false };
  }

  // Already unflagged (or never flagged) is a legitimate idempotent success,
  // and logging an event for it would invent review activity that never
  // happened.
  const row = await applyFlagChange(ctx, orgId, "unflag", {
    tenantId: input.tenantId,
    vendorAddress: input.vendorAddress,
    actor: input.actor,
  });

  return { cleared: Boolean(row) };
}
