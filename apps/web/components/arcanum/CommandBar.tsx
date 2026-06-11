"use client";

import { Search } from "lucide-react";

import { useArcanumRuntime } from "@/components/arcanum/ArcanumRuntime";
import { motionCssEasings, motionDurations } from "@/lib/motion";

export function CommandBar() {
  const { openCommandPalette } = useArcanumRuntime();

  return (
    <button
      type="button"
      onClick={openCommandPalette}
      className="flex h-9 min-w-[320px] cursor-pointer items-center gap-3 border border-line-subtle bg-foundry-panel px-3 text-left transition hover:border-line-active hover:bg-panel-hover"
      style={{
        transitionDuration: `${motionDurations.micro}ms`,
        transitionTimingFunction: motionCssEasings.standard,
      }}
    >
      <Search aria-hidden="true" className="size-4 text-ash-muted" />
      <span className="min-w-0 flex-1 truncate whitespace-nowrap font-body text-ash-soft text-sm">
        Search
      </span>
      <span className="border border-line-subtle bg-panel-raised px-2 py-0.5 font-mono-arcanum text-[10px] text-ash-muted tracking-[0.12em]">
        CTRL K
      </span>
    </button>
  );
}
