import { useState, type ReactNode } from "react";
import { Header } from "./_shared/Header";

const sections = [
  { id: "orientation", number: "00", label: "Read this first" },
  { id: "wallet", number: "01", label: "Deploy a wallet" },
  { id: "doctrine", number: "02", label: "Author a doctrine" },
  { id: "restraint", number: "03", label: "Handle restraint" },
  { id: "runbook", number: "04", label: "Operator runbook" },
];

function Reveal({ children, index = 0 }: { children: ReactNode; index?: number }) {
  return <div className={`docs-reveal docs-delay-${index}`}>{children}</div>;
}

function Note({ label, children }: { label: string; children: ReactNode }) {
  return (
    <aside className="border-l border-[#ff3c00] pl-4 text-[12px] leading-[1.5] text-[#655d56]">
      <p className="font-mono text-[9px] uppercase tracking-[.16em] text-[#ff3c00]">{label}</p>
      <div className="mt-2">{children}</div>
    </aside>
  );
}

function CodeBlock({ children }: { children: ReactNode }) {
  return <pre className="overflow-x-auto border border-[#cfc5bc] bg-[#f5f0ea] p-5 font-mono text-[11px] leading-[1.85] text-[#4f4842]">{children}</pre>;
}

export function Docs() {
  const [copied, setCopied] = useState(false);
  const copyCommand = () => {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <main className="min-h-[100dvh] bg-[#faf6f1] text-[#292522]" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter+Tight:wght@400;500;600;700&display=swap');
        .font-mono{font-family:'DM Mono',monospace}
        .docs-reveal{animation:docsIn 420ms cubic-bezier(.16,1,.3,1) both}
        .docs-delay-1{animation-delay:80ms}.docs-delay-2{animation-delay:160ms}.docs-delay-3{animation-delay:240ms}
        @keyframes docsIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .docs-nav-link{transition:color 220ms ease,transform 220ms cubic-bezier(.16,1,.3,1),background 220ms ease}
        .docs-nav-link:hover{color:#292522;transform:translateX(3px);background:#f5f0ea}
        .docs-warm-button{position:relative;isolation:isolate;overflow:hidden;transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 320ms ease}
        .docs-warm-button:before{content:"";position:absolute;inset:0;z-index:-1;background:#d63200;transform:translateY(102%);transition:transform 320ms cubic-bezier(.16,1,.3,1)}
        .docs-warm-button:hover{transform:translateY(-1px);box-shadow:0 10px 28px -8px rgba(255,60,0,.42)}
        .docs-warm-button:hover:before{transform:translateY(0)}
        .docs-anchor{scroll-margin-top:92px}
        @media (prefers-reduced-motion:reduce){.docs-reveal{animation:none}.docs-nav-link,.docs-warm-button,.docs-warm-button:before{transition:none}}
      `}</style>
      <Header />
      <div className="mx-auto max-w-[1400px] px-5 py-9 md:px-8 md:py-12">
        <Reveal>
          <div className="flex flex-col justify-between gap-8 border-b border-[#ded7d0] pb-10 lg:flex-row lg:items-end">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#ff3c00]">ARCANUM / FIELD MANUAL 01</p>
              <h1 className="mt-5 max-w-[850px] text-[clamp(3.2rem,7vw,6.6rem)] font-semibold leading-[.84] tracking-[-.045em]">Govern the wallet.<br /><span className="text-[#8d837b]">Then let it move.</span></h1>
              <p className="mt-7 max-w-[540px] text-[15px] leading-[1.5] text-[#655d56]">A practical guide to deploying an agent wallet on Arc, writing the doctrine that constrains it, and taking the first restraint without guesswork.</p>
            </div>
            <div className="max-w-[230px] border-l border-[#ff3c00] pl-4">
              <p className="font-mono text-[9px] uppercase tracking-[.16em] text-[#ff3c00]">READING TIME / 08 MIN</p>
              <p className="mt-3 text-[12px] leading-[1.5] text-[#776f68]">For operators at HELIX-DAO. Assumes an Arc testnet wallet and a signed SIWE session.</p>
            </div>
          </div>
        </Reveal>

        <div className="grid gap-12 lg:grid-cols-[200px_minmax(0,730px)_200px] lg:gap-16">
          <nav className="pt-10 lg:sticky lg:top-5 lg:h-fit" aria-label="Documentation sections">
            <p className="font-mono text-[9px] uppercase tracking-[.16em] text-[#9b9289]">ON THIS PAGE</p>
            <div className="mt-4 border-t border-[#ded7d0]">
              {sections.map((section) => (
                <a key={section.id} href={`#${section.id}`} className="docs-nav-link flex items-center gap-3 border-b border-[#e3dcd5] py-3 text-[12px] text-[#776f68]">
                  <span className="font-mono text-[9px] text-[#9b9289]">{section.number}</span>{section.label}
                </a>
              ))}
            </div>
            <a data-nav="GLOSSARY" href="#glossary" className="mt-8 inline-flex font-mono text-[10px] uppercase tracking-[.13em] text-[#655d56] underline decoration-[#ff3c00] underline-offset-4 transition-colors hover:text-[#ff3c00]">Browse glossary</a>
          </nav>

          <article className="min-w-0 pt-10">
            <Reveal>
              <section id="orientation" className="docs-anchor border-b border-[#ded7d0] pb-12">
                <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#ff3c00]">00 / READ THIS FIRST</p>
                <h2 className="mt-4 text-[28px] font-medium tracking-[-.05em]">A governed wallet is a boundary, not a bank account.</h2>
                <p className="mt-5 text-[15px] leading-[1.55] text-[#655d56]">The agent proposes a transaction. ARCANUM evaluates the proposal against a signed policy doctrine. Only the governed wallet can settle it, and every verdict becomes a ledger record. The model never receives the operator key.</p>
                <div className="mt-8 grid border-y border-[#ded7d0] sm:grid-cols-3">
                  {[
                    ["01", "Agent proposes", "A typed spend intent enters the policy surface."],
                    ["02", "Policy decides", "Caps, destinations, and velocity are checked."],
                    ["03", "Human intervenes", "Exceptions pause until quorum is satisfied."],
                  ].map(([n, title, copy]) => <div key={n} className="border-b border-[#ded7d0] py-5 last:border-0 sm:border-b-0 sm:border-r sm:px-5 sm:first:pl-0 sm:last:border-0"><span className="font-mono text-[10px] text-[#ff3c00]">{n}</span><h3 className="mt-8 text-[16px] font-medium">{title}</h3><p className="mt-2 text-[12px] leading-[1.45] text-[#776f68]">{copy}</p></div>)}
                </div>
              </section>
            </Reveal>

            <Reveal index={1}>
              <section id="wallet" className="docs-anchor border-b border-[#ded7d0] py-14">
                <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#ff3c00]">01 / DEPLOY A GOVERNED WALLET</p>
                <h2 className="mt-4 text-[28px] font-medium tracking-[-.05em]">Start with a wallet that cannot improvise.</h2>
                <p className="mt-5 text-[15px] leading-[1.55] text-[#655d56]">Create the wallet from the HELIX-DAO operator console, then bind the first doctrine before funding it. Use Arc testnet for the complete rehearsal: the same signing ceremony, a safe balance.</p>
                <ol className="mt-9 space-y-7">
                  {[
                    ["Connect the operator", "Open the console with your EOA and complete Sign-In with Ethereum (SIWE). The message includes HELIX-DAO, Arc testnet, a nonce, and an expiry. Never paste a private key into an agent runtime."],
                    ["Name the boundary", "Register the wallet as procurement-bot and record 0x3f…9a2c in the inventory. The wallet address is the stable identity used in every ledger decision."],
                    ["Fund the rehearsal", "Send a small USDC balance on Arc testnet. Confirm the chain ID and token contract in the wallet drawer before your first proposal."],
                  ].map(([title, copy], i) => <li key={title} className="grid grid-cols-[28px_1fr] gap-4"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#292522] font-mono text-[10px] text-[#faf6f1]">{i + 1}</span><div><h3 className="text-[16px] font-medium">{title}</h3><p className="mt-2 text-[13px] leading-[1.5] text-[#776f68]">{copy}</p></div></li>)}
                </ol>
                <div className="mt-9">
                  <CodeBlock>{`arcana wallet inspect \\
  --wallet 0x3f...9a2c \\
  --network arc-testnet`}</CodeBlock>
                  <button type="button" onClick={copyCommand} className="mt-3 font-mono text-[9px] uppercase tracking-[.14em] text-[#655d56] underline underline-offset-4 transition-colors hover:text-[#ff3c00]">{copied ? "COMMAND COPIED" : "COPY INSPECTION COMMAND"}</button>
                </div>
              </section>
            </Reveal>

            <Reveal index={2}>
              <section id="doctrine" className="docs-anchor border-b border-[#ded7d0] py-14">
                <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#ff3c00]">02 / AUTHOR A POLICY DOCTRINE</p>
                <h2 className="mt-4 text-[28px] font-medium tracking-[-.05em]">Write the exception before the request.</h2>
                <p className="mt-5 text-[15px] leading-[1.55] text-[#655d56]">A doctrine is executable policy with an accountable author. Keep it narrow: name approved vendors, set a transaction cap, and describe what happens when the facts fall outside the line.</p>
                <div className="mt-8 border border-[#cfc5bc] bg-[#fbf8f4] p-5 shadow-[12px_14px_0_#e7e0d9] md:p-7">
                  <div className="flex justify-between border-b border-[#ded7d0] pb-4 font-mono text-[9px] uppercase tracking-[.15em] text-[#9b9289]"><span>DOCTRINE / PROCUREMENT-BOT</span><span>v4.18 · DRAFT</span></div>
                  <div className="mt-7 font-mono text-[11px] leading-[2]"><span className="text-[#9b9289]">when</span><br /><span className="text-[#ff3c00]">vendor</span> in [ AWS, OpenAI ]<br /><span className="text-[#ff3c00]">and amount</span> ≤ <span className="text-[#ff3c00]">$500</span><br /><br /><span className="text-[#9b9289]">then</span><br /><span className="text-[#3f653e]">ALLOW</span> · record to ledger<br /><span className="text-[#9b9289]">otherwise</span><br /><span className="text-[#ff3c00]">ESCALATE</span> · require 2 operators</div>
                  <div className="mt-7 border-t border-[#ded7d0] pt-4 font-mono text-[9px] uppercase tracking-[.12em] text-[#837a72]">daily cap $5,000 · USDC only · expires 30d</div>
                </div>
                <p className="mt-7 text-[13px] leading-[1.5] text-[#776f68]">Publish only after a second operator reviews the rendered rule. A doctrine change is a new signed instrument; it does not rewrite previous ledger decisions.</p>
              </section>
            </Reveal>

            <Reveal index={3}>
              <section id="restraint" className="docs-anchor border-b border-[#ded7d0] py-14">
                <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#ff3c00]">03 / HANDLE YOUR FIRST RESTRAINT</p>
                <h2 className="mt-4 text-[28px] font-medium tracking-[-.05em]">A pause is a successful control.</h2>
                <p className="mt-5 text-[15px] leading-[1.55] text-[#655d56]">When growth-bot asks Anthropic for $2,100.00, the request should stop. Review the reason, compare it to the doctrine, then make a recorded decision. Speed is not the objective; legibility is.</p>
                <div className="mt-8 grid gap-5 md:grid-cols-2">
                  <Note label="CHECK / 01">Confirm the requesting wallet, vendor, amount, and expiry. A familiar agent does not make an unfamiliar destination safe.</Note>
                  <Note label="CHECK / 02">Read the policy trace. If the request is valid but over cap, approve only when the escalation quorum and reason are present.</Note>
                  <Note label="CHECK / 03">Approve or reject in the restraint queue. The decision is signed, immutable, and visible in the ledger.</Note>
                  <Note label="CHECK / 04">If the request is unexpected, freeze the wallet first, then investigate the agent runtime and rotate the doctrine.</Note>
                </div>
                <a data-nav="DASHBOARD" href="#dashboard" className="docs-warm-button mt-9 inline-flex rounded-full bg-[#ff3c00] px-5 py-3 text-[11px] font-semibold text-white">Open restraint queue <span className="ml-2">↗</span></a>
              </section>
            </Reveal>

            <Reveal index={1}>
              <section id="runbook" className="docs-anchor py-14">
                <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#ff3c00]">04 / OPERATOR RUNBOOK</p>
                <h2 className="mt-4 text-[28px] font-medium tracking-[-.05em]">Keep the record useful.</h2>
                <div className="mt-6 divide-y divide-[#ded7d0] border-y border-[#ded7d0]">
                  {["Review pending restraints at the start of every shift.", "Rotate doctrines when vendors, caps, or agent responsibilities change.", "Treat an anomaly as a question, not a verdict.", "Leave the ledger with a clear answer: allowed, blocked, or human-decided."].map((item, i) => <div key={item} className="flex gap-4 py-4"><span className="font-mono text-[10px] text-[#ff3c00]">0{i + 1}</span><span className="text-[13px] text-[#655d56]">{item}</span></div>)}
                </div>
                <div className="mt-9 flex flex-wrap gap-5 border-t border-[#ded7d0] pt-6">
                  <a data-nav="GLOSSARY" href="#glossary" className="font-mono text-[10px] uppercase tracking-[.14em] text-[#655d56] underline decoration-[#ff3c00] underline-offset-4 hover:text-[#ff3c00]">Read the vocabulary</a>
                  <a data-nav="DASHBOARD" href="#dashboard" className="font-mono text-[10px] uppercase tracking-[.14em] text-[#655d56] underline decoration-[#ff3c00] underline-offset-4 hover:text-[#ff3c00]">Return to dashboard</a>
                </div>
              </section>
            </Reveal>
          </article>

          <aside className="hidden border-l border-[#ded7d0] pl-5 pt-10 lg:block">
            <p className="font-mono text-[9px] uppercase tracking-[.16em] text-[#9b9289]">FIELD NOTES</p>
            <div className="mt-5 space-y-7 text-[12px] leading-[1.5] text-[#776f68]">
              <p><span className="font-mono text-[9px] text-[#ff3c00]">01</span><br />Sign with the operator wallet, not the agent wallet.</p>
              <p><span className="font-mono text-[9px] text-[#ff3c00]">02</span><br />A policy is a promise about what happens next.</p>
              <p><span className="font-mono text-[9px] text-[#ff3c00]">03</span><br />No silent approvals. Every exception has a name.</p>
            </div>
            <div className="mt-12 border-t border-[#ded7d0] pt-4 font-mono text-[9px] uppercase leading-[1.7] tracking-[.1em] text-[#9b9289]">ARC TESTNET<br />HELIX-DAO<br />POLICY / V4.18</div>
          </aside>
        </div>
      </div>
    </main>
  );
}

export default Docs;