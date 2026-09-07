interface EscalationsHeaderProps {
  reviewNext: () => void;
}

export function EscalationsHeader({ reviewNext }: Readonly<EscalationsHeaderProps>) {
  return (
    <div className="flex flex-col justify-between gap-7 border-b border-[var(--wl-line)] pb-9 md:flex-row md:items-end">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
          QUORUM / HUMAN CONTROL
        </p>
        <h1 className="font-display mt-4 text-[clamp(2.7rem,5vw,4.8rem)] font-semibold leading-[.9] tracking-[-.015em]">
          Escalations
        </h1>
        <p className="mt-4 max-w-[560px] text-[14px] leading-[1.45] text-[var(--wl-secondary2)]">
          When an agent reaches the edge of its doctrine, a human gets the final word.
        </p>
      </div>
      <button
        type="button"
        onClick={reviewNext}
        className="arc-pill group w-fit rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[11px] font-semibold text-[var(--wl-bg)]"
      >
        Review next{" "}
        <span className="ml-2 transition-transform duration-[220ms] group-hover:translate-x-1">
          ↗
        </span>
      </button>
    </div>
  );
}
