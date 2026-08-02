export default function StatusLoading() {
  return (
    <div className="mx-auto max-w-[1400px] px-5 py-10 md:px-8">
      <div className="h-3 w-40 animate-pulse rounded bg-[var(--wl-bg-soft)]" />
      <div className="mt-5 h-16 w-56 animate-pulse rounded bg-[var(--wl-bg-deep)]" />
      <div className="mt-16 grid grid-cols-3 gap-6 border-y border-[var(--wl-line)] py-7 max-lg:grid-cols-1">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-6">
            <div className="h-3 w-28 animate-pulse rounded bg-[var(--wl-bg-soft)]" />
            <div className="h-14 w-full animate-pulse rounded bg-[var(--wl-bg-soft)]" />
            <div className="h-6 w-32 animate-pulse rounded bg-[var(--wl-bg-deep)]" />
          </div>
        ))}
      </div>
      <div className="mt-16 h-48 w-full animate-pulse rounded bg-[var(--wl-bg-soft)]" />
    </div>
  );
}
