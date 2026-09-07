import type { LedgerStatus } from "@/lib/types";

export const statusPillStyles: Record<LedgerStatus, string> = {
  approved: "bg-[var(--wl-green-tint)] text-[var(--wl-green)]",
  rejected: "bg-[var(--wl-signal)] text-white",
  escalated: "border border-[var(--wl-signal)] text-[var(--wl-signal)]",
  frozen: "bg-[var(--wl-ink)] text-[var(--wl-bg)]",
};
