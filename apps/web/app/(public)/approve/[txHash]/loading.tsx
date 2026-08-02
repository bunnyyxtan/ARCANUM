export default function Loading() {
  return (
    <main className="mx-auto max-w-[1080px] px-5 py-10 md:px-9 md:py-16">
      <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[var(--wl-signal)]">
        LOADING APPROVAL REQUEST
      </p>
      <div className="mt-6 h-16 w-2/3 animate-pulse rounded bg-[var(--wl-bg-soft)]" />
      <div className="mt-10 grid gap-4 border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] p-8 md:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-5 w-full animate-pulse rounded bg-[var(--wl-bg-soft)]" />
          ))}
        </div>
        <div className="h-40 w-full animate-pulse rounded bg-[var(--wl-bg-soft)]" />
      </div>
    </main>
  );
}
