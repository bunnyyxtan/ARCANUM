import type { AgentDisplayStatus } from "../_lib/agent-status";

export function Arrow() {
  return (
    <span
      aria-hidden="true"
      className="ml-1.5 inline-block transition-transform duration-[220ms] group-hover:translate-x-1"
    >
      →
    </span>
  );
}

export function StatusPill({ status }: { status: AgentDisplayStatus }) {
  const styles = {
    ACTIVE: "bg-[var(--wl-green-tint)] text-[var(--wl-green)]",
    FROZEN: "bg-[var(--wl-ink)] text-[var(--wl-bg)]",
    IDLE: "border border-[var(--wl-line)] text-[var(--wl-secondary)]",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.12em] ${styles[status]}`}
    >
      {status}
    </span>
  );
}
