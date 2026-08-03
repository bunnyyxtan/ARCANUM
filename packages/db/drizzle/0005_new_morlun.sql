CREATE TYPE "public"."vendor_flag_event_type" AS ENUM('flagged', 'note_updated', 'unflagged');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vendor_flag_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"vendor_address" varchar(42) NOT NULL,
	"event_type" "vendor_flag_event_type" NOT NULL,
	"actor" varchar(42) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vendor_flag_events_tenant_vendor_created_idx" ON "vendor_flag_events" USING btree ("tenant_id","vendor_address","created_at" desc);