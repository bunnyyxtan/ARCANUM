"use client";

import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Github,
  Info,
  Search,
  ShieldAlert,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";

import { useDocumentTitle } from "@/lib/use-document-title";

type CalloutTone = "restraint" | "warning" | "info";

const navSections = [
  "QUICKSTART",
  "SDK",
  "CONTRACTS",
  "API REFERENCE",
  "EXAMPLES",
  "GLOSSARY",
] as const;

export function DocsPage() {
  useDocumentTitle("Docs / Arcanum");

  return (
    <main className="flex min-h-screen w-full bg-coal-grid text-ash">
      <aside className="flex w-docs-rail shrink-0 flex-col border-line-subtle border-r bg-panel-top">
        <div className="flex h-chrome items-center gap-2.5 border-line-subtle border-b px-5">
          <img src="/brand/arcanum-logo.png" alt="Arcanum" className="h-8 w-auto object-contain" />
          <span className="font-display text-[16px] font-bold text-ash-bright tracking-[0.16em]">
            ARCANUM
          </span>
          <span className="font-mono-arcanum text-[10px] text-ash-muted tracking-[0.16em]">
            / DOCS
          </span>
        </div>
        <div className="flex h-9 items-center gap-2 border-line-subtle border-b px-4 text-ash-muted">
          <Search className="size-3.5" />
          <span className="text-[11px]">search docs...</span>
          <span className="ml-auto border border-line-subtle px-1.5 text-[10px]">CTRL K</span>
        </div>
        <nav className="flex-1 px-3 py-4 text-[12px]">
          {navSections.map((section, index) => (
            <div key={section} className={index === 0 ? "" : "mt-4"}>
              <div className="mb-1 flex items-center justify-between px-2 font-mono-arcanum text-[10px] text-ash-muted tracking-[0.18em]">
                {section}
                {index === 0 ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
              </div>
              {index === 0 ? (
                <>
                  <a
                    href="#deploy"
                    className="relative flex items-center gap-2 border-hazard border-l-2 bg-panel-hover px-3 py-1.5 text-ash-bright"
                  >
                    Deploy a GuardedWallet
                  </a>
                  <a
                    href="#author"
                    className="flex items-center gap-2 px-3 py-1.5 text-ash-soft hover:text-ash-bright"
                  >
                    Author a Doctrine
                  </a>
                  <a
                    href="#restraint"
                    className="flex items-center gap-2 px-3 py-1.5 text-ash-soft hover:text-ash-bright"
                  >
                    First Restraint
                  </a>
                </>
              ) : null}
            </div>
          ))}
        </nav>
        <div className="border-line-subtle border-t px-5 py-3 font-mono-arcanum text-[10px] text-ash-muted tracking-[0.12em]">
          Built on Arc / Open Protocol / MIT
        </div>
      </aside>

      <section className="flex-1 overflow-hidden">
        <div className="flex h-chrome items-center justify-between border-line-subtle border-b bg-panel-top px-8 font-mono-arcanum text-[11px] text-ash-muted tracking-[0.12em]">
          <span>DOCS / QUICKSTART / DEPLOY A GUARDEDWALLET</span>
          <a
            href="https://github.com/bunnyyxtan/ARCANUM"
            target="_blank"
            rel="noreferrer"
            className="flex cursor-pointer items-center gap-1.5 text-ash-soft hover:text-ash-bright"
          >
            <Github className="size-4" />
            VIEW ON GITHUB
          </a>
        </div>
        <article className="mx-auto max-w-[760px] px-8 py-9">
          <div className="font-mono-arcanum text-[10px] text-hazard tracking-[0.24em]">
            QUICKSTART
          </div>
          <h1 className="mt-2 font-display text-[36px] font-bold text-ash-bright leading-tight">
            Deploy your first GuardedWallet
          </h1>
          <p className="mt-3 font-body text-[14px] text-cat-other leading-relaxed">
            Stand up a governed agent wallet on Arc Testnet in five steps. Every transaction it
            attempts will be evaluated against a Doctrine before it can settle on-chain.
          </p>

          <DocsStep number="01" title="Install the SDK" id="deploy">
            Add the Arcanum SDK to your project. It ships with typed GuardedWallet helpers and Arc
            Testnet chain config.
            <CodeBlock label="TERMINAL" language="bash" code="npm install @arcanum/sdk" />
          </DocsStep>
          <DocsStep number="02" title="Configure the signer">
            Point the client at Arc Testnet and supply an admin signer that will own the Doctrine.
          </DocsStep>
          <DocsStep number="03" title="Deploy the wallet with a Doctrine" id="author">
            Create a GuardedWallet through WalletFactory and attach spend limits, category caps, and
            an escalation quorum.
            <CodeBlock
              label="deploy.ts"
              language="typescript"
              code={`import { WalletFactoryAbi } from "@arcanum/contracts";
import { parseUnits } from "viem";

const policy = {
  perTxCap: parseUnits("50", 6),
  daily24hCap: parseUnits("500", 6),
  monthlyRollingCap: parseUnits("5000", 6),
  allowedCategories: 0b11111n,
  escalationThreshold: parseUnits("100", 6),
  requireAllowlist: true,
};

const txHash = await walletClient.writeContract({
  address: process.env.NEXT_PUBLIC_WALLET_FACTORY as \`0x\${string}\`,
  abi: WalletFactoryAbi,
  functionName: "createWallet",
  args: [ownerAddress, "ResearchAgent", policy, [agentSigner], council, 2],
});`}
            />
          </DocsStep>
          <DocsStep number="04" title="Fund the wallet">
            Transfer test USDC to the deployed address; it appears in the AGENT REGISTER
            immediately.
          </DocsStep>
          <DocsStep number="05" title="Watch the Event Stream">
            Every attempted transaction now flows through the governed event stream with a verdict.
          </DocsStep>

          <div className="mt-8 space-y-3">
            <Callout tone="restraint" title="RESTRAINT" id="restraint">
              On-chain policy changes affect real testnet state. Test with small limits first.
            </Callout>
            <Callout tone="warning" title="WARNING">
              A quorum of 1 disables multi-party approval. Use at least 2 for treasury wallets.
            </Callout>
            <Callout tone="info" title="INFO">
              USDC token amounts are expressed in 6-decimal base units. The SDK exposes usdcErc20()
              helpers.
            </Callout>
          </div>

          <div className="mt-8 flex items-center justify-between border-line-subtle border-t pt-5 text-[12px]">
            <a
              href="/dashboard"
              className="flex cursor-pointer items-center gap-2 text-ash-soft hover:text-ash-bright"
            >
              <ArrowLeft className="size-4" />
              Overview
            </a>
            <a
              href="#author"
              className="flex cursor-pointer items-center gap-2 text-ash-soft hover:text-ash-bright"
            >
              Author a Doctrine
              <ArrowRight className="size-4" />
            </a>
          </div>
        </article>
      </section>
    </main>
  );
}

function DocsStep({
  number,
  title,
  id,
  children,
}: Readonly<{ number: string; title: string; id?: string; children: ReactNode }>) {
  return (
    <section id={id} className="mt-7 flex gap-4">
      <span className="flex size-7 shrink-0 items-center justify-center border border-line-subtle bg-panel-raised font-mono-arcanum text-[12px] text-hazard">
        {number}
      </span>
      <div className="flex-1">
        <h3 className="text-[15px] text-ash-bright">{title}</h3>
        <div className="mt-1 font-body text-[13px] text-cat-other leading-relaxed">{children}</div>
      </div>
    </section>
  );
}

function CodeBlock({
  label,
  language,
  code,
}: Readonly<{ label: string; language: string; code: string }>) {
  return (
    <div className="mt-3 border border-line-subtle bg-obsidian">
      <div className="flex items-center justify-between border-line-subtle border-b px-3 py-1.5 font-mono-arcanum text-[10px] text-ash-muted tracking-[0.12em]">
        <span>{label}</span>
        <span className="border border-line-subtle px-1.5 text-ash-soft">{language}</span>
      </div>
      <pre className="overflow-hidden px-3 py-2.5 font-mono-arcanum text-[12px] text-steel-green leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

function Callout({
  tone,
  title,
  id,
  children,
}: Readonly<{ tone: CalloutTone; title: string; id?: string; children: ReactNode }>) {
  const toneClass = {
    restraint: "border-hazard bg-hazard-dark text-hazard",
    warning: "border-amber bg-foundry-panel text-amber",
    info: "border-cat-api bg-foundry-panel text-cat-api",
  }[tone];
  const Icon = tone === "restraint" ? ShieldAlert : tone === "warning" ? TriangleAlert : Info;

  return (
    <div id={id} className={`flex gap-3 border-l-2 px-4 py-3 ${toneClass}`}>
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div>
        <div className="font-mono-arcanum text-[11px] tracking-[0.12em]">{title}</div>
        <p className="mt-1 font-body text-[12.5px] text-ash leading-relaxed">{children}</p>
      </div>
    </div>
  );
}
