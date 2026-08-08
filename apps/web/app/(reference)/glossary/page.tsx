"use client";

import { ARC_NETWORK_BADGE } from "@arcanum/shared";
import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";

type Term = { term: string; letter: string; definition: string; detail: string; related: string[] };

const terms: Term[] = [
  {
    term: "Allowlist",
    letter: "A",
    definition: "The bounded set of vendors, contracts, or destinations an agent may address.",
    detail:
      "An allowlist is deliberately boring. If AWS and OpenAI are named, an otherwise valid request to an unknown destination still stops. Allowlist entries are versioned with the doctrine that authorizes them.",
    related: ["Doctrine", "Governed wallet"],
  },
  {
    term: "Anomaly",
    letter: "A",
    definition:
      "A measurable deviation from an agent's expected spend pattern or operating posture.",
    detail:
      "An anomaly is a signal for investigation, not an automatic accusation. ARCANUM compares amount, velocity, vendor, and time against the agent's recent baseline.",
    related: ["Restraint", "Operator"],
  },
  {
    term: "Arc testnet",
    letter: "A",
    definition:
      "The rehearsal network where HELIX-DAO validates wallet behavior before production capital is at risk.",
    detail:
      "The signing flow, policy trace, and ledger shape should be practiced here first. Testnet USDC is a safe way to inspect the complete control loop.",
    related: ["Governed wallet", "Ledger"],
  },
  {
    term: "Doctrine",
    letter: "D",
    definition:
      "A signed, executable policy that states when an agent may spend and what happens outside the line.",
    detail:
      "Doctrines are instruments, not suggestions. They carry a version, an author, an expiry, and the exact vendors, caps, assets, and quorum rules they enforce.",
    related: ["Allowlist", "Escalation"],
  },
  {
    term: "Escalation",
    letter: "E",
    definition:
      "A deliberate pause that asks one or more human operators to decide an exceptional request.",
    detail:
      "An escalation preserves context: request amount, vendor, reason, policy trace, quorum, and expiry. Approving or rejecting it adds a human decision to the ledger.",
    related: ["Restraint", "Operator"],
  },
  {
    term: "Governed wallet",
    letter: "G",
    definition:
      "An on-chain wallet whose outgoing transactions are checked against a doctrine before settlement.",
    detail:
      "The agent can propose spend, but it does not hold the operator key. The governed wallet is the boundary where intent becomes accountable capital movement.",
    related: ["Doctrine", "Operator"],
  },
  {
    term: "Ledger",
    letter: "L",
    definition:
      "The append-only record of proposals, policy verdicts, transactions, and human decisions.",
    detail:
      "A ledger entry answers four questions: what was requested, what policy said, what moved on-chain, and who stepped in. It is the memory of the control loop.",
    related: ["Restraint", "Arc testnet"],
  },
  {
    term: "Operator",
    letter: "O",
    definition:
      "A trusted human who authors doctrine, reviews exceptions, and owns the decision record.",
    detail:
      "Operators are not expected to watch every transaction. ARCANUM narrows their attention to the requests that policy cannot safely decide alone.",
    related: ["Escalation", "Doctrine"],
  },
  {
    term: "Restraint",
    letter: "R",
    definition: "The intentional act of stopping or slowing an agent's proposed spend.",
    detail:
      "A restraint can be automatic, when a request is blocked by policy, or human, when an escalation awaits an operator. It is a control outcome, not a system failure.",
    related: ["Anomaly", "Escalation"],
  },
  {
    term: "SIWE",
    letter: "S",
    definition:
      "Sign-In with Ethereum: a wallet-signed message that establishes an operator session without sharing a private key.",
    detail:
      "The message binds the operator to HELIX-DAO, Arc testnet, a nonce, and an expiry. Re-check the domain and chain before signing.",
    related: ["Operator", "Governed wallet"],
  },
];

function StatusMark({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-[var(--wl-green-tint)] px-2.5 py-1 font-mono text-[9px] tracking-[.12em] text-[var(--wl-green)]">
      {children}
    </span>
  );
}

export default function GlossaryPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("Governed wallet");
  const [letter, setLetter] = useState("ALL");
  const letters = ["ALL", "A", "D", "E", "G", "L", "O", "R", "S"];
  const visibleTerms = useMemo(
    () =>
      terms.filter(
        (item) =>
          (letter === "ALL" || item.letter === letter) &&
          `${item.term} ${item.definition}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [letter, query],
  );
  // biome-ignore lint/style/noNonNullAssertion: terms is a non-empty static array
  const active: Term = terms.find((item) => item.term === selected) ?? visibleTerms[0] ?? terms[0]!;

  return (
    <main className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]">
      <style>{`
        .glossary-row{transition:transform 220ms cubic-bezier(.16,1,.3,1),background 220ms ease,box-shadow 220ms ease}
        .glossary-row:hover{transform:translateX(3px);background:var(--wl-bg-soft)}
        .glossary-row[data-active="true"]{box-shadow:inset 2px 0 0 var(--wl-signal);background:var(--wl-bg-soft)}
        .glossary-letter{transition:color 220ms ease,background 220ms ease}
        .glossary-letter:hover{color:var(--wl-ink);background:var(--wl-bg-soft)}
        .glossary-detail{animation:glossaryIn 360ms cubic-bezier(.16,1,.3,1) both}
        @keyframes glossaryIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        @media (prefers-reduced-motion:reduce){.glossary-row,.glossary-letter,.glossary-detail{transition:none;animation:none}}
      `}</style>
      <div className="mx-auto max-w-[1400px] px-5 py-9 md:px-8 md:py-12">
        <div className="flex flex-col justify-between gap-8 border-b border-[var(--wl-line)] pb-10 lg:flex-row lg:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[var(--wl-signal)]">
              ARCANUM / REFERENCE INDEX
            </p>
            <h1 className="font-display mt-5 text-[clamp(3.2rem,7vw,6.6rem)] font-semibold leading-[.84] tracking-[-.015em]">
              The vocabulary
              <br />
              <span className="text-[var(--wl-dim)]">of accountable spend.</span>
            </h1>
            <p className="mt-7 max-w-[540px] text-[15px] leading-[1.5] text-[var(--wl-body)]">
              Terms for operators who need the same word to mean the same control. Browse the
              language behind HELIX-DAO's governed wallets.
            </p>
          </div>
          <div className="max-w-[250px] border-l border-[var(--wl-signal)] pl-4">
            <p className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-signal)]">
              INDEX / 10 TERMS
            </p>
            <p className="mt-3 text-[12px] leading-[1.5] text-[var(--wl-secondary2)]">
              A living reference. Doctrines change; the meaning of a recorded decision should not.
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_390px]">
          <section>
            <div className="flex flex-col gap-5 border-b border-[var(--wl-line)] pb-5 md:flex-row md:items-center md:justify-between">
              <label className="flex items-center gap-3 border-b border-[var(--wl-faint)] pb-2 md:w-[300px]">
                <span className="font-mono text-[12px] text-[var(--wl-signal)]">⌕</span>
                <input
                  aria-label="Search glossary"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search terms"
                  className="w-full bg-transparent text-[13px] outline-none placeholder:text-[var(--wl-mute)]"
                />
              </label>
              <div className="flex flex-wrap gap-1.5">
                {letters.map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() => setLetter(item)}
                    className={`glossary-letter rounded-full px-2.5 py-1.5 font-mono text-[9px] tracking-[.12em] ${letter === item ? "bg-[var(--wl-ink)] text-[var(--wl-bg)]" : "text-[var(--wl-secondary)]"}`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[.15em] text-[var(--wl-mute)]">
                {visibleTerms.length} MATCHES / ALPHABETICAL
              </p>
              <Link
                href="/docs"
                className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-body)] underline decoration-[var(--wl-signal)] underline-offset-4 hover:text-[var(--wl-signal)]"
              >
                Read the field manual
              </Link>
            </div>
            <div className="mt-3 divide-y divide-[var(--wl-line-soft)] border-y border-[var(--wl-line)]">
              {visibleTerms.length ? (
                visibleTerms.map((item) => (
                  <button
                    type="button"
                    key={item.term}
                    data-active={active.term === item.term}
                    onClick={() => setSelected(item.term)}
                    className="glossary-row grid w-full grid-cols-[40px_1fr] gap-3 px-3 py-5 text-left md:grid-cols-[46px_170px_1fr] md:items-center"
                  >
                    <span className="font-mono text-[10px] text-[var(--wl-signal)]">
                      {item.letter}
                    </span>
                    <span className="text-[16px] font-medium tracking-[-.02em]">{item.term}</span>
                    <span className="text-[12px] leading-[1.45] text-[var(--wl-secondary2)]">
                      {item.definition}
                    </span>
                  </button>
                ))
              ) : (
                <div className="border border-dashed border-[var(--wl-faint)] px-5 py-12 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-[.15em] text-[var(--wl-secondary)]">
                    NO TERMS FOUND
                  </p>
                  <p className="mt-3 text-[13px] text-[var(--wl-secondary2)]">
                    Clear the search or return to the full index.
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-between pt-4 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
              <span>HELIX-DAO · {ARC_NETWORK_BADGE}</span>
              <span>ON RECORD / V4.18</span>
            </div>
          </section>

          <aside className="h-fit border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] shadow-[12px_14px_0_var(--wl-line-faint)] lg:sticky lg:top-5">
            <div className="border-b border-[var(--wl-line)] px-6 py-5">
              <div className="flex items-center justify-between">
                <p className="font-mono text-[9px] uppercase tracking-[.17em] text-[var(--wl-signal)]">
                  SELECTED ENTRY
                </p>
                <StatusMark>DEFINED</StatusMark>
              </div>
            </div>
            <div key={active.term} className="glossary-detail px-6 py-7">
              <p className="font-mono text-[11px] text-[var(--wl-signal)]">
                {active.letter} / 0{terms.indexOf(active) + 1}
              </p>
              <h2 className="font-display mt-3 text-[34px] font-medium tracking-[-.015em]">
                {active.term}
              </h2>
              <p className="mt-5 text-[16px] leading-[1.5] text-[var(--wl-strong3)]">
                {active.definition}
              </p>
              <div className="mt-7 border-t border-[var(--wl-line)] pt-5">
                <p className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-mute)]">
                  IN PRACTICE
                </p>
                <p className="mt-3 text-[13px] leading-[1.55] text-[var(--wl-body)]">
                  {active.detail}
                </p>
              </div>
              <div className="mt-7 border-t border-[var(--wl-line)] pt-5">
                <p className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-mute)]">
                  SEE ALSO
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {active.related.map((item) => (
                    <button
                      type="button"
                      key={item}
                      onClick={() => setSelected(item)}
                      className="rounded-full border border-[var(--wl-line)] px-3 py-1.5 text-[11px] text-[var(--wl-body)] transition-colors hover:border-[var(--wl-signal)] hover:text-[var(--wl-signal)]"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="border-t border-[var(--wl-line)] bg-[var(--wl-bg-soft)] px-6 py-4 font-mono text-[9px] uppercase leading-[1.7] tracking-[.1em] text-[var(--wl-secondary)]">
              TERM OWNER / ARCANUM
              <br />
              LAST REVIEW / 2025-08-14
            </div>
          </aside>
        </div>

        <div className="mt-20 flex flex-col justify-between gap-6 border-t border-[var(--wl-line)] pt-8 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
              KEEP READING
            </p>
            <h2 className="mt-3 text-[26px] font-medium tracking-[-.05em]">
              The words become useful in the field.
            </h2>
          </div>
          <Link
            href="/docs"
            className="inline-flex w-fit rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[11px] font-semibold text-white transition-transform duration-[220ms] hover:-translate-y-0.5 hover:bg-[var(--wl-signal-deep)]"
          >
            Open the field manual <span className="ml-2">↗</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
