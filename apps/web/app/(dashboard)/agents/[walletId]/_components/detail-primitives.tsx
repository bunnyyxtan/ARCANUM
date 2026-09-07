export function StatusPill({
  status,
}: { status: "ACTIVE" | "FROZEN" | "APPROVED" | "REJECTED" | "ESCALATED" }) {
  const styles = {
    ACTIVE: "bg-[var(--wl-green-tint)] text-[var(--wl-green)]",
    FROZEN: "bg-[var(--wl-ink)] text-[var(--wl-bg)]",
    APPROVED: "bg-[var(--wl-green-tint)] text-[var(--wl-green)]",
    REJECTED: "bg-[var(--wl-signal)] text-[var(--wl-bg)]",
    ESCALATED: "border border-[var(--wl-signal)] text-[var(--wl-signal)]",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.12em] ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export function Arrow() {
  return (
    <span
      aria-hidden="true"
      className="ml-1 transition-transform duration-[220ms] group-hover:translate-x-1"
    >
      →
    </span>
  );
}
