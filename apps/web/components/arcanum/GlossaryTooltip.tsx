"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type GlossaryTerm, glossary, glossaryCaption } from "@/lib/glossary";

export function GlossaryTooltip({ term }: Readonly<{ term: GlossaryTerm }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex cursor-help align-middle text-ash-muted opacity-40 transition hover:opacity-100"
          aria-label={`${term} glossary definition`}
        >
          <Info className="size-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs p-3">
        <p className="font-body text-[12px] text-ash leading-relaxed">{glossary[term]}</p>
        <div className="mt-2 font-mono-arcanum text-[9px] text-ash-muted tracking-[0.12em]">
          {glossaryCaption}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export function GlossaryTermInline({
  term,
  children,
}: Readonly<{ term: GlossaryTerm; children?: ReactNode }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/glossary"
          className="border-b border-dotted border-[var(--wl-text-muted)] text-inherit decoration-dotted hover:border-[var(--wl-signal)] hover:text-[var(--wl-text-primary)]"
        >
          {children ?? term}
        </Link>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs border-[var(--wl-hairline)] bg-[var(--wl-panel-mid)] p-3 text-[var(--wl-text-body)]">
        <div className="font-cond text-[13px] font-semibold tracking-[0.16em] text-[var(--wl-signal)]">
          {term}
        </div>
        <p className="mt-1 font-body text-[12px] leading-relaxed text-[var(--wl-text-body)]">
          {glossary[term]}
        </p>
        <div className="mt-2 font-mono text-[9px] tracking-[0.12em] text-[var(--wl-text-muted)]">
          {glossaryCaption}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
