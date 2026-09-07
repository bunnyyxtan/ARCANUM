export function AnomaliesHeader() {
  return (
    <section className="flex flex-col justify-between gap-6 border-b border-[var(--wl-line)] pb-8 sm:flex-row sm:items-end">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[.19em] text-[var(--wl-signal)]">
          WATCH / DEVIATION
        </p>
        <h1 className="font-display mt-4 text-[clamp(3.2rem,6vw,5.8rem)] font-semibold leading-[.88] tracking-[-.015em]">
          Anomalies
        </h1>
        <p className="mt-5 max-w-[460px] text-[14px] leading-[1.45] text-[var(--wl-secondary2)]">
          Where agent behavior departs from its approved operating shape.
        </p>
      </div>
    </section>
  );
}
