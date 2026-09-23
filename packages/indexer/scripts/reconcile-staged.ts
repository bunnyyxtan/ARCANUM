// Run after /ready and graceful writer shutdown, before catch-up finalization.
// Environment is supplied by the caller; this script does not load .env files.
// Force credentials even if the caller forgot the mirror flag.
export {};

process.env.ARCANUM_DISABLE_PG_MIRROR = "1";

try {
  const { syncStagedEvents } = await import("../src/supabase-sync");
  await syncStagedEvents();
} catch (error) {
  console.error("[indexer] final staged reconciliation failed", error);
  process.exitCode = 1;
}
