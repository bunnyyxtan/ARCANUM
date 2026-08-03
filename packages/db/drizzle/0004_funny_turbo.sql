ALTER TABLE "vendor_flags" ADD COLUMN "removed_by" varchar(42);--> statement-breakpoint
ALTER TABLE "vendor_flags" ADD COLUMN "removed_at" timestamp with time zone;