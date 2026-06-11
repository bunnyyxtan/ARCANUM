import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { defaultTenantId } from "../tenant";

export const orgTypeEnum = pgEnum("org_type", ["DAO", "Protocol", "Corp", "DePIN"]);
export const agentTypeEnum = pgEnum("agent_type", [
  "research",
  "marketing",
  "dev",
  "treasury",
  "support",
  "other",
]);
export const agentStatusEnum = pgEnum("agent_status", ["active", "paused", "frozen"]);
export const verdictEnum = pgEnum("transfer_verdict", ["ALLOW", "ESCALATE", "DENY", "FREEZE"]);
export const escalationStatusEnum = pgEnum("escalation_status", [
  "PENDING",
  "EXECUTED",
  "REJECTED",
  "EXPIRED",
]);
export const vendorStatusEnum = pgEnum("vendor_status", ["allowed", "blocked", "removed"]);
export const anomalySeverityEnum = pgEnum("anomaly_severity", ["info", "warning", "danger"]);
export const userRoleEnum = pgEnum("user_role", ["owner", "council", "signer", "viewer"]);

const tenantIdColumn = () =>
  uuid("tenant_id")
    .notNull()
    .$defaultFn(() => defaultTenantId());

const createdAtColumn = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  name: text("name").notNull(),
  type: orgTypeEnum("type").notNull(),
  createdAt: createdAtColumn(),
  ownerWallet: varchar("owner_wallet", { length: 42 }).notNull(),
  multisigAddress: varchar("multisig_address", { length: 42 }).notNull(),
  chainId: integer("chain_id").notNull(),
});

export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantIdColumn(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    address: varchar("address", { length: 42 }).notNull(),
    label: text("label").notNull(),
    ownerAddress: varchar("owner_address", { length: 42 }).notNull(),
    createdBlock: integer("created_block").notNull(),
    createdAt: createdAtColumn(),
    factoryAddress: varchar("factory_address", { length: 42 }).notNull(),
    frozen: boolean("frozen").notNull().default(false),
    policyVersion: integer("policy_version").notNull().default(1),
  },
  (table) => ({
    tenantAddress: index("wallets_tenant_address_idx").on(table.tenantId, table.address),
  }),
);

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantIdColumn(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id),
    signerAddress: varchar("signer_address", { length: 42 }).notNull(),
    label: text("label").notNull(),
    type: agentTypeEnum("type").notNull(),
    createdAt: createdAtColumn(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    status: agentStatusEnum("status").notNull().default("active"),
  },
  (table) => ({
    tenantAgentLastSeen: index("agents_tenant_agent_last_seen_idx").on(
      table.tenantId,
      table.id,
      table.lastSeenAt,
    ),
  }),
);

export const transfers = pgTable(
  "transfers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantIdColumn(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id),
    agentId: uuid("agent_id").references(() => agents.id),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    blockNumber: integer("block_number").notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
    toAddress: varchar("to_address", { length: 42 }).notNull(),
    amount: numeric("amount", { precision: 78, scale: 0 }).notNull(),
    verdict: verdictEnum("verdict").notNull(),
    reason: text("reason").notNull(),
    vendorCategory: text("vendor_category").notNull(),
    dailySpentAfter: numeric("daily_spent_after", { precision: 78, scale: 0 }).notNull(),
  },
  (table) => ({
    tenantWalletTime: index("transfers_tenant_wallet_timestamp_idx").on(
      table.tenantId,
      table.walletId,
      sql`${table.timestamp} desc`,
    ),
  }),
);

export const escalations = pgTable(
  "escalations",
  {
    id: varchar("id", { length: 66 }).primaryKey(),
    tenantId: tenantIdColumn(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id),
    transferId: uuid("transfer_id").references(() => transfers.id),
    toAddress: varchar("to_address", { length: 42 }).notNull(),
    amount: numeric("amount", { precision: 78, scale: 0 }).notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    status: escalationStatusEnum("status").notNull().default("PENDING"),
    signaturesCount: integer("signatures_count").notNull().default(0),
    threshold: integer("threshold").notNull(),
    signers: jsonb("signers").$type<string[]>().notNull().default([]),
    executedTxHash: varchar("executed_tx_hash", { length: 66 }),
  },
  (table) => ({
    tenantWalletTime: index("escalations_tenant_wallet_created_idx").on(
      table.tenantId,
      table.walletId,
      sql`${table.createdAt} desc`,
    ),
  }),
);

export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantIdColumn(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id),
    address: varchar("address", { length: 42 }).notNull(),
    category: text("category").notNull(),
    status: vendorStatusEnum("status").notNull(),
    perVendorCap: numeric("per_vendor_cap", { precision: 78, scale: 0 }).notNull(),
    metadataHash: varchar("metadata_hash", { length: 66 }).notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
    addedBy: varchar("added_by", { length: 42 }).notNull(),
  },
  (table) => ({
    tenantWalletTime: index("vendors_tenant_wallet_added_idx").on(
      table.tenantId,
      table.walletId,
      sql`${table.addedAt} desc`,
    ),
  }),
);

export const anomalies = pgTable(
  "anomalies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantIdColumn(),
    walletId: uuid("wallet_id")
      .notNull()
      .references(() => wallets.id),
    agentId: uuid("agent_id").references(() => agents.id),
    sigma: numeric("sigma", { precision: 10, scale: 4 }).notNull(),
    reason: text("reason").notNull(),
    blockNumber: integer("block_number").notNull(),
    txHash: varchar("tx_hash", { length: 66 }),
    severity: anomalySeverityEnum("severity").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantWalletTime: index("anomalies_tenant_wallet_created_idx").on(
      table.tenantId,
      table.walletId,
      sql`${table.createdAt} desc`,
    ),
  }),
);

export const policies = pgTable("policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  walletId: uuid("wallet_id")
    .notNull()
    .references(() => wallets.id),
  version: integer("version").notNull(),
  perTxCap: numeric("per_tx_cap", { precision: 78, scale: 0 }).notNull(),
  daily24hCap: numeric("daily_24h_cap", { precision: 78, scale: 0 }).notNull(),
  monthlyRollingCap: numeric("monthly_rolling_cap", { precision: 78, scale: 0 }).notNull(),
  allowedCategories: integer("allowed_categories").notNull(),
  escalationThreshold: numeric("escalation_threshold", { precision: 78, scale: 0 }).notNull(),
  requireAllowlist: boolean("require_allowlist").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: varchar("updated_by", { length: 42 }).notNull(),
});

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: tenantIdColumn(),
    walletId: uuid("wallet_id").references(() => wallets.id),
    type: text("type").notNull(),
    severity: text("severity").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    blockNumber: integer("block_number").notNull(),
    txHash: varchar("tx_hash", { length: 66 }).notNull(),
    timestamp: timestamp("timestamp", { withTimezone: true }).notNull(),
  },
  (table) => ({
    tenantWalletTime: index("events_tenant_wallet_timestamp_idx").on(
      table.tenantId,
      table.walletId,
      sql`${table.timestamp} desc`,
    ),
  }),
);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
  createdAt: createdAtColumn(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  userAgent: text("user_agent").notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: tenantIdColumn(),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
  displayName: text("display_name").notNull(),
  role: userRoleEnum("role").notNull(),
  createdAt: createdAtColumn(),
});

export type Organization = typeof organizations.$inferSelect;
export type Wallet = typeof wallets.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Transfer = typeof transfers.$inferSelect;
export type Escalation = typeof escalations.$inferSelect;
export type Vendor = typeof vendors.$inferSelect;
export type Anomaly = typeof anomalies.$inferSelect;
export type Policy = typeof policies.$inferSelect;
export type Event = typeof events.$inferSelect;
export type User = typeof users.$inferSelect;
