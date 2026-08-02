export default function AnomaliesLoading() {
  return (
    <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8 sm:py-10">
      <div className="border-b border-[var(--wl-line)] pb-8">
        <div className="h-3 w-40 animate-pulse rounded bg-[var(--wl-line-soft)]" />
        <div className="mt-4 h-16 w-72 animate-pulse rounded bg-[var(--wl-line-soft)]" />
        <div className="mt-5 h-4 w-96 max-w-full animate-pulse rounded bg-[var(--wl-line-soft)]" />
      </div>
      <div className="mt-8 grid gap-5 lg:grid-cols-[1.35fr_.9fr]">
        <div className="border border-[var(--wl-line)] bg-[var(--wl-bg-soft)] p-6 sm:p-8">
          <div className="h-3 w-28 animate-pulse rounded bg-[var(--wl-line-soft)]" />
          <div className="mt-8 h-24 w-40 animate-pulse rounded bg-[var(--wl-line-soft)]" />
        </div>
        <div className="grid grid-cols-3 divide-x divide-[var(--wl-line)] border border-[var(--wl-line)] bg-[var(--wl-bg-raised)]">
          {[0, 1, 2].map((tile) => (
            <div key={tile} className="p-4 sm:p-6">
              <div className="h-3 w-16 animate-pulse rounded bg-[var(--wl-line-soft)]" />
              <div className="mt-9 h-8 w-10 animate-pulse rounded bg-[var(--wl-line-soft)]" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-14 divide-y divide-[var(--wl-line-soft)] border-y border-[var(--wl-line)]">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-4 px-4 py-5">
            <div className="h-4 w-28 animate-pulse rounded bg-[var(--wl-line-soft)]" />
            <div className="h-4 flex-1 animate-pulse rounded bg-[var(--wl-line-soft)]" />
            <div className="h-4 w-24 animate-pulse rounded bg-[var(--wl-line-soft)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
