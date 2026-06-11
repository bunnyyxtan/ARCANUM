"use client";

type BrowserSupabaseConfig = {
  configured: boolean;
  url: string | null;
  anonKey: string | null;
};

export function getBrowserSupabaseConfig(): BrowserSupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? null;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? null;

  return {
    configured: Boolean(url && anonKey),
    url,
    anonKey,
  };
}
