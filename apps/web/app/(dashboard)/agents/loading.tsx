export default function AgentsLoading() {
  return (
    <main className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]">
      <div className="mx-auto max-w-[1400px] px-5 py-9 md:px-8 md:py-10">
        <div className="flex animate-pulse flex-col gap-5 border-b border-[var(--wl-line)] pb-9">
          <div className="h-3 w-32 rounded bg-[var(--wl-line-soft)]" />
          <div className="h-16 w-64 rounded bg-[var(--wl-line-soft)]" />
          <div className="h-4 w-96 max-w-full rounded bg-[var(--wl-line-soft)]" />
        </div>
        <div className="grid gap-10 pt-10 xl:grid-cols-[minmax(0,1.65fr)_minmax(330px,.75fr)]">
          <div className="space-y-4">
            {[0, 1, 2, 3, 4].map((index) => (
              <div key={index} className="grid animate-pulse gap-3 border-b border-[var(--wl-line-soft)] px-3 py-5 md:grid-cols-6 md:items-center">
                <div className="h-4 w-16 rounded-full bg-[var(--wl-line-soft)]" />
                <div className="h-4 w-32 rounded bg-[var(--wl-line-soft)]" />
                <div className="h-4 w-20 rounded bg-[var(--wl-line-soft)]" />
                <div className="h-4 w-20 rounded bg-[var(--wl-line-soft)]" />
                <div className="h-4 w-24 rounded bg-[var(--wl-line-soft)]" />
                <div className="h-4 w-28 rounded bg-[var(--wl-line-soft)]" />
              </div>
            ))}
          </div>
          <div className="h-[420px] animate-pulse rounded bg-[var(--wl-bg-soft)]" />
        </div>
      </div>
    </main>
  );
}
