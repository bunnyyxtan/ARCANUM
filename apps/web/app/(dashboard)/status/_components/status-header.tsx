import { Arrow } from "@/components/arcanum/arrow";

export function StatusHeader({
  isFetching,
  runCheck,
}: {
  isFetching: boolean;
  runCheck: () => void;
}) {
  return (
    <div className="flex items-end justify-between gap-8 max-md:flex-col max-md:items-start">
      <div className="warm-reveal is-visible">
        <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[var(--wl-signal)]">
          SYSTEMS / PLATFORM
        </p>
        <h1 className="font-display mt-5 text-[clamp(3rem,6vw,5.8rem)] font-semibold leading-[.85] tracking-[-.015em]">
          Status
        </h1>
        <p className="mt-6 max-w-[500px] text-[14px] leading-[1.5] text-[var(--wl-secondary2)]">
          A direct read on the services that keep governed wallets accountable.
        </p>
      </div>
      <button
        type="button"
        onClick={runCheck}
        disabled={isFetching}
        className="warm-pill group min-h-11 md:min-h-0 rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[12px] font-semibold text-white disabled:opacity-70"
      >
        {isFetching ? "Checking systems" : "Run health check"}
        <Arrow glyph="↗" />
      </button>
    </div>
  );
}
