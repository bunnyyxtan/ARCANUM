CREATE TABLE IF NOT EXISTS "vendor_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"vendor_address" varchar(42) NOT NULL,
	"flagged_by" varchar(42) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vendor_flags_tenant_vendor_idx" ON "vendor_flags" USING btree ("tenant_id","vendor_address");