ALTER TABLE "vendor_flags" ADD COLUMN "note_updated_by" varchar(42);--> statement-breakpoint
ALTER TABLE "vendor_flags" ADD COLUMN "note_updated_at" timestamp with time zone;