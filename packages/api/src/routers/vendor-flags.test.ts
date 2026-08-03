import { randomUUID } from "node:crypto";

import { vendorFlagEvents, vendorFlags } from "@arcanum/db/schema";
import * as schema from "@arcanum/db/schema";
import { and, asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { ApiContext } from "../context";
import { vendorFlagsRouter } from "./vendor-flags";

// Integration tests against the real development database: the append-only
// review trail guarantees (transactional event writes, idempotent unflag,
// rollback on failure) only mean anything against actual Postgres semantics.

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL must be set to run vendor-flags integration tests.");
}

const sql = postgres(databaseUrl, { prepare: false, max: 1 });
const db = drizzle(sql, { schema });

// Each run works inside its own throwaway tenant so tests never touch (or
// depend on) real review data, and parallel runs cannot collide.
const tenantId = randomUUID();

const FLAGGER = "0x1111111111111111111111111111111111111111";
const EDITOR = "0x2222222222222222222222222222222222222222";
const CLEARER = "0x3333333333333333333333333333333333333333";

function callerAs(actor: string, sessionTenantId: string = tenantId) {
  const ctx = {
    db,
    session: {
      walletAddress: actor,
      tenantId: sessionTenantId,
      role: "owner",
      expiresAt: Date.now() + 60_000,
    },
    publicClient: null as never,
    supabase: null,
    requestFingerprint: null,
    env: { authConfigured: true, allowDevAuth: false },
  } satisfies ApiContext;
  return vendorFlagsRouter.createCaller(ctx);
}

function randomVendorAddress() {
  return `0x${(randomUUID() + randomUUID()).replaceAll("-", "").slice(0, 40)}`;
}

// created_at defaults to now() with millisecond ties possible; a short pause
// between mutations keeps the chronological ordering assertions unambiguous.
const pause = () => new Promise((resolve) => setTimeout(resolve, 15));

async function eventsFor(vendorAddress: string) {
  return db
    .select()
    .from(vendorFlagEvents)
    .where(
      and(
        eq(vendorFlagEvents.tenantId, tenantId),
        eq(vendorFlagEvents.vendorAddress, vendorAddress),
      ),
    )
    .orderBy(asc(vendorFlagEvents.createdAt));
}

beforeAll(async () => {
  // Sanity check connectivity up front so failures read as "db unreachable"
  // rather than a confusing assertion error later.
  await sql`select 1`;
});

afterAll(async () => {
  await db.delete(vendorFlagEvents).where(eq(vendorFlagEvents.tenantId, tenantId));
  await db.delete(vendorFlags).where(eq(vendorFlags.tenantId, tenantId));
  await sql.end();
});

describe("vendor flag review trail", () => {
  it("keeps every event across flag → edit → unflag → re-flag", async () => {
    const vendorAddress = randomVendorAddress();

    await callerAs(FLAGGER).flag({ vendorAddress, note: "Suspicious invoice pattern" });
    await pause();
    await callerAs(EDITOR).updateNote({ vendorAddress, note: "Confirmed duplicate invoices" });
    await pause();
    await callerAs(CLEARER).unflag({ vendorAddress });
    await pause();
    const reflag = await callerAs(FLAGGER).flag({ vendorAddress, note: "Flagging again" });

    const events = await eventsFor(vendorAddress);
    expect(events.map((e) => e.eventType)).toEqual([
      "flagged",
      "note_updated",
      "unflagged",
      "flagged",
    ]);
    expect(events.map((e) => e.actor)).toEqual([FLAGGER, EDITOR, CLEARER, FLAGGER]);
    expect(events.map((e) => e.note)).toEqual([
      "Suspicious invoice pattern",
      "Confirmed duplicate invoices",
      null,
      "Flagging again",
    ]);

    // The re-flag also resets the live flag row itself: active again, owned
    // by the new flagger, with the previous edit/unflag stamps cleared.
    expect(reflag.flag.removedAt).toBeNull();
    expect(reflag.flag.removedBy).toBeNull();
    expect(reflag.flag.noteUpdatedBy).toBeNull();
    expect(reflag.flag.flaggedBy).toBe(FLAGGER);
    expect(reflag.flag.note).toBe("Flagging again");

    // history endpoint surfaces the same trail (newest first).
    const history = await callerAs(FLAGGER).history({ vendorAddress });
    expect(history.map((e) => e.eventType)).toEqual([
      "flagged",
      "unflagged",
      "note_updated",
      "flagged",
    ]);
  });

  it("records no extra event when unflagging an already-unflagged vendor", async () => {
    const vendorAddress = randomVendorAddress();

    await callerAs(FLAGGER).flag({ vendorAddress, note: "check" });
    await pause();
    await callerAs(CLEARER).unflag({ vendorAddress });
    await pause();
    const second = await callerAs(EDITOR).unflag({ vendorAddress });

    expect(second).toEqual({ flagged: false });
    const events = await eventsFor(vendorAddress);
    expect(events.map((e) => e.eventType)).toEqual(["flagged", "unflagged"]);

    // Never-flagged vendors behave the same: idempotent success, no event.
    const untouched = randomVendorAddress();
    await callerAs(CLEARER).unflag({ vendorAddress: untouched });
    expect(await eventsFor(untouched)).toEqual([]);
  });

  it("leaves no orphan event when the flag upsert fails", async () => {
    const vendorAddress = randomVendorAddress();

    // A malformed tenant id makes the vendor_flags upsert fail inside the
    // transaction; the surrounding transaction must roll back so no
    // vendor_flag_events row survives for this vendor.
    await expect(
      callerAs(FLAGGER, "not-a-valid-uuid").flag({ vendorAddress, note: "should not persist" }),
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });

    const orphanEvents = await db
      .select()
      .from(vendorFlagEvents)
      .where(eq(vendorFlagEvents.vendorAddress, vendorAddress));
    expect(orphanEvents).toEqual([]);

    const orphanFlags = await db
      .select()
      .from(vendorFlags)
      .where(eq(vendorFlags.vendorAddress, vendorAddress));
    expect(orphanFlags).toEqual([]);
  });
});
