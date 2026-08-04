"use client";

import Link from "next/link";

import { ThemeToggle } from "@/components/warm/ThemeToggle";
import { useMemo, useState } from "react";
import { isAddress } from "viem";

import { shortAddress } from "@/lib/format/address";
import { configuredPublicOrigin } from "@/lib/public-url";
import { trpc } from "@/lib/trpc";

export function BadgePublicPage({ wallet }: Readonly<{ wallet: string }>) {
  const [copied, setCopied] = useState<"url" | "embed" | null>(null);
  const publicOrigin = configuredPublicOrigin();
  const validAddress = isAddress(wallet);
  const walletLabel = wallet.startsWith("0x") ? shortAddress(wallet, { tail: 6 }) : wallet;

  const profileQuery = trpc.wallets.publicProfile.useQuery(
    { address: wallet as `0x${string}` },
    {
      enabled: validAddress,
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  );
  const profile = profileQuery.data;
  const hasProfile = Boolean(profile);
  const score = profile?.postureScore ?? 0;
  const status = profile?.state ?? "NO PUBLIC PROFILE";
  const profileLabel = profile?.label ?? (hasProfile ? "Governed wallet" : walletLabel);
  const sourceLabel = profileQuery.isLoading
    ? "LOADING"
    : (profile?.dataSource ?? "NO PUBLIC PROFILE").toUpperCase();

  const badgePath = `/badge/${encodeURIComponent(wallet)}`;
  const explorerPath = `/explorer/${encodeURIComponent(wallet)}`;
  const publicBadgeUrl = `${publicOrigin}${badgePath}`;
  const embedSnippet = useMemo(
    () =>
      `<a href="${publicOrigin}${explorerPath}"><img src="${publicBadgeUrl}.svg" alt="Governed by ARCANUM" /></a>`,
    [publicOrigin, explorerPath, publicBadgeUrl],
  );

  const copyValue = (kind: "url" | "embed", value: string) => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(value);
    }
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1600);
  };

  return (
    <main className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]">
      <style>
        {
          "@keyframes jewel{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}.jewel{animation:jewel 560ms cubic-bezier(.16,1,.3,1) both}@media(prefers-reduced-motion:reduce){.jewel{animation:none}}"
        }
      </style>
      <nav className="flex items-center justify-between border-b border-[var(--wl-line)] px-5 py-5 md:px-9">
        <Link href="/" className="font-display text-[18px] font-bold tracking-[-.015em]">
          ARCANUM<span className="text-[var(--wl-signal)]">.</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href={explorerPath}
            className="font-mono text-[9px] uppercase tracking-[.15em] text-[var(--wl-body)] transition hover:text-[var(--wl-signal)]"
          >
            ← Explorer
          </Link>
          <ThemeToggle />
        </div>
      </nav>
      <div className="mx-auto max-w-[780px] px-5 py-12 text-center md:py-20">
        <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[var(--wl-signal)]">
          PUBLIC TRUST MARK / EMBEDDABLE
        </p>
        <h1 className="font-display mt-5 text-[clamp(2.8rem,6vw,5rem)] font-semibold leading-[.86] tracking-[-.015em]">
          A small mark
          <br />
          <span className="text-[var(--wl-dim)]">with a public record.</span>
        </h1>

        <section className="jewel mx-auto mt-14 max-w-[560px] border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] p-8 shadow-[14px_18px_0_var(--wl-bg-deep2)] md:p-14">
          <div className="mx-auto flex max-w-[360px] items-center gap-4 border-2 border-[var(--wl-ink)] px-5 py-5 text-left">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center bg-[var(--wl-signal)] font-mono text-[15px] font-medium text-[var(--wl-bg)]">
              A.
            </span>
            <div className="min-w-0">
              <p className="text-[18px] font-semibold tracking-[-.04em]">GOVERNED BY ARCANUM</p>
              <p className="mt-1 truncate font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-secondary)]">
                {profileLabel} · {walletLabel}
              </p>
            </div>
            {hasProfile && (
              <span className="ml-auto font-mono text-[22px] font-medium tabular-nums text-[var(--wl-green)]">
                {score}
              </span>
            )}
          </div>
          <p
            className={`mt-9 font-mono text-[9px] uppercase tracking-[.17em] ${
              hasProfile ? "text-[var(--wl-green)]" : "text-[var(--wl-mute)]"
            }`}
          >
            ● {status}
          </p>
          <Link
            href={explorerPath}
            className="mt-7 inline-block font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-signal)] underline underline-offset-4"
          >
            Inspect public record ↗
          </Link>
        </section>

        <section className="mt-14 grid grid-cols-2 gap-px overflow-hidden border border-[var(--wl-line)] bg-[var(--wl-line)] text-left sm:grid-cols-4">
          <BadgeMetric label="STATE" value={status} accent={hasProfile && score < 50} />
          <BadgeMetric label="POSTURE" value={hasProfile ? String(score) : "—"} />
          <BadgeMetric
            label="THREATS BLOCKED"
            value={
              profile?.threatsBlocked === null || profile?.threatsBlocked === undefined
                ? hasProfile
                  ? "PENDING"
                  : "0"
                : String(profile.threatsBlocked)
            }
          />
          <BadgeMetric label="SOURCE" value={sourceLabel} muted />
        </section>

        <section className="mt-14 text-left">
          <div className="flex items-end justify-between border-b border-[var(--wl-line)] pb-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
                INSTALL / ONE LINE
              </p>
              <h2 className="font-display mt-2 text-[22px] font-medium tracking-[-.015em]">
                Embed the badge
              </h2>
            </div>
            <button
              type="button"
              onClick={() => copyValue("embed", embedSnippet)}
              className="rounded-full border border-[var(--wl-line)] px-4 py-2 font-mono text-[9px] tracking-[.11em] transition hover:border-[var(--wl-ink)]"
            >
              {copied === "embed" ? "COPIED" : "COPY SNIPPET"}
            </button>
          </div>
          <pre className="mt-5 overflow-x-auto border border-[var(--wl-line)] bg-[var(--wl-bg-soft)] p-5 font-mono text-[10px] leading-[1.7] text-[var(--wl-body)]">
            <code>{embedSnippet}</code>
          </pre>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
              Links directly to the agent&apos;s read-only governance proof.
            </p>
            <button
              type="button"
              onClick={() => copyValue("url", publicBadgeUrl)}
              className="rounded-full border border-[var(--wl-line)] px-4 py-2 font-mono text-[9px] tracking-[.11em] transition hover:border-[var(--wl-ink)]"
            >
              {copied === "url" ? "URL COPIED" : "COPY BADGE URL"}
            </button>
          </div>
        </section>

        <footer className="mt-16 border-t border-[var(--wl-line)] pt-5 text-left font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
          ARCANUM · GOVERNED WALLETS FOR AI AGENTS
        </footer>
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
    <div className="bg-[var(--wl-bg-raised)] p-4">
      <div className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-mute)]">
        {label}
      </div>
      <div
        className={`mt-2 text-[18px] font-medium tracking-[-.03em] ${
          accent
            ? "text-[var(--wl-signal)]"
            : muted
              ? "text-[var(--wl-secondary)]"
              : "text-[var(--wl-ink)]"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
