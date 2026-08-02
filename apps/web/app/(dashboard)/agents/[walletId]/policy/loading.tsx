export default function PolicyEditorLoading() {
  return (
    <main className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]">
      <div className="mx-auto max-w-[1400px] px-5 py-9 md:px-8 md:py-10">
        <div className="flex animate-pulse flex-col gap-5 border-b border-[var(--wl-line)] pb-9">
          <div className="h-3 w-40 rounded bg-[var(--wl-line-soft)]" />
          <div className="h-16 w-72 max-w-full rounded bg-[var(--wl-line-soft)]" />
          <div className="h-4 w-96 max-w-full rounded bg-[var(--wl-line-soft)]" />
        </div>
        <div className="grid gap-10 pt-10 xl:grid-cols-[minmax(0,1.55fr)_360px]">
          <div className="animate-pulse border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] p-9">
            <div className="h-8 w-56 rounded bg-[var(--wl-line-soft)]" />
            <div className="mt-8 space-y-5">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="h-10 rounded bg-[var(--wl-line-soft)]" />
              ))}
            </div>
          </div>
          <div className="h-[420px] animate-pulse rounded bg-[var(--wl-bg-soft)]" />
        </div>
      </div>
    </main>
  );
}
