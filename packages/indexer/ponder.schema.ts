import { onchainEnum, onchainTable } from "ponder";

export const escalationStatus = onchainEnum("escalation_status", [
  "PENDING",
  "EXECUTED",
  "REJECTED",
  "EXPIRED",
  "DENIED",
  "CANCELLED",
  "INVALIDATED",
]);

export const indexedEvents = onchainTable("indexed_events", (t) => ({
  id: t.text().primaryKey(),
  eventName: t.text().notNull(),
  blockNumber: t.bigint().notNull(),
  txHash: t.text().notNull(),
  logIndex: t.integer().notNull(),
}));
