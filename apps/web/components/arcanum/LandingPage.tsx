import {
  AlertTriangle,
  ArrowRight,
  Ban,
  BookOpen,
  Check,
  ChevronRight,
  Eye,
  Flag,
  Github,
  Globe,
  Lock,
  ScrollText,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldHalf,
  Snowflake,
  TriangleAlert,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import Link from "next/link";

/* -------------------------------------------------------------------------- */
/*  SECTION 1 — FOUNDRY-style Hero                                            */
/* -------------------------------------------------------------------------- */
function HeroSection() {
  return (
    <section className="relative border-b border-[#282C34]">
      {/* Scanline overlay for depth */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(255,255,255,0.04) 2px, rgba(255,255,255,0.04) 3px)",
        }}
      />

      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-8 px-5 py-16 lg:grid-cols-[1fr_minmax(0,460px)] lg:gap-12 lg:py-24">
        {/* Left — copy block */}
        <div className="flex flex-col justify-center">
          <div className="inline-flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#FF5A1F]">
            <span className="h-1.5 w-1.5 animate-pulse bg-[#FF5A1F]" />
            BUILT ON ARC
          </div>

          <h1 className="mt-5 font-cond text-[42px] font-bold leading-[1.05] tracking-[0.02em] text-[#EDF0F3] sm:text-[52px] lg:text-[60px]">
            The doctrine layer for agentic wallets on Arc.
          </h1>

          <p className="mt-5 max-w-[540px] font-body text-[15px] leading-[1.7] text-[#8A909B]">
            Give AI agents real USDC wallets on Arc — governed by spend limits, vendor allowlists,
            anomaly checks, and human escalation.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center gap-2 bg-[#FF5A1F] px-6 font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-[#121419] transition-all hover:brightness-110 hover:shadow-[0_0_24px_rgba(255,90,31,0.3)]"
            >
              Launch Dashboard
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/docs"
              className="inline-flex h-11 items-center gap-2 border border-[#282C34] bg-[#181B21] px-6 font-mono text-[12px] uppercase tracking-[0.12em] text-[#8A909B] transition-colors hover:border-[#3A4250] hover:text-[#D7DBE0]"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Read Docs
            </Link>
            <a
              href="https://github.com/bunnyyxtan/ARCANUM"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 cursor-pointer items-center gap-2 border border-[#282C34] bg-[#181B21] px-5 font-mono text-[12px] uppercase tracking-[0.12em] text-[#5B626C] transition-colors hover:border-[#3A4250] hover:text-[#8A909B]"
            >
              <Github className="h-3.5 w-3.5" />
              GitHub
            </a>
          </div>
        </div>

        {/* Right — mini FOUNDRY console preview cards */}
        <div className="flex flex-col gap-3">
          {/* Posture card */}
          <div className="relative border border-[#282C34] bg-[#181B21] p-5">
            <CornerAccents />
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#5B626C]">
              GOVERNANCE POSTURE
            </div>
            <div className="mt-2 flex items-end gap-3">
              <span className="font-cond text-[56px] font-bold leading-[0.8] text-[#EDF0F3]">
                87
              </span>
              <div className="mb-1">
                <div className="text-[13px] font-semibold tracking-[0.06em] text-[#FF5A1F]">
                  FORTIFIED
                </div>
                <div className="mt-0.5 text-[10px] text-[#8A909B]">↑ 3 PTS / 24H</div>
              </div>
            </div>
            <GaugeBar value={87} />
          </div>

          {/* Metrics row */}
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="VALUE GOVERNED" value="$1,247,392" caption="04 WALLETS ACTIVE" />
            <MiniStat label="ACTIVE AGENTS" value="04" caption="01 UNDER RESTRAINT" accentCaption />
          </div>

          {/* Recent decision record */}
          <div className="border border-[#282C34] bg-[#181B21]">
            <div className="flex h-8 items-center justify-between border-b border-[#282C34] px-4">
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#8A909B]">
                LATEST DECISION
              </span>
              <span className="text-[10px] tracking-[0.12em] text-[#5B626C]">02:47:12Z</span>
            </div>
            <div className="space-y-2 px-4 py-3 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-[#8A909B]">DEV-AGENT-01 to OpenAI</span>
                <span className="flex items-center gap-1 text-[#6E9E7C]">
                  <Check className="h-3 w-3" /> APPROVED
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8A909B]">RESEARCH-02 to AWS Bedrock</span>
                <span className="flex items-center gap-1 text-[#E0A04A]">
                  <TriangleAlert className="h-3 w-3" /> ESCALATED
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#8A909B]">TRADE-BOT-03 to Unknown</span>
                <span className="flex items-center gap-1 text-[#FF5A1F]">
                  <Ban className="h-3 w-3" /> REJECTED
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  SECTION 2 — Problem Panel                                                 */
/* -------------------------------------------------------------------------- */
function ProblemSection() {
  const problems = [
    {
      icon: AlertTriangle,
      label: "OVERSPEND RISK",
      body: "An uncapped wallet lets an agent drain treasury in a single run.",
      color: "#FF5A1F",
    },
    {
      icon: Ban,
      label: "UNAPPROVED VENDORS",
      body: "Agents route payments to unknown counterparties with no review.",
      color: "#FF5A1F",
    },
    {
      icon: Search,
      label: "NO AUDIT TRAIL",
      body: "Spend decisions happen off-chain with zero provenance or accountability.",
      color: "#E0A04A",
    },
    {
      icon: Users,
      label: "NO HUMAN APPROVAL",
      body: "High-value or anomalous transactions execute without escalation.",
      color: "#E0A04A",
    },
    {
      icon: Eye,
      label: "NO PUBLIC PROOF",
      body: "Stakeholders cannot verify governance posture or spending behavior.",
      color: "#5B626C",
    },
  ] as const;

  return (
    <section className="border-b border-[#282C34]">
      <div className="mx-auto max-w-[1280px] px-5 py-16 lg:py-20">
        <SectionEyebrow>THE PROBLEM</SectionEyebrow>
        <h2 className="mt-3 font-cond text-[28px] font-bold tracking-[0.02em] text-[#EDF0F3] sm:text-[34px]">
          AI agents move money. Normal wallets give them too much freedom.
        </h2>
        <p className="mt-3 max-w-[640px] text-[14px] leading-[1.65] text-[#8A909B]">
          Autonomous agents can call APIs, buy data, rent compute, and settle payments. Teams need
          policy before funds move.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {problems.map((item) => (
            <div key={item.label} className="border border-[#282C34] bg-[#181B21] p-4">
              <item.icon className="h-4 w-4" style={{ color: item.color }} />
              <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-[#EDF0F3]">
                {item.label}
              </div>
              <p className="mt-2 text-[12px] leading-[1.5] text-[#5B626C]">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  SECTION 3 — System Loop                                                   */
/* -------------------------------------------------------------------------- */
function SystemLoopSection() {
  const steps = [
    {
      num: "01",
      label: "DEPLOY WALLET",
      desc: "Create a GuardedWallet on Arc with an owner signer.",
    },
    { num: "02", label: "ATTACH DOCTRINE", desc: "Set spend limits, category caps, quorum rules." },
    {
      num: "03",
      label: "APPROVE VENDORS",
      desc: "Allowlist counterparties and vendor categories.",
    },
    { num: "04", label: "AGENT PAYS", desc: "Agent attempts a USDC payment through the wallet." },
    {
      num: "05",
      label: "POLICY ENGINE",
      desc: "Doctrine allows, denies, or escalates the transaction.",
    },
    { num: "06", label: "PUBLIC POSTURE", desc: "Governance badge and explorer prove compliance." },
  ] as const;

  return (
    <section className="border-b border-[#282C34]">
      <div className="mx-auto max-w-[1280px] px-5 py-16 lg:py-20">
        <SectionEyebrow>HOW ARCANUM WORKS</SectionEyebrow>
        <h2 className="mt-3 font-cond text-[28px] font-bold tracking-[0.02em] text-[#EDF0F3] sm:text-[34px]">
          The governance loop
        </h2>
        <p className="mt-3 max-w-[540px] text-[14px] leading-[1.65] text-[#8A909B]">
          Every payment flows through on-chain policy before settlement.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-px bg-[#282C34] sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step) => (
            <div key={step.num} className="flex gap-4 bg-[#121419] p-5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center border border-[#282C34] bg-[#181B21] font-mono text-[12px] text-[#FF5A1F]">
                {step.num}
              </span>
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-[#EDF0F3]">
                  {step.label}
                </div>
                <p className="mt-1 text-[12px] leading-[1.55] text-[#5B626C]">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Visual connection line */}
        <div className="mt-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.14em] text-[#5B626C]">
          <div className="h-px flex-1 bg-[#282C34]" />
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 bg-[#FF5A1F]" />
            CONTINUOUS GOVERNANCE LOOP
          </span>
          <div className="h-px flex-1 bg-[#282C34]" />
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  SECTION 4 — Product Modules                                               */
/* -------------------------------------------------------------------------- */
function ProductModulesSection() {
  const modules = [
    {
      icon: Wallet,
      label: "GUARDEDWALLET",
      desc: "Non-custodial smart-contract wallet with embedded policy hooks. Every outbound transfer is evaluated before settlement.",
      accent: true,
    },
    {
      icon: ScrollText,
      label: "DOCTRINE ENGINE",
      desc: "On-chain policy envelopes — spend limits, category caps, vendor allowlists, escalation thresholds. Immutable once deployed.",
      accent: true,
    },
    {
      icon: ShieldCheck,
      label: "VENDOR REGISTRY",
      desc: "Allowlist and categorize approved counterparties. Payments to unapproved vendors are blocked or escalated automatically.",
      accent: false,
    },
    {
      icon: Flag,
      label: "RESTRAINT QUEUE",
      desc: "Escalated transactions wait for human quorum approval. Time-bounded with configurable expiry and auto-deny.",
      accent: false,
    },
    {
      icon: Globe,
      label: "PUBLIC EXPLORER & BADGE",
      desc: "Sharable governance posture. Stakeholders, auditors, and DAOs can verify agent behavior on-chain without special access.",
      accent: false,
    },
  ] as const;

  return (
    <section className="border-b border-[#282C34]">
      <div className="mx-auto max-w-[1280px] px-5 py-16 lg:py-20">
        <SectionEyebrow>PRODUCT MODULES</SectionEyebrow>
        <h2 className="mt-3 font-cond text-[28px] font-bold tracking-[0.02em] text-[#EDF0F3] sm:text-[34px]">
          Everything an autonomous wallet needs
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => (
            <div key={mod.label} className="relative border border-[#282C34] bg-[#181B21] p-5">
              {mod.accent ? (
                <div className="absolute inset-y-0 left-0 w-[3px] bg-[#FF5A1F]" />
              ) : null}
              <mod.icon className="h-4 w-4 text-[#8A909B]" />
              <div className="mt-3 text-[11px] uppercase tracking-[0.18em] text-[#EDF0F3]">
                {mod.label}
              </div>
              <p className="mt-2 text-[13px] leading-[1.55] text-[#5B626C]">{mod.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  SECTION 5 — Why Arc                                                       */
/* -------------------------------------------------------------------------- */
function WhyArcSection() {
  const points = [
    {
      label: "USDC-NATIVE",
      desc: "Gas and settlement in USDC. No volatile token exposure for treasury operations.",
    },
    {
      label: "EVM-COMPATIBLE",
      desc: "Standard Solidity toolchain. Deploy with Hardhat, Foundry, or the Arcanum SDK.",
    },
    {
      label: "STABLECOIN CONTEXT",
      desc: "Purpose-built for financial applications where deterministic settlement matters.",
    },
    {
      label: "FAST FINALITY",
      desc: "Sub-second block times with predictable settlement for time-sensitive operations.",
    },
  ] as const;

  return (
    <section className="border-b border-[#282C34]">
      <div className="mx-auto max-w-[1280px] px-5 py-16 lg:py-20">
        <SectionEyebrow>WHY ARC</SectionEyebrow>
        <h2 className="mt-3 font-cond text-[28px] font-bold tracking-[0.02em] text-[#EDF0F3] sm:text-[34px]">
          Built native to Arc
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-px bg-[#282C34] sm:grid-cols-2 lg:grid-cols-4">
          {points.map((item) => (
            <div key={item.label} className="bg-[#121419] p-5">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 bg-[#FF5A1F]" />
                <span className="text-[11px] uppercase tracking-[0.16em] text-[#EDF0F3]">
                  {item.label}
                </span>
              </div>
              <p className="mt-2 text-[12px] leading-[1.55] text-[#5B626C]">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  SECTION 6 — Console Preview                                               */
/* -------------------------------------------------------------------------- */
function ConsolePreviewSection() {
  return (
    <section className="border-b border-[#282C34]">
      <div className="mx-auto max-w-[1280px] px-5 py-16 lg:py-20">
        <SectionEyebrow>INSIDE THE CONSOLE</SectionEyebrow>
        <h2 className="mt-3 font-cond text-[28px] font-bold tracking-[0.02em] text-[#EDF0F3] sm:text-[34px]">
          Governance at a glance
        </h2>
        <p className="mt-3 max-w-[540px] text-[14px] leading-[1.65] text-[#8A909B]">
          The FOUNDRY console gives operators full visibility into agent spend, policy enforcement,
          escalation queues, and public posture.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Dashboard metrics */}
          <PreviewCard title="DASHBOARD METRICS">
            <div className="grid grid-cols-2 gap-px bg-[#282C34]">
              <div className="bg-[#14161A] p-3">
                <div className="text-[9px] uppercase tracking-[0.18em] text-[#5B626C]">
                  DAILY SPEND
                </div>
                <div className="mt-1 font-cond text-[24px] font-semibold text-[#EDF0F3]">
                  $4,218
                </div>
                <div className="mt-0.5 text-[9px] text-[#6E9E7C]">WITHIN LIMITS</div>
              </div>
              <div className="bg-[#14161A] p-3">
                <div className="text-[9px] uppercase tracking-[0.18em] text-[#5B626C]">
                  DECISIONS / 24H
                </div>
                <div className="mt-1 font-cond text-[24px] font-semibold text-[#EDF0F3]">47</div>
                <div className="mt-0.5 text-[9px] text-[#8A909B]">44 APPROVED / 2 ESCALATED</div>
              </div>
              <div className="bg-[#14161A] p-3">
                <div className="text-[9px] uppercase tracking-[0.18em] text-[#5B626C]">
                  ANOMALY SCORE
                </div>
                <div className="mt-1 font-cond text-[24px] font-semibold text-[#EDF0F3]">
                  0.3 deviation
                </div>
                <div className="mt-0.5 text-[9px] text-[#6E9E7C]">BASELINE</div>
              </div>
              <div className="bg-[#14161A] p-3">
                <div className="text-[9px] uppercase tracking-[0.18em] text-[#5B626C]">
                  ESCALATION QUEUE
                </div>
                <div className="mt-1 font-cond text-[24px] font-semibold text-[#FF5A1F]">01</div>
                <div className="mt-0.5 text-[9px] text-[#E0A04A]">AWAITING QUORUM</div>
              </div>
            </div>
          </PreviewCard>

          {/* Policy editor */}
          <PreviewCard title="DOCTRINE EDITOR">
            <div className="space-y-2 p-3 font-mono text-[11px]">
              <PolicyLine label="PER-TX CAP" value="$100.00 USDC" />
              <PolicyLine label="DAILY CAP" value="$1,000.00 USDC" />
              <PolicyLine label="MONTHLY CAP" value="$30,000.00 USDC" />
              <PolicyLine label="ESCALATION" value="$50.00 USDC" accent />
              <PolicyLine label="QUORUM" value="2 / 3 SIGNERS" />
              <PolicyLine label="VENDOR ALLOWLIST" value="REQUIRED" green />
              <PolicyLine label="ANOMALY THRESHOLD" value="5.0 deviation" accent />
            </div>
          </PreviewCard>

          {/* Restraint queue */}
          <PreviewCard title="RESTRAINT QUEUE">
            <div className="divide-y divide-[#1E222A]">
              <EscalationRow
                agent="RESEARCH-02"
                amount="$847.00"
                vendor="AWS Bedrock"
                status="AWAITING"
                time="04:12:33"
                statusColor="#E0A04A"
              />
              <EscalationRow
                agent="DEV-AGENT-01"
                amount="$2,100.00"
                vendor="Anthropic"
                status="APPROVED"
                time="SETTLED"
                statusColor="#6E9E7C"
              />
            </div>
          </PreviewCard>

          {/* Public badge */}
          <PreviewCard title="PUBLIC BADGE / EXPLORER">
            <div className="p-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center">
                  <img
                    src="/brand/arcanum-mark.png"
                    alt="Arcanum"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div>
                  <div className="text-[12px] font-semibold tracking-[0.08em] text-[#EDF0F3]">
                    ACME-CAPITAL
                  </div>
                  <div className="text-[10px] text-[#8A909B]">GOVERNANCE SCORE: 87 / FORTIFIED</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <BadgeStat label="AGENTS" value="04" />
                <BadgeStat label="VIOLATIONS" value="00" />
                <BadgeStat label="UPTIME" value="99.2%" />
              </div>
              <div className="mt-3 text-[10px] text-[#5B626C]">
                Shareable link / On-chain verification / No authentication required
              </div>
            </div>
          </PreviewCard>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  SECTION 7 — Trust Pillars                                                 */
/* -------------------------------------------------------------------------- */
function TrustPillarsSection() {
  const pillars = [
    {
      icon: Lock,
      label: "NON-CUSTODIAL",
      desc: "Owners always control their keys. Arcanum never holds funds.",
    },
    {
      icon: Github,
      label: "OPEN-SOURCE",
      desc: "MIT licensed. Audit the code, fork the protocol, verify on-chain.",
    },
    {
      icon: Globe,
      label: "SELF-HOSTABLE",
      desc: "Run the full stack on your infrastructure. No vendor lock-in.",
    },
    {
      icon: ScrollText,
      label: "ON-CHAIN POLICY",
      desc: "Doctrine contracts are immutable and publicly verifiable.",
    },
    {
      icon: ShieldAlert,
      label: "NO FAKE APPROVALS",
      desc: "Policy engine cannot be bypassed. Every decision is recorded.",
    },
    {
      icon: Users,
      label: "HUMAN ESCALATION",
      desc: "Configurable quorum. Humans approve what policy cannot decide.",
    },
  ] as const;

  return (
    <section className="border-b border-[#282C34]">
      <div className="mx-auto max-w-[1280px] px-5 py-16 lg:py-20">
        <SectionEyebrow>TRUST ARCHITECTURE</SectionEyebrow>
        <h2 className="mt-3 font-cond text-[28px] font-bold tracking-[0.02em] text-[#EDF0F3] sm:text-[34px]">
          Built for verification, not permission
        </h2>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((pillar) => (
            <div key={pillar.label} className="flex gap-4 border border-[#282C34] bg-[#181B21] p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-[#282C34] bg-[#14161A]">
                <pillar.icon className="h-4 w-4 text-[#8A909B]" />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em] text-[#EDF0F3]">
                  {pillar.label}
                </div>
                <p className="mt-1 text-[12px] leading-[1.5] text-[#5B626C]">{pillar.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  SECTION 8 — Final CTA                                                     */
/* -------------------------------------------------------------------------- */
function FinalCTASection() {
  return (
    <section className="relative">
      <div className="mx-auto max-w-[1280px] px-5 py-20 text-center lg:py-28">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[#5B626C]">ARCANUM</div>
        <h2 className="mx-auto mt-4 max-w-[640px] font-cond text-[28px] font-bold tracking-[0.02em] text-[#EDF0F3] sm:text-[36px]">
          Arcanum turns autonomous wallets into governed economic actors.
        </h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-12 items-center gap-2 bg-[#FF5A1F] px-7 font-mono text-[13px] font-semibold uppercase tracking-[0.12em] text-[#121419] transition-all hover:brightness-110 hover:shadow-[0_0_24px_rgba(255,90,31,0.3)]"
          >
            Launch Dashboard
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/docs"
            className="inline-flex h-12 items-center gap-2 border border-[#282C34] bg-[#181B21] px-7 font-mono text-[13px] uppercase tracking-[0.12em] text-[#8A909B] transition-colors hover:border-[#3A4250] hover:text-[#D7DBE0]"
          >
            <BookOpen className="h-4 w-4" />
            Read Docs
          </Link>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shared helpers                                                             */
/* -------------------------------------------------------------------------- */
function LandingHeader() {
  return (
    <header className="flex h-[52px] items-center justify-between border-b border-[#282C34] bg-[#16181D] px-5">
      <Link href="/" className="flex items-center gap-2.5">
        <img src="/brand/arcanum-mark.png" alt="Arcanum" className="h-5 w-5 object-contain" />
        <span className="font-cond text-[17px] font-bold tracking-[0.16em] text-[#EDF0F3]">
          ARCANUM
        </span>
      </Link>
      <div className="flex items-center gap-3">
        <Link
          href="/docs"
          className="flex h-8 items-center gap-2 border border-[#282C34] bg-[#101216] px-3 text-[11px] tracking-[0.1em] text-[#8A909B] hover:text-[#D7DBE0]"
        >
          <BookOpen className="h-3.5 w-3.5" />
          DOCS
        </Link>
        <a
          href="https://github.com/bunnyyxtan/ARCANUM"
          target="_blank"
          rel="noreferrer"
          className="flex h-8 cursor-pointer items-center gap-2 border border-[#282C34] bg-[#101216] px-3 text-[11px] tracking-[0.1em] text-[#5B626C] hover:text-[#8A909B]"
        >
          <Github className="h-3.5 w-3.5" />
          GITHUB
        </a>
        <Link
          href="/dashboard"
          className="flex h-8 items-center gap-2 bg-[#FF5A1F] px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-[#121419] transition-all hover:brightness-110"
        >
          LAUNCH DASHBOARD
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </header>
  );
}

function LandingFooter() {
  return (
    <footer className="flex h-8 items-center justify-between border-t border-[#282C34] bg-[#16181D] px-5 text-[10px] tracking-[0.12em] text-[#5B626C]">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-[#6E9E7C]">
          <span className="h-1.5 w-1.5 bg-[#6E9E7C]" />
          ARC TESTNET
        </span>
        <span>OPEN PROTOCOL</span>
        <span className="text-[#343A44]">|</span>
        <span>MIT LICENSE</span>
      </div>
      <div className="flex items-center gap-4">
        <span>ARCANUM v0.9.2</span>
      </div>
    </footer>
  );
}

function SectionEyebrow({ children }: Readonly<{ children: string }>) {
  return (
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-[#FF5A1F]">
      <span className="h-px w-4 bg-[#FF5A1F]" />
      {children}
    </div>
  );
}

function CornerAccents() {
  return (
    <>
      <span className="absolute left-1.5 top-1.5 h-3 w-3 border-l-2 border-t-2 border-[#FF5A1F]" />
      <span className="absolute right-1.5 top-1.5 h-3 w-3 border-r-2 border-t-2 border-[#FF5A1F]" />
      <span className="absolute bottom-1.5 left-1.5 h-3 w-3 border-b-2 border-l-2 border-[#FF5A1F]" />
      <span className="absolute bottom-1.5 right-1.5 h-3 w-3 border-b-2 border-r-2 border-[#FF5A1F]" />
    </>
  );
}

function GaugeBar({ value }: Readonly<{ value: number }>) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-[8px] uppercase tracking-[0.18em] text-[#5B626C]">
        <span>00</span>
        <span>POSTURE GAUGE</span>
        <span>100</span>
      </div>
      <div className="relative mt-1.5 h-5">
        <div
          className="absolute inset-x-0 top-1/2 h-5 -translate-y-1/2"
          style={{
            background: "repeating-linear-gradient(90deg,#2A2E35 0 1px,transparent 1px 13px)",
          }}
        />
        <div
          className="absolute top-1/2 h-[3px] -translate-y-1/2 bg-[#3A4250]"
          style={{ left: 0, width: `${value}%` }}
        />
        <div
          className="absolute bottom-0 top-0 w-[2px] bg-[#FF5A1F]"
          style={{ left: `${value}%` }}
        />
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  caption,
  accentCaption = false,
}: Readonly<{ label: string; value: string; caption: string; accentCaption?: boolean }>) {
  return (
    <div className="border border-[#282C34] bg-[#181B21] p-4">
      <div className="text-[9px] uppercase tracking-[0.18em] text-[#5B626C]">{label}</div>
      <div className="mt-1.5 font-cond text-[28px] font-semibold leading-none text-[#EDF0F3]">
        {value}
      </div>
      <div
        className={`mt-1 text-[9px] tracking-[0.08em] ${accentCaption ? "text-[#FF5A1F]" : "text-[#5B626C]"}`}
      >
        {caption}
      </div>
    </div>
  );
}

function PreviewCard({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <div className="border border-[#282C34] bg-[#181B21]">
      <div className="flex h-8 items-center justify-between border-b border-[#282C34] px-4">
        <span className="text-[10px] uppercase tracking-[0.18em] text-[#8A909B]">{title}</span>
        <span className="h-1.5 w-1.5 bg-[#6E9E7C]" />
      </div>
      {children}
    </div>
  );
}

function PolicyLine({
  label,
  value,
  accent = false,
  green = false,
}: Readonly<{ label: string; value: string; accent?: boolean; green?: boolean }>) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[#5B626C]">{label}</span>
      <span className={accent ? "text-[#FF5A1F]" : green ? "text-[#6E9E7C]" : "text-[#D7DBE0]"}>
        {value}
      </span>
    </div>
  );
}

function EscalationRow({
  agent,
  amount,
  vendor,
  status,
  time,
  statusColor,
}: Readonly<{
  agent: string;
  amount: string;
  vendor: string;
  status: string;
  time: string;
  statusColor: string;
}>) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-[11px]">
      <div className="flex items-center gap-3">
        <span className="text-[#EDF0F3]">{agent}</span>
        <span className="text-[#5B626C]">/</span>
        <span className="text-[#8A909B]">{vendor}</span>
        <span className="text-[#D7DBE0]">{amount}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] tracking-[0.08em]" style={{ color: statusColor }}>
          {status}
        </span>
        <span className="text-[10px] text-[#5B626C]">{time}</span>
      </div>
    </div>
  );
}

function BadgeStat({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="border border-[#282C34] bg-[#14161A] p-2 text-center">
      <div className="font-cond text-[16px] font-semibold text-[#EDF0F3]">{value}</div>
      <div className="text-[8px] uppercase tracking-[0.14em] text-[#5B626C]">{label}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main export                                                                */
/* -------------------------------------------------------------------------- */
export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-foundry-grid font-mono text-[#D7DBE0]">
      <LandingHeader />
      <main className="flex-1">
        <HeroSection />
        <ProblemSection />
        <SystemLoopSection />
        <ProductModulesSection />
        <WhyArcSection />
        <ConsolePreviewSection />
        <TrustPillarsSection />
        <FinalCTASection />
      </main>
      <LandingFooter />
    </div>
  );
}
