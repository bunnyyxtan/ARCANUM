import type { LedgerStatus } from "@/lib/types";

const statusClasses: Record<LedgerStatus, string> = {
  approved: "bg-[var(--wl-green-tint)] text-[var(--wl-green)]",
  rejected: "bg-[var(--wl-signal)] text-[var(--wl-bg)]",
  escalated: "border border-[var(--wl-signal)] text-[var(--wl-signal)]",
  frozen: "bg-[var(--wl-ink)] text-[var(--wl-bg)]",
};

export function StatusPill({ status }: { status: LedgerStatus }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.12em] ${statusClasses[status]}`}
    >
      {status}
    </span>
  );
}
