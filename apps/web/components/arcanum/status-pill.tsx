export type StatusTone = "approved" | "rejected" | "escalated" | "frozen" | "active" | "idle";

const toneClasses: Record<StatusTone, string> = {
  approved: "bg-[var(--wl-green-tint)] text-[var(--wl-green)]",
  rejected: "bg-[var(--wl-signal)] text-[var(--wl-bg)]",
  escalated: "border border-[var(--wl-signal)] text-[var(--wl-signal)]",
  frozen: "bg-[var(--wl-ink)] text-[var(--wl-bg)]",
  active: "bg-[var(--wl-green-tint)] text-[var(--wl-green)]",
  idle: "border border-[var(--wl-line)] text-[var(--wl-secondary)]",
};

export function StatusPill({
  status,
  tone,
}: {
  status: string;
  tone: StatusTone;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.12em] ${toneClasses[tone]}`}
    >
      {status}
    </span>
  );
}
