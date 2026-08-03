"use client";

import Link from "next/link";

import { ThemeToggle } from "@/components/warm/ThemeToggle";
import { useState } from "react";
import { isAddress } from "viem";

import { getArcscanAddressUrl, getArcscanTxUrl } from "@/lib/arcscan";
import { shortAddress } from "@/lib/format/address";
import { formatUsd } from "@/lib/format/money";
import { useLiveLedgerByWallet } from "@/lib/live-data";
import type { LedgerEntry, LedgerStatus } from "@/lib/types";
import { trpc } from "@/lib/trpc";

const verdictLabel: Record<LedgerStatus, string> = {
  approved: "ALLOWED",
  rejected: "DENIED",
  escalated: "ESCALATED",
  frozen: "FROZEN",
};

function verdictClass(status: LedgerStatus) {
  if (status === "approved") {
    return "bg-[var(--wl-green-tint)] text-[var(--wl-green)]";
  }
  return "border border-[var(--wl-line)] text-[var(--wl-secondary)]";
}

export function ExplorerPublicPage({ wallet }: Readonly<{ wallet: string }>) {
  const [copied, setCopied] = useState(false);
  const validAddress = isAddress(wallet);
  const walletLabel = wallet.startsWith("0x") ? shortAddress(wallet, { tail: 6 }) : wallet;
  const badgeHref = `/badge/${encodeURIComponent(wallet)}`;
  const walletUrl = getArcscanAddressUrl(wallet);

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
  const profileLabel = profile?.label ?? (hasProfile ? "Governed wallet" : walletLabel);
  const profileState = profile?.state ?? "NO PUBLIC PROFILE";
  const dataSource = profileQuery.isLoading
    ? "LOADING"
    : (profile?.dataSource ?? "NO PUBLIC PROFILE").toUpperCase();

  const ledgerQuery = useLiveLedgerByWallet(validAddress ? wallet : null);
  const records: LedgerEntry[] = ledgerQuery.data ?? [];

  const copy = () => {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(wallet);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <main className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]">
      <style>{`@keyframes enter{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}.enter{animation:enter 440ms cubic-bezier(.16,1,.3,1) both}@media(prefers-reduced-motion:reduce){.enter{animation:none}}`}</style>
      <nav className="flex items-center justify-between border-b border-[var(--wl-line)] px-5 py-5 md:px-9">
        <Link href="/" className="font-display text-[18px] font-bold tracking-[-.015em]">
          ARCANUM<span className="text-[var(--wl-signal)]">.</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-mute)] sm:inline">
            PUBLIC EXPLORER
          </span>
          <Link
            href={badgeHref}
            className="rounded-full border border-[var(--wl-line)] px-4 py-2 font-mono text-[9px] tracking-[.12em] transition hover:border-[var(--wl-ink)]"
          >
            GET BADGE ↗
          </Link>
          <ThemeToggle />
        </div>
      </nav>
      <div className="mx-auto max-w-[1120px] px-5 py-10 md:px-9 md:py-16">
      <header className="enter border-b border-[var(--wl-line)] pb-10">
        <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[var(--wl-signal)]">
          ARC / PUBLIC VERIFICATION
        </p>
        <div className="mt-5 flex flex-col justify-between gap-8 md:flex-row md:items-end">
          <div>
            <h1 className="font-display text-[clamp(3rem,7vw,6rem)] font-semibold leading-[.84] tracking-[-.015em]">
              {profileLabel}
            </h1>
            <p className="mt-5 max-w-[500px] text-[14px] leading-[1.5] text-[var(--wl-body)]">
              A governed autonomous wallet. Anyone can verify its doctrine and public spend.
            </p>
          </div>
          <span
            className={`flex w-fit items-center gap-2 rounded-full px-3 py-2 font-mono text-[9px] tracking-[.12em] ${
              hasProfile
                ? "bg-[var(--wl-green-tint)] text-[var(--wl-green)]"
                : "border border-[var(--wl-line)] text-[var(--wl-secondary)]"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                hasProfile ? "bg-[var(--wl-green-bright)]" : "bg-[var(--wl-mute)]"
              }`}
            />{" "}
            {profileState}
          </span>
        </div>
      </header>

      <section
        className="enter grid border-b border-[var(--wl-line)] md:grid-cols-[1.15fr_.85fr]"
        style={{ animationDelay: "100ms" }}
      >
        <div className="py-8 md:pr-10">
          <p className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-mute)]">
            WALLET IDENTITY
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <code className="font-mono text-[15px]">{walletLabel}</code>
            <button
              type="button"
              onClick={copy}
              className="rounded-full border border-[var(--wl-line)] px-3 py-1.5 font-mono text-[9px] transition hover:border-[var(--wl-ink)]"
            >
              {copied ? "COPIED" : "COPY"}
            </button>
            {walletUrl && (
              <a
                href={walletUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-full border border-[var(--wl-line)] px-3 py-1.5 font-mono text-[9px] transition hover:border-[var(--wl-ink)]"
              >
                ARCSCAN ↗
              </a>
            )}
          </div>
          <p className="mt-4 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-secondary)]">
            ARC TESTNET · USDC · READ MODEL: {dataSource}
          </p>
        </div>
        <div className="border-t border-[var(--wl-line)] py-8 md:border-l md:border-t-0 md:pl-7">
          <p className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-mute)]">
            GOVERNANCE PROOF
          </p>
          <p className="mt-4 text-[19px] font-medium tracking-[-.04em]">
            Posture{" "}
            {profile?.postureScore === null || profile?.postureScore === undefined
              ? "pending"
              : `${profile.postureScore} / 100`}
            .
          </p>
          <p className="mt-2 text-[12px] leading-[1.5] text-[var(--wl-body)]">
            Vendors, caps, and every decision are recorded by ARCANUM.
          </p>
          <Link
            href={badgeHref}
            className="mt-5 inline-block font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-signal)] underline underline-offset-4"
          >
            Use this proof on your site ↗
          </Link>
        </div>
      </section>

      <section className="enter pt-10" style={{ animationDelay: "180ms" }}>
        <div className="flex items-end justify-between border-b border-[var(--wl-line)] pb-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
              PUBLIC LEDGER / {String(records.length).padStart(2, "0")} RECORDS
            </p>
            <h2 className="font-display mt-2 text-[23px] font-medium tracking-[-.015em]">
              Recent governed spend
            </h2>
          </div>
          <span className="font-mono text-[9px] text-[var(--wl-mute)]">UTC · READ ONLY</span>
        </div>
        <div className="hidden grid-cols-[1fr_1.3fr_1fr_1fr_1.2fr] gap-4 border-b border-[var(--wl-line)] px-3 py-3 font-mono text-[9px] uppercase tracking-[.13em] text-[var(--wl-mute)] md:grid">
          <span>Time</span>
          <span>Vendor</span>
          <span>Amount</span>
          <span>Verdict</span>
          <span>Transaction</span>
        </div>

        {ledgerQuery.isError ? (
          <p className="px-3 py-10 font-mono text-[11px] text-[var(--wl-red)]">
            ERR / PUBLIC LEDGER UNAVAILABLE. Try again shortly.
          </p>
        ) : ledgerQuery.isLoading ? (
          <div className="divide-y divide-[var(--wl-line-soft)]">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="grid gap-2 px-3 py-4 md:grid-cols-[1fr_1.3fr_1fr_1fr_1.2fr] md:items-center"
              >
                {[0, 1, 2, 3, 4].map((c) => (
                  <span
                    key={c}
                    className="h-3 w-3/4 animate-pulse rounded bg-[var(--wl-bg-soft)]"
                  />
                ))}
              </div>
            ))}
          </div>
        ) : records.length === 0 ? (
          <p className="px-3 py-10 font-mono text-[11px] uppercase tracking-[.13em] text-[var(--wl-mute)]">
            No public governed spend indexed for this wallet yet.
          </p>
        ) : (
          <div className="divide-y divide-[var(--wl-line-soft)]">
            {records.map((r) => {
              const txUrl = getArcscanTxUrl(r.hash);
              return (
                <div
                  key={r.id}
                  className="grid gap-2 px-3 py-4 transition hover:translate-x-1 hover:bg-[var(--wl-bg-soft)] md:grid-cols-[1fr_1.3fr_1fr_1fr_1.2fr] md:items-center"
                >
                  <span className="font-mono text-[10px] text-[var(--wl-secondary)]">
                    {r.timestamp}
                  </span>
                  <span className="text-[12px] font-medium">{r.counterparty}</span>
                  <span className="font-mono text-[12px] tabular-nums">{formatUsd(r.amount)}</span>
                  <span
                    className={`w-fit rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.12em] ${verdictClass(r.status)}`}
                  >
                    {verdictLabel[r.status]}
                  </span>
                  {txUrl ? (
                    <a
                      href={txUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-mono text-[10px] text-[var(--wl-signal)] underline underline-offset-4"
                    >
                      {shortAddress(r.hash, { tail: 4 })} ↗
                    </a>
                  ) : (
                    <span className="font-mono text-[10px] text-[var(--wl-secondary)]">
                      {shortAddress(r.hash, { tail: 4 })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <footer className="mt-14 flex flex-wrap justify-between gap-4 border-t border-[var(--wl-line)] pt-5 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
        <span>ARCANUM · PUBLIC READ MODEL</span>
        <span>{walletLabel} · ARC TESTNET</span>
      </footer>
      </div>
    </main>
  );
}
