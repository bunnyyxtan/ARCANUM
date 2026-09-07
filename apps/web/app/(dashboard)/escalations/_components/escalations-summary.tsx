interface EscalationsSummaryProps {
  pendingCount: number;
  queueCount: number;
  resolvedCount: number;
}

export function EscalationsSummary({
  pendingCount,
  queueCount,
  resolvedCount,
}: Readonly<EscalationsSummaryProps>) {
  return (
    <section className="grid grid-cols-3 border-b border-[var(--wl-line)]">
      <div className="py-6">
        <p className="font-mono text-[9px] tracking-[.15em] text-[var(--wl-mute)]">PENDING</p>
        <p className="font-display mt-3 text-[34px] font-medium tracking-[-.015em] text-[var(--wl-signal)]">
          {pendingCount}
        </p>
      </div>
      <div className="border-l border-[var(--wl-line)] py-6 pl-5 md:pl-7">
        <p className="font-mono text-[9px] tracking-[.15em] text-[var(--wl-mute)]">IN QUEUE</p>
        <p className="font-display mt-3 text-[34px] font-medium tracking-[-.015em]">{queueCount}</p>
      </div>
      <div className="border-l border-[var(--wl-line)] py-6 pl-5 md:pl-7">
        <p className="font-mono text-[9px] tracking-[.15em] text-[var(--wl-mute)]">RESOLVED</p>
        <p className="font-display mt-3 text-[34px] font-medium tracking-[-.015em]">
          {resolvedCount}
        </p>
      </div>
    </section>
  );
}
