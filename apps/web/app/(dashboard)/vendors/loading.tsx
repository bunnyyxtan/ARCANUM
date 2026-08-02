export default function VendorsLoading() {
  return (
    <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8 sm:py-10">
      <div className="border-b border-[var(--wl-line)] pb-8">
        <div className="h-3 w-48 animate-pulse rounded bg-[var(--wl-line-soft)]" />
        <div className="mt-4 h-16 w-64 animate-pulse rounded bg-[var(--wl-line-soft)]" />
        <div className="mt-5 h-4 w-96 max-w-full animate-pulse rounded bg-[var(--wl-line-soft)]" />
      </div>
      <div className="mt-8 grid grid-cols-3 divide-x divide-[var(--wl-line)] border border-[var(--wl-line)] bg-[var(--wl-bg-soft)]">
        {[0, 1, 2].map((tile) => (
          <div key={tile} className="p-5 sm:p-7">
            <div className="h-3 w-20 animate-pulse rounded bg-[var(--wl-line-soft)]" />
            <div className="mt-6 h-8 w-12 animate-pulse rounded bg-[var(--wl-line-soft)]" />
          </div>
        ))}
      </div>
      <div className="mt-14 divide-y divide-[var(--wl-line-soft)] border-y border-[var(--wl-line)]">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex items-center gap-4 px-4 py-5">
            <div className="h-4 flex-1 animate-pulse rounded bg-[var(--wl-line-soft)]" />
            <div className="h-4 w-16 animate-pulse rounded bg-[var(--wl-line-soft)]" />
            <div className="h-4 w-20 animate-pulse rounded bg-[var(--wl-line-soft)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
