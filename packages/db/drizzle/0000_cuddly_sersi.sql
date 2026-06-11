CREATE TYPE "public"."agent_status" AS ENUM('active', 'paused', 'frozen');--> statement-breakpoint
CREATE TYPE "public"."agent_type" AS ENUM('research', 'marketing', 'dev', 'treasury', 'support', 'other');--> statement-breakpoint
CREATE TYPE "public"."anomaly_severity" AS ENUM('info', 'warning', 'danger');--> statement-breakpoint
CREATE TYPE "public"."escalation_status" AS ENUM('PENDING', 'EXECUTED', 'REJECTED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."org_type" AS ENUM('DAO', 'Protocol', 'Corp', 'DePIN');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'council', 'signer', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."vendor_status" AS ENUM('allowed', 'blocked', 'removed');--> statement-breakpoint
CREATE TYPE "public"."transfer_verdict" AS ENUM('ALLOW', 'ESCALATE', 'DENY', 'FREEZE');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"signer_address" varchar(42) NOT NULL,
	"label" text NOT NULL,
	"type" "agent_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	"status" "agent_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "anomalies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"agent_id" uuid,
	"sigma" numeric(10, 4) NOT NULL,
	"reason" text NOT NULL,
	"block_number" integer NOT NULL,
	"tx_hash" varchar(66),
	"severity" "anomaly_severity" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "escalations" (
	"id" varchar(66) PRIMARY KEY NOT NULL,
	"tenant_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"transfer_id" uuid,
	"to_address" varchar(42) NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"status" "escalation_status" DEFAULT 'PENDING' NOT NULL,
	"signatures_count" integer DEFAULT 0 NOT NULL,
	"threshold" integer NOT NULL,
	"signers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"executed_tx_hash" varchar(66)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"wallet_id" uuid,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"payload" jsonb NOT NULL,
	"block_number" integer NOT NULL,
	"tx_hash" varchar(66) NOT NULL,
	"timestamp" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"type" "org_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"owner_wallet" varchar(42) NOT NULL,
	"multisig_address" varchar(42) NOT NULL,
	"chain_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"per_tx_cap" numeric(78, 0) NOT NULL,
	"daily_24h_cap" numeric(78, 0) NOT NULL,
	"monthly_rolling_cap" numeric(78, 0) NOT NULL,
	"allowed_categories" integer NOT NULL,
	"escalation_threshold" numeric(78, 0) NOT NULL,
	"require_allowlist" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" varchar(42) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"user_agent" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"agent_id" uuid,
	"tx_hash" varchar(66) NOT NULL,
	"block_number" integer NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"to_address" varchar(42) NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"verdict" "transfer_verdict" NOT NULL,
	"reason" text NOT NULL,
	"vendor_category" text NOT NULL,
	"daily_spent_after" numeric(78, 0) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"display_name" text NOT NULL,
	"role" "user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"wallet_id" uuid NOT NULL,
	"address" varchar(42) NOT NULL,
	"category" text NOT NULL,
	"status" "vendor_status" NOT NULL,
	"per_vendor_cap" numeric(78, 0) NOT NULL,
	"metadata_hash" varchar(66) NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"added_by" varchar(42) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"address" varchar(42) NOT NULL,
	"label" text NOT NULL,
	"owner_address" varchar(42) NOT NULL,
	"created_block" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"factory_address" varchar(42) NOT NULL,
	"frozen" boolean DEFAULT false NOT NULL,
	"policy_version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "agents" ADD CONSTRAINT "agents_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anomalies" ADD CONSTRAINT "anomalies_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "anomalies" ADD CONSTRAINT "anomalies_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "escalations" ADD CONSTRAINT "escalations_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "escalations" ADD CONSTRAINT "escalations_transfer_id_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."transfers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "events" ADD CONSTRAINT "events_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "policies" ADD CONSTRAINT "policies_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transfers" ADD CONSTRAINT "transfers_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "transfers" ADD CONSTRAINT "transfers_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "vendors" ADD CONSTRAINT "vendors_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "wallets" ADD CONSTRAINT "wallets_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agents_tenant_agent_last_seen_idx" ON "agents" USING btree ("tenant_id","id","last_seen_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "anomalies_tenant_wallet_created_idx" ON "anomalies" USING btree ("tenant_id","wallet_id","created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "escalations_tenant_wallet_created_idx" ON "escalations" USING btree ("tenant_id","wallet_id","created_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_tenant_wallet_timestamp_idx" ON "events" USING btree ("tenant_id","wallet_id","timestamp" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transfers_tenant_wallet_timestamp_idx" ON "transfers" USING btree ("tenant_id","wallet_id","timestamp" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendors_tenant_wallet_added_idx" ON "vendors" USING btree ("tenant_id","wallet_id","added_at" desc);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "wallets_tenant_address_idx" ON "wallets" USING btree ("tenant_id","address");