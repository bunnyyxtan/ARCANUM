import Link from "next/link";

import { glossaryEntries } from "@/lib/glossary";

export default function GlossaryPage() {
  return (
    <main className="min-h-screen bg-foundry-grid px-8 py-8 font-mono text-[#D7DBE0]">
      <div className="mx-auto max-w-[1120px]">
        <div className="flex h-12 items-center justify-between border-b border-[#282C34]">
          <Link
            href="/dashboard"
            className="font-cond text-[18px] font-bold tracking-[0.18em] text-[#EDF0F3]"
          >
            ARCANUM
          </Link>
          <span className="text-[10px] tracking-[0.18em] text-[#5B626C]">FOUNDRY VOCABULARY</span>
        </div>
        <h1 className="mt-8 font-cond text-[44px] font-bold leading-none tracking-[0.04em] text-[#EDF0F3]">
          GLOSSARY
        </h1>
        <div className="mt-6 grid grid-cols-2 gap-px border border-[#282C34] bg-[#282C34]">
          {glossaryEntries.map(([term, definition]) => (
            <article key={term} className="bg-[#181B21] p-5">
              <h2 className="font-cond text-[22px] font-semibold tracking-[0.08em] text-[#FF5A1F]">
                {term}
              </h2>
              <p className="mt-2 font-mono text-[12px] leading-relaxed text-[#D7DBE0]">
                {definition}
              </p>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
