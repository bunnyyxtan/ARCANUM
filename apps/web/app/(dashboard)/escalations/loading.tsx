export default function EscalationsLoading() {
  return (
    <div className="mx-auto max-w-[1400px] px-5 py-8 md:px-8 md:py-10">
      <div className="border-b border-[var(--wl-line)] pb-9">
        <div className="h-3 w-48 animate-pulse rounded bg-[var(--wl-line-soft)]" />
        <div className="mt-4 h-14 w-72 animate-pulse rounded bg-[var(--wl-line-soft)]" />
        <div className="mt-4 h-4 w-[32rem] max-w-full animate-pulse rounded bg-[var(--wl-line-soft)]" />
      </div>
      <div className="grid grid-cols-3 border-b border-[var(--wl-line)]">
        {[0, 1, 2].map((tile) => (
          <div key={tile} className="py-6 pl-5 first:pl-0 md:pl-7">
            <div className="h-3 w-16 animate-pulse rounded bg-[var(--wl-line-soft)]" />
            <div className="mt-3 h-8 w-10 animate-pulse rounded bg-[var(--wl-line-soft)]" />
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {[0, 1].map((card) => (
          <div
            key={card}
            className="min-h-64 border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] p-5 md:min-h-0 md:p-7"
          >
            <div className="h-3 w-40 animate-pulse rounded bg-[var(--wl-line-soft)]" />
            <div className="mt-6 h-8 w-3/4 animate-pulse rounded bg-[var(--wl-line-soft)]" />
            <div className="mt-4 h-4 w-2/3 animate-pulse rounded bg-[var(--wl-line-soft)]" />
            <div className="mt-8 h-10 w-full animate-pulse rounded bg-[var(--wl-line-soft)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
