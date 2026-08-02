export default function AgentDetailLoading() {
  return (
    <main className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]">
      <div className="mx-auto max-w-[1400px] px-5 py-9 md:px-8 md:py-10">
        <div className="flex animate-pulse flex-col gap-5 border-b border-[var(--wl-line)] pb-9">
          <div className="h-3 w-32 rounded bg-[var(--wl-line-soft)]" />
          <div className="h-16 w-72 max-w-full rounded bg-[var(--wl-line-soft)]" />
          <div className="h-4 w-96 max-w-full rounded bg-[var(--wl-line-soft)]" />
        </div>
        <div className="grid animate-pulse border-b border-[var(--wl-line)] md:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className={`min-h-[130px] py-6 ${index ? "md:pl-6" : "md:pr-6"}`}>
              <div className="h-3 w-20 rounded bg-[var(--wl-line-soft)]" />
              <div className="mt-5 h-8 w-24 rounded bg-[var(--wl-line-soft)]" />
            </div>
          ))}
        </div>
        <div className="grid gap-10 pt-10 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,.8fr)]">
          <div className="space-y-4">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="h-12 animate-pulse rounded border-b border-[var(--wl-line-soft)] bg-[var(--wl-line-soft)]" />
            ))}
          </div>
          <div className="h-[480px] animate-pulse rounded bg-[var(--wl-bg-soft)]" />
        </div>
      </div>
    </main>
  );
}
