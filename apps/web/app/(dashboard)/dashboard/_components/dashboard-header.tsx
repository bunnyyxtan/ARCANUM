import { Reveal } from "@/components/arcanum/reveal";
import Link from "next/link";
import type { DashboardController } from "../_hooks/use-dashboard-controller";

export function DashboardHeader({ readOnly, org }: Pick<DashboardController, "readOnly" | "org">) {
  return (
    <Reveal>
      <div className="flex flex-col justify-between gap-7 border-b border-[var(--wl-line)] pb-9 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
            OVERVIEW / FLEET POSTURE
          </p>
          <h1 className="font-display mt-4 text-[clamp(3rem,6vw,5.5rem)] font-semibold leading-[.86] tracking-[-.015em]">
            Dashboard
          </h1>
          <p className="mt-5 max-w-[430px] text-[14px] leading-[1.45] text-[var(--wl-secondary2)]">
            A quiet view of autonomous spend, restraint decisions, and the agents moving capital on
            Arc.
          </p>
        </div>
        {!readOnly && org.data?.name && (
          <div className="shrink-0 border-l-2 border-[var(--wl-signal)] pl-4 md:border-l-0 md:border-r-2 md:pl-0 md:pr-4 md:text-right">
            <p className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-mute)]">
              ACTIVE WORKSPACE
            </p>
            <p className="font-display mt-1.5 text-[20px] font-medium tracking-[-.01em] text-[var(--wl-ink)]">
              {org.data.name}
            </p>
            <Link
              href="/settings"
              className="mt-1 inline-block font-mono text-[8.5px] uppercase tracking-[.12em] text-[var(--wl-secondary)] transition-colors hover:text-[var(--wl-signal)]"
            >
              RENAME IN SETTINGS
            </Link>
          </div>
        )}
      </div>
    </Reveal>
  );
}
