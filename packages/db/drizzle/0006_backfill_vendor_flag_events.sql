-- Backfill the append-only review trail from the existing vendor_flags rows.
-- Only the latest cycle per vendor survives in vendor_flags, so this recovers
-- what is still recoverable: the current flag, its last note edit, and the
-- unflag stamp (if soft-deleted). Guarded against double-inserts so the
-- migration is safe to re-run.
INSERT INTO "vendor_flag_events" ("tenant_id", "vendor_address", "event_type", "actor", "note", "created_at")
SELECT vf."tenant_id", vf."vendor_address", 'flagged', vf."flagged_by", vf."note", vf."created_at"
FROM "vendor_flags" vf
WHERE NOT EXISTS (
  SELECT 1 FROM "vendor_flag_events" e
  WHERE e."tenant_id" = vf."tenant_id"
    AND e."vendor_address" = vf."vendor_address"
    AND e."event_type" = 'flagged'
    AND e."created_at" = vf."created_at"
);--> statement-breakpoint
INSERT INTO "vendor_flag_events" ("tenant_id", "vendor_address", "event_type", "actor", "note", "created_at")
SELECT vf."tenant_id", vf."vendor_address", 'note_updated', vf."note_updated_by", vf."note", vf."note_updated_at"
FROM "vendor_flags" vf
WHERE vf."note_updated_by" IS NOT NULL
  AND vf."note_updated_at" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "vendor_flag_events" e
    WHERE e."tenant_id" = vf."tenant_id"
      AND e."vendor_address" = vf."vendor_address"
      AND e."event_type" = 'note_updated'
      AND e."created_at" = vf."note_updated_at"
  );--> statement-breakpoint
INSERT INTO "vendor_flag_events" ("tenant_id", "vendor_address", "event_type", "actor", "created_at")
SELECT vf."tenant_id", vf."vendor_address", 'unflagged', vf."removed_by", vf."removed_at"
FROM "vendor_flags" vf
WHERE vf."removed_by" IS NOT NULL
  AND vf."removed_at" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "vendor_flag_events" e
    WHERE e."tenant_id" = vf."tenant_id"
      AND e."vendor_address" = vf."vendor_address"
      AND e."event_type" = 'unflagged'
      AND e."created_at" = vf."removed_at"
  );
