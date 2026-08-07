export default function Loading() {
  return (
    <main className="mx-auto max-w-[1120px] px-5 py-7 md:px-9 md:py-16">
      <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[var(--wl-signal)]">
        ARC / LOADING PUBLIC EXPLORER
      </p>
      <div className="mt-6 h-16 w-2/3 animate-pulse rounded bg-[var(--wl-bg-soft)]" />
      <div className="mt-4 h-4 w-1/2 animate-pulse rounded bg-[var(--wl-bg-soft)]" />
      <div className="mt-12 space-y-3 border-t border-[var(--wl-line)] pt-8">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-6 w-full animate-pulse rounded bg-[var(--wl-bg-soft)]" />
        ))}
      </div>
    </main>
  );
}
