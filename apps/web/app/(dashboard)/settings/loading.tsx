export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-[1400px] px-5 py-10 md:px-8">
      <div className="h-3 w-40 animate-pulse rounded bg-[var(--wl-bg-soft)]" />
      <div className="mt-5 h-16 w-56 animate-pulse rounded bg-[var(--wl-bg-deep)]" />
      <div className="mt-16 grid grid-cols-[210px_1fr] gap-12 max-[900px]:grid-cols-1">
        <div className="space-y-2 border-t border-[var(--wl-line)] pt-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded bg-[var(--wl-bg-soft)]" />
          ))}
        </div>
        <div className="min-w-0 space-y-4">
          <div className="h-24 w-full animate-pulse rounded bg-[var(--wl-bg-soft)]" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 w-full animate-pulse rounded bg-[var(--wl-bg-soft)]" />
          ))}
        </div>
      </div>
    </div>
  );
}
