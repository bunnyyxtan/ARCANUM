import { createSupabaseServiceRoleClient } from "@arcanum/api/server";
import { NextResponse } from "next/server";

// Public, unauthenticated global stats for the landing page: how much capital
// has moved through governed decisions across ALL workspaces. Reads go through
// a single Supabase function so the numbers stay one atomic snapshot.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GlobalStats = {
  capitalGovernedUsdc: number;
};

let cached: { at: number; stats: GlobalStats } | null = null;
// One minute of caching keeps landing-page traffic from hammering the read
// model while still feeling live.
const CACHE_MS = 60_000;

export async function GET() {
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return NextResponse.json(cached.stats, {
      headers: { "cache-control": "public, max-age=60" },
    });
  }

  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) {
    return NextResponse.json({ error: "Read model is not configured." }, { status: 503 });
  }

  try {
    const raw = (await supabase.callFunction("arcanum_global_stats", {})) as Record<
      string,
      unknown
    > | null;
    const stats: GlobalStats = {
      capitalGovernedUsdc: Number(raw?.capitalGovernedUsdc ?? 0),
    };
    if (!Number.isFinite(stats.capitalGovernedUsdc)) {
      stats.capitalGovernedUsdc = 0;
    }
    cached = { at: Date.now(), stats };
    return NextResponse.json(stats, {
      headers: { "cache-control": "public, max-age=60" },
    });
  } catch {
    return NextResponse.json({ error: "Global stats are unavailable right now." }, { status: 502 });
  }
}
