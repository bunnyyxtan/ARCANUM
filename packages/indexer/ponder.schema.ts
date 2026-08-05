import { onchainTable } from "ponder";

/**
 * Ponder requires a schema for its internal bookkeeping tables. The actual
 * read model lives in Supabase (written by src/supabase-sync.ts) and the
 * drizzle Postgres schema (@arcanum/db); this table simply records which
 * blocks produced indexed events so the sync is inspectable.
 */
export const indexedEvents = onchainTable("indexed_events", (t) => ({
  id: t.text().primaryKey(),
  eventName: t.text().notNull(),
  blockNumber: t.bigint().notNull(),
  txHash: t.text().notNull(),
}));
