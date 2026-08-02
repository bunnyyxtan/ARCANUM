export default function Loading() {
  return (
    <main className="mx-auto max-w-[780px] px-5 py-12 text-center md:py-20">
      <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[var(--wl-signal)]">
        LOADING PUBLIC BADGE
      </p>
      <div className="mx-auto mt-6 h-16 w-2/3 animate-pulse rounded bg-[var(--wl-bg-soft)]" />
      <div className="mx-auto mt-14 h-40 w-full max-w-[560px] animate-pulse rounded bg-[var(--wl-bg-soft)]" />
      <div className="mx-auto mt-14 h-24 w-full animate-pulse rounded bg-[var(--wl-bg-soft)]" />
    </main>
  );
}
