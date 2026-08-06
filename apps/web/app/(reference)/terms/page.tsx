import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/warm/LegalPage";

export const metadata: Metadata = {
  title: "Terms · ARCANUM",
  description:
    "Plain-language terms for using ARCANUM while it runs on Arc Testnet: what it is, what it is not, and who is responsible for what.",
};

const GITHUB_URL = "https://github.com/bunnyyxtan/ARCANUM";

export default function TermsPage() {
  return (
    <LegalPage
      kicker="REFERENCE / TERMS"
      title="The deal."
      lede="Plain language, because terms you cannot read are not terms you agreed to. This describes how ARCANUM is offered while it runs on testnet. It is a statement of intent, not a contract drafted by lawyers."
      updated="6 AUGUST 2026"
      sections={[
        {
          number: "01",
          heading: "What ARCANUM is",
          body: (
            <>
              <p>
                A governance layer for agent-controlled wallets: deploy a wallet, write a spending
                policy, and review what the agent could not decide alone. The{" "}
                <Link href="/docs" className="warm-link text-[var(--wl-ink)] underline">
                  documentation
                </Link>{" "}
                describes it in full.
              </p>
              <p>
                ARCANUM does not take custody of funds and never holds your keys. Enforcement lives
                in the contracts on chain; this site is the surface you read and act through.
              </p>
            </>
          ),
        },
        {
          number: "02",
          heading: "Testnet, not money",
          body: (
            <>
              <p>
                Everything here runs on Arc Testnet with test tokens that have no monetary value.
                ARCANUM is not a bank, broker, exchange or custodian, and nothing on this site is
                financial, legal or tax advice.
              </p>
            </>
          ),
        },
        {
          number: "03",
          heading: "Your wallet is your responsibility",
          body: (
            <>
              <p>
                You keep your keys. Every signature you approve is yours, including the ones that
                deploy a wallet or change a policy.
              </p>
              <p>
                On-chain transactions cannot be reversed by us. If an agent spends inside the policy
                you wrote, that spend stands.
              </p>
            </>
          ),
        },
        {
          number: "04",
          heading: "Workspaces and access",
          body: (
            <>
              <p>
                Creating a workspace makes that wallet its owner. The owner decides who else gets
                in, and what they can do (viewer, approver or admin), and is responsible for that
                choice.
              </p>
              <p>
                Roles are enforced in the database, not merely hidden in the interface, and a
                workspace must always keep at least one owner.
              </p>
            </>
          ),
        },
        {
          number: "05",
          heading: "Acceptable use",
          body: (
            <>
              <p>
                Do not use ARCANUM for unlawful spend, do not attack or overload the service, and do
                not attempt to reach data belonging to a workspace you were not invited to. Access
                may be withdrawn where this is ignored.
              </p>
            </>
          ),
        },
        {
          number: "06",
          heading: "Availability",
          body: (
            <>
              <p>
                Best effort, with no uptime promise. Indexing can lag behind the chain, features can
                change, and parts of the product can be withdrawn while it is still being built. The
                chain remains the source of truth when the two disagree.
              </p>
            </>
          ),
        },
        {
          number: "07",
          heading: "Provided as-is",
          body: (
            <>
              <p>
                The software is provided as-is, without warranties of any kind. To the fullest
                extent the law allows, no liability is accepted for loss arising from use of the
                service, which, on testnet, means loss of tokens that carry no value.
              </p>
            </>
          ),
        },
        {
          number: "08",
          heading: "Before real funds",
          body: (
            <>
              <p>
                Full terms will replace this page before ARCANUM supports a network where real value
                moves. Until then, treat everything here as a pilot you are welcome to test.
              </p>
            </>
          ),
        },
        {
          number: "09",
          heading: "Questions and changes",
          body: (
            <>
              <p>
                Questions, disputes and deletion requests go to the{" "}
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="warm-link text-[var(--wl-ink)] underline"
                >
                  project repository
                </a>
                . This page carries the date it last changed.
              </p>
            </>
          ),
        },
      ]}
    />
  );
}
