import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/warm/LegalPage";

export const metadata: Metadata = {
  title: "Privacy · ARCANUM",
  description:
    "What ARCANUM holds about you, what it never asks for, and what the chain remembers regardless.",
};

const GITHUB_URL = "https://github.com/bunnyyxtan/ARCANUM";

export default function PrivacyPage() {
  return (
    <LegalPage
      kicker="REFERENCE / PRIVACY"
      title="What we hold."
      lede="ARCANUM is signed into with a wallet, not an account. That makes this short: there is no profile to sell, no mailing list to leak, and most of what the product shows you was already public on chain."
      updated="6 AUGUST 2026"
      sections={[
        {
          number: "01",
          heading: "What ARCANUM holds about you",
          body: (
            <>
              <p>
                The wallet address you sign in with, the name of the workspace you create, and who
                else you let into it.
              </p>
              <p>
                The records you make while using the product: policies you deploy, vendors you
                approve or flag, escalation decisions, and the timestamps attached to them. These
                exist so a governed spend can be explained afterwards. That is the whole point of
                the ledger.
              </p>
              <p>
                Events read from Arc Testnet by our systems. That data is public chain data; we copy
                it so pages load quickly.
              </p>
            </>
          ),
        },
        {
          number: "02",
          heading: "What it never asks for",
          body: (
            <>
              <p>
                No email address. No password. No identity documents. No seed phrase, and no private
                key. Signing in is a signature you approve in your own wallet, and it gives ARCANUM
                no ability to move your funds.
              </p>
            </>
          ),
        },
        {
          number: "03",
          heading: "Cookies",
          body: (
            <>
              <p>
                One: <span className="font-mono text-[13px]">arcanum_session</span>. It is
                HTTP-only, same-site lax, expires after seven days, and holds the wallet address you
                proved ownership of. Signing out clears it.
              </p>
              <p>No advertising cookies. No cross-site trackers. Nothing is sold to anyone.</p>
            </>
          ),
        },
        {
          number: "04",
          heading: "Analytics",
          body: (
            <>
              <p>
                A deployment can be configured with product analytics. Where it is switched on it
                records page views only: automatic event capture is disabled and session recording
                is disabled, so it never sees what you type or which wallet you signed with.
              </p>
            </>
          ),
        },
        {
          number: "05",
          heading: "Where it lives, and who processes it",
          body: (
            <>
              <p>
                Workspace data sits in managed PostgreSQL. The site runs on managed hosting, and
                chain reads go through a public RPC provider. Those providers process data to run
                the service and for no other purpose.
              </p>
            </>
          ),
        },
        {
          number: "06",
          heading: "The chain remembers what we cannot erase",
          body: (
            <>
              <p>
                Wallet deployments, policies and transfers are written to Arc Testnet. That record
                is public and permanent. Removing something from ARCANUM removes it from our read
                model. It does not, and cannot, remove it from the chain.
              </p>
            </>
          ),
        },
        {
          number: "07",
          heading: "Your controls",
          body: (
            <>
              <p>Disconnect or sign out at any time; the session cookie goes with it.</p>
              <p>
                A workspace owner can remove a member from{" "}
                <Link href="/dashboard" className="warm-link text-[var(--wl-ink)] underline">
                  settings
                </Link>
                , which cuts their access to workspace data immediately.
              </p>
              <p>
                Deleting a whole workspace is not self-serve yet. Until it is, ask on the{" "}
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="warm-link text-[var(--wl-ink)] underline"
                >
                  project repository
                </a>{" "}
                and it will be done by hand.
              </p>
            </>
          ),
        },
        {
          number: "08",
          heading: "Testnet",
          body: (
            <>
              <p>
                ARCANUM currently runs against Arc Testnet. Balances are test funds with no monetary
                value, and testnet state can be reset by the network itself.
              </p>
            </>
          ),
        },
        {
          number: "09",
          heading: "Changes",
          body: (
            <>
              <p>
                This page carries the date it last changed. Anything material moves that date rather
                than arriving silently.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
