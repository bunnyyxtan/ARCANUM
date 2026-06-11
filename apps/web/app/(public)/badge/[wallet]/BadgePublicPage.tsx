"use client";

import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  ShieldHalf,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { isAddress } from "viem";

import { truncateAddress } from "@/lib/format";
import { trpc } from "@/lib/trpc";

type BadgePublicPageProps = Readonly<{
  wallet: string;
}>;

const iconStroke = 1.75;

export function BadgePublicPage({ wallet }: BadgePublicPageProps) {
  const [copied, setCopied] = useState<"url" | "embed" | null>(null);
  const [publicOrigin, setPublicOrigin] = useState("");
  const profileQuery = trpc.wallets.publicProfile.useQuery(
    { address: wallet as `0x${string}` },
    {
      enabled: isAddress(wallet),
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 30_000,
    },
  );
  const profile = profileQuery.data;
  const hasProfile = Boolean(profile);
  const score = profile?.postureScore ?? 0;
  const color = !hasProfile ? "#8A909B" : score < 50 ? "#FF5A1F" : "#6E9E7C";
  const status = profile?.state ?? "NO PUBLIC PROFILE";
  const governedSince =
    profile?.governedDays === null || profile?.governedDays === undefined
      ? hasProfile
        ? "PENDING"
        : "NO PROFILE"
      : `${profile.governedDays}D`;
  const threatsBlocked =
    profile?.threatsBlocked === null || profile?.threatsBlocked === undefined
      ? hasProfile
        ? "PENDING"
        : "0"
      : String(profile.threatsBlocked);
  const sourceLabel = profileQuery.isLoading
    ? "LOADING"
    : (profile?.dataSource ?? "NO PUBLIC PROFILE").toUpperCase();
  const badgeUrl = `/badge/${encodeURIComponent(wallet)}`;
  const explorerUrl = `/explorer/${encodeURIComponent(wallet)}`;
  const embedSnippet = useMemo(
    () =>
      `<iframe src="${publicOrigin}${badgeUrl}" width="600" height="180" frameborder="0" title="Arcanum governance badge"></iframe>`,
    [badgeUrl, publicOrigin],
  );

  useEffect(() => {
    setPublicOrigin(window.location.origin);
  }, []);

  const copyValue = async (kind: "url" | "embed", value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1600);
  };

  return (
    <main className="min-h-screen bg-foundry-grid bg-[#0F1115] px-3 py-4 font-mono text-[#D7DBE0] sm:px-8 sm:py-8">
      <div className="mx-auto max-w-[1180px]">
        <header className="flex min-h-12 flex-wrap items-center justify-between gap-2 border border-[#282C34] bg-[#15171B] px-4 py-2">
          <Link
            href="/dashboard"
            className="flex cursor-pointer items-center gap-2.5 hover:text-[#EDF0F3]"
          >
            <img src="/brand/arcanum-mark.png" alt="Arcanum" className="h-6 w-6 object-contain" />
            <span className="font-cond text-[16px] font-bold tracking-[0.18em]">ARCANUM</span>
            <span className="text-[10px] tracking-[0.16em] text-[#5B626C]">/ PUBLIC BADGE</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/agents"
              className="flex h-8 cursor-pointer items-center gap-2 border border-[#282C34] px-3 text-[10px] tracking-[0.12em] text-[#8A909B] hover:border-[#3A4250] hover:text-[#D7DBE0]"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={iconStroke} />
              BACK TO AGENTS
            </Link>
            <Link
              href={explorerUrl}
              className="flex h-8 cursor-pointer items-center gap-2 border border-[#3A4250] px-3 text-[10px] tracking-[0.12em] text-[#D7DBE0] hover:border-[#FF5A1F] hover:text-[#FF5A1F]"
            >
              VIEW EXPLORER
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={iconStroke} />
            </Link>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="border border-[#282C34] bg-[#15171B]">
            <div className="border-b border-[#282C34] px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] tracking-[0.24em] text-[#5B626C]">
                    PUBLIC GOVERNANCE BADGE
                  </div>
                  <h1 className="mt-2 font-cond text-[36px] font-bold tracking-[0.04em] text-[#EDF0F3]">
                    {truncateAddress(wallet, 8, 6)}
                  </h1>
                  <div className="mt-2 text-[12px] leading-relaxed text-[#8A909B]">
                    Shareable proof that this wallet is governed by Arcanum policy. This page uses
                    wallet-specific public read data and does not reveal private doctrine secrets.
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] tracking-[0.18em] text-[#5B626C]">POSTURE</div>
                  <div className="font-cond text-[72px] font-bold leading-none" style={{ color }}>
                    {score}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 divide-y divide-[#282C34] border-b border-[#282C34] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
              <BadgeMetric label="STATE" value={status} accent={score < 50} />
              <BadgeMetric label="GOVERNED SINCE" value={governedSince} />
              <BadgeMetric label="THREATS BLOCKED" value={threatsBlocked} />
              <BadgeMetric label="SOURCE" value={sourceLabel} muted />
            </div>

            <div className="p-6">
              <div className="overflow-hidden border border-[#282C34] bg-[#101216]">
                <div className="flex min-h-[92px] flex-col lg:flex-row lg:items-center">
                  <div className="flex min-h-[92px] w-full items-center gap-3 border-b border-[#282C34] px-5 lg:w-[190px] lg:border-b-0 lg:border-r">
                    <img
                      src="/brand/arcanum-mark.png"
                      alt="Arcanum"
                      className="h-9 w-9 object-contain"
                    />
                    <div>
                      <div className="font-cond text-[18px] font-bold tracking-[0.18em]">
                        ARCANUM
                      </div>
                      <div className="text-[9px] tracking-[0.14em] text-[#5B626C]">
                        GOVERNANCE BADGE
                      </div>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 px-5 py-4 lg:py-0">
                    <div className="min-w-0">
                      <div className="font-mono text-[13px] text-[#EDF0F3]">
                        {truncateAddress(wallet, 10, 8)}
                      </div>
                      <div className="mt-1 text-[10px] tracking-[0.12em] text-[#8A909B]">
                        {hasProfile ? "GOVERNED WALLET" : "PUBLIC PROFILE PENDING"} / ARC TESTNET
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-[min(180px,32vw)] bg-[#20242B]">
                        <div
                          className="h-full"
                          style={{
                            width: `${Math.max(score, hasProfile ? 4 : 0)}%`,
                            background: color,
                          }}
                        />
                      </div>
                      <span className="font-cond text-[38px] font-bold" style={{ color }}>
                        {score}
                      </span>
                    </div>
                  </div>
                  <div
                    className="mx-5 mb-4 inline-flex items-center gap-2 self-start border px-3 py-1.5 text-[10px] tracking-[0.14em] lg:mb-0 lg:self-auto"
                    style={{ borderColor: `${color}66`, background: `${color}1A`, color }}
                  >
                    <ShieldCheck className="h-4 w-4" strokeWidth={iconStroke} />
                    {status}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => void copyValue("url", window.location.href)}
                  className="flex h-10 cursor-pointer items-center justify-center gap-2 border border-[#282C34] text-[11px] tracking-[0.12em] text-[#8A909B] hover:border-[#3A4250] hover:text-[#D7DBE0]"
                >
                  {copied === "url" ? (
                    <Check className="h-3.5 w-3.5" strokeWidth={iconStroke} />
                  ) : (
                    <Copy className="h-3.5 w-3.5" strokeWidth={iconStroke} />
                  )}
                  {copied === "url" ? "BADGE URL COPIED" : "COPY BADGE URL"}
                </button>
                <Link
                  href={explorerUrl}
                  className="flex h-10 cursor-pointer items-center justify-center gap-2 border border-[#3A4250] text-[11px] tracking-[0.12em] text-[#D7DBE0] hover:border-[#FF5A1F] hover:text-[#FF5A1F]"
                >
                  OPEN EXPLORER
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={iconStroke} />
                </Link>
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="border border-[#282C34] bg-[#15171B] p-5">
              <div className="text-[10px] tracking-[0.2em] text-[#5B626C]">EMBED SNIPPET</div>
              <p className="mt-2 text-[12px] leading-relaxed text-[#8A909B]">
                Paste this snippet into a README, portal, or partner page to show the public badge.
              </p>
              <pre className="mt-4 overflow-hidden border border-[#282C34] bg-[#101216] p-3 text-[10px] leading-relaxed text-[#6E9E7C]">
                {embedSnippet}
              </pre>
              <button
                type="button"
                onClick={() => void copyValue("embed", embedSnippet)}
                className="mt-3 flex h-9 w-full cursor-pointer items-center justify-center gap-2 border border-[#282C34] text-[11px] tracking-[0.12em] text-[#8A909B] hover:border-[#3A4250] hover:text-[#D7DBE0]"
              >
                {copied === "embed" ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={iconStroke} />
                ) : (
                  <Copy className="h-3.5 w-3.5" strokeWidth={iconStroke} />
                )}
                {copied === "embed" ? "EMBED COPIED" : "COPY EMBED CODE"}
              </button>
            </div>
            <div className="border border-[#282C34] bg-[#15171B] p-5">
              <div className="text-[10px] tracking-[0.2em] text-[#5B626C]">HONEST DATA STATE</div>
              <div className="mt-3 text-[12px] leading-relaxed text-[#8A909B]">
                Badge posture is displayed only when public Supabase or known demo fallback data
                exists for this wallet. Unknown wallets are not assigned demo metrics.
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function BadgeMetric({
  accent,
  label,
  muted,
  value,
}: Readonly<{ accent?: boolean; label: string; muted?: boolean; value: string }>) {
  return (
    <div className="p-4">
      <div className="text-[10px] tracking-[0.16em] text-[#5B626C]">{label}</div>
      <div
        className={[
          "mt-1 font-cond text-[24px] font-semibold",
          accent ? "text-[#FF5A1F]" : muted ? "text-[#8A909B]" : "text-[#EDF0F3]",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}
