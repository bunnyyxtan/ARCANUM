export default function LedgerLoading() {
  return (
    <main className="mx-auto max-w-[1400px] px-5 py-8 md:px-8 md:py-10">
      <div className="border-b border-[var(--wl-line)] pb-9">
        <div className="h-3 w-36 animate-pulse rounded bg-[var(--wl-bg-soft)]" />
        <div className="mt-4 h-14 w-72 animate-pulse rounded bg-[var(--wl-bg-deep)]" />
      </div>
      <div className="grid grid-cols-2 border-b border-[var(--wl-line)] md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={`py-6 ${i > 0 ? "border-l border-[var(--wl-line)] pl-5 md:pl-7" : ""}`}
          >
            <div className="h-3 w-20 animate-pulse rounded bg-[var(--wl-bg-soft)]" />
            <div className="mt-3 h-8 w-24 animate-pulse rounded bg-[var(--wl-bg-deep)]" />
          </div>
        ))}
      </div>
      <div className="mt-7 space-y-2 border border-[var(--wl-line)] bg-[var(--wl-bg-raised)] p-5">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-10 w-full animate-pulse rounded bg-[var(--wl-bg-soft)]" />
        ))}
      </div>
    </main>
  );
}
