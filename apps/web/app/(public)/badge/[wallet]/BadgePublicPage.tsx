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
import { useMemo, useState } from "react";
import { isAddress } from "viem";

import { truncateAddress } from "@/lib/format";
import { configuredPublicOrigin } from "@/lib/public-url";
import { trpc } from "@/lib/trpc";

type BadgePublicPageProps = Readonly<{
  wallet: string;
}>;

const iconStroke = 1.75;

export function BadgePublicPage({ wallet }: BadgePublicPageProps) {
  const [copied, setCopied] = useState<"url" | "embed" | null>(null);
  const publicOrigin = configuredPublicOrigin();
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
  const color = !hasProfile ? "var(--wl-text-secondary)" : score < 50 ? "var(--wl-signal)" : "var(--wl-green)";
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
  const publicBadgeUrl = `${publicOrigin}${badgeUrl}`;
  const explorerUrl = `/explorer/${encodeURIComponent(wallet)}`;
  const embedSnippet = useMemo(
    () =>
      `<iframe src="${publicOrigin}${badgeUrl}" width="600" height="180" frameborder="0" title="Arcanum governance badge"></iframe>`,
    [badgeUrl, publicOrigin],
  );

  const copyValue = async (kind: "url" | "embed", value: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1600);
  };

  return (
    <main className="min-h-screen bg-foundry-grid bg-[var(--wl-inset)] px-3 py-4 font-mono text-[var(--wl-text-body)] sm:px-8 sm:py-8">
      <div className="mx-auto max-w-[1180px]">
        <header className="flex min-h-12 flex-wrap items-center justify-between gap-2 border border-[var(--wl-hairline)] bg-[var(--wl-panel-mid)] px-4 py-2">
          <Link
            href="/dashboard"
            className="flex cursor-pointer items-center gap-2.5 hover:text-[var(--wl-text-primary)]"
          >
            <img
              src="/brand/arcanum-logo.png"
              alt="Arcanum"
              className="h-8 w-auto object-contain"
            />
            <span className="font-cond text-[16px] font-bold tracking-[0.18em]">ARCANUM</span>
            <span className="text-[10px] tracking-[0.16em] text-[var(--wl-text-muted)]">/ PUBLIC BADGE</span>
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/agents"
              className="flex h-8 cursor-pointer items-center gap-2 border border-[var(--wl-hairline)] px-3 text-[10px] tracking-[0.12em] text-[var(--wl-text-secondary)] hover:border-[var(--wl-line-active)] hover:text-[var(--wl-text-body)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={iconStroke} />
              BACK TO AGENTS
            </Link>
            <Link
              href={explorerUrl}
              className="flex h-8 cursor-pointer items-center gap-2 border border-[var(--wl-line-active)] px-3 text-[10px] tracking-[0.12em] text-[var(--wl-text-body)] hover:border-[var(--wl-signal)] hover:text-[var(--wl-signal)]"
            >
              VIEW EXPLORER
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={iconStroke} />
            </Link>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="border border-[var(--wl-hairline)] bg-[var(--wl-panel-mid)]">
            <div className="border-b border-[var(--wl-hairline)] px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] tracking-[0.24em] text-[var(--wl-text-muted)]">
                    PUBLIC GOVERNANCE BADGE
                  </div>
                  <h1 className="mt-2 font-cond text-[36px] font-bold tracking-[0.04em] text-[var(--wl-text-primary)]">
                    {truncateAddress(wallet, 8, 6)}
                  </h1>
                  <div className="mt-2 text-[12px] leading-relaxed text-[var(--wl-text-secondary)]">
                    Shareable proof that this wallet is governed by Arcanum policy. This page uses
                    wallet-specific public read data and does not reveal private doctrine secrets.
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] tracking-[0.18em] text-[var(--wl-text-muted)]">POSTURE</div>
                  <div className="font-cond text-[72px] font-bold leading-none" style={{ color }}>
                    {score}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 divide-y divide-[var(--wl-hairline)] border-b border-[var(--wl-hairline)] sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
              <BadgeMetric label="STATE" value={status} accent={score < 50} />
              <BadgeMetric label="GOVERNED SINCE" value={governedSince} />
              <BadgeMetric label="THREATS BLOCKED" value={threatsBlocked} />
              <BadgeMetric label="SOURCE" value={sourceLabel} muted />
            </div>

            <div className="p-6">
              <div className="overflow-hidden border border-[var(--wl-hairline)] bg-[var(--wl-inset)]">
                <div className="flex min-h-[92px] flex-col lg:flex-row lg:items-center">
                  <div className="flex min-h-[92px] w-full items-center gap-3 border-b border-[var(--wl-hairline)] px-5 lg:w-[190px] lg:border-b-0 lg:border-r">
                    <img
                      src="/brand/arcanum-logo.png"
                      alt="Arcanum"
                      className="h-9 w-9 object-contain"
                    />
                    <div>
                      <div className="font-cond text-[18px] font-bold tracking-[0.18em]">
                        ARCANUM
                      </div>
                      <div className="text-[9px] tracking-[0.14em] text-[var(--wl-text-muted)]">
                        GOVERNANCE BADGE
                      </div>
                    </div>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 px-5 py-4 lg:py-0">
                    <div className="min-w-0">
                      <div className="font-mono text-[13px] text-[var(--wl-text-primary)]">
                        {truncateAddress(wallet, 10, 8)}
                      </div>
                      <div className="mt-1 text-[10px] tracking-[0.12em] text-[var(--wl-text-secondary)]">
                        {hasProfile ? "GOVERNED WALLET" : "PUBLIC PROFILE PENDING"} / ARC TESTNET
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-[min(180px,32vw)] bg-[var(--wl-panel-muted)]">
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
                  onClick={() => void copyValue("url", publicBadgeUrl)}
                  className="flex h-10 cursor-pointer items-center justify-center gap-2 border border-[var(--wl-hairline)] text-[11px] tracking-[0.12em] text-[var(--wl-text-secondary)] hover:border-[var(--wl-line-active)] hover:text-[var(--wl-text-body)]"
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
                  className="flex h-10 cursor-pointer items-center justify-center gap-2 border border-[var(--wl-line-active)] text-[11px] tracking-[0.12em] text-[var(--wl-text-body)] hover:border-[var(--wl-signal)] hover:text-[var(--wl-signal)]"
                >
                  OPEN EXPLORER
                  <ExternalLink className="h-3.5 w-3.5" strokeWidth={iconStroke} />
                </Link>
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="border border-[var(--wl-hairline)] bg-[var(--wl-panel-mid)] p-5">
              <div className="text-[10px] tracking-[0.2em] text-[var(--wl-text-muted)]">EMBED SNIPPET</div>
              <p className="mt-2 text-[12px] leading-relaxed text-[var(--wl-text-secondary)]">
                Paste this snippet into a README, portal, or partner page to show the public badge.
              </p>
              <pre className="mt-4 overflow-hidden border border-[var(--wl-hairline)] bg-[var(--wl-inset)] p-3 text-[10px] leading-relaxed text-[var(--wl-green)]">
                {embedSnippet}
              </pre>
              <button
                type="button"
                onClick={() => void copyValue("embed", embedSnippet)}
                className="mt-3 flex h-9 w-full cursor-pointer items-center justify-center gap-2 border border-[var(--wl-hairline)] text-[11px] tracking-[0.12em] text-[var(--wl-text-secondary)] hover:border-[var(--wl-line-active)] hover:text-[var(--wl-text-body)]"
              >
                {copied === "embed" ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={iconStroke} />
                ) : (
                  <Copy className="h-3.5 w-3.5" strokeWidth={iconStroke} />
                )}
                {copied === "embed" ? "EMBED COPIED" : "COPY EMBED CODE"}
              </button>
            </div>
            <div className="border border-[var(--wl-hairline)] bg-[var(--wl-panel-mid)] p-5">
              <div className="text-[10px] tracking-[0.2em] text-[var(--wl-text-muted)]">HONEST DATA STATE</div>
              <div className="mt-3 text-[12px] leading-relaxed text-[var(--wl-text-secondary)]">
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
      <div className="text-[10px] tracking-[0.16em] text-[var(--wl-text-muted)]">{label}</div>
      <div
        className={[
          "mt-1 font-cond text-[24px] font-semibold",
          accent ? "text-[var(--wl-signal)]" : muted ? "text-[var(--wl-text-secondary)]" : "text-[var(--wl-text-primary)]",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}
