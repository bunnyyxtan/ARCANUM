export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-[1400px] px-5 py-9 md:px-8 md:py-10">
      <div className="border-b border-[var(--wl-line)] pb-9">
        <div className="h-3 w-40 animate-pulse rounded bg-[var(--wl-bg-soft)]" />
        <div className="mt-5 h-16 w-64 animate-pulse rounded bg-[var(--wl-bg-deep)]" />
      </div>
      <div className="grid border-b border-[var(--wl-line)] md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={`min-h-[142px] py-6 ${i > 0 ? "md:border-l md:border-[var(--wl-line)] md:pl-6" : "md:pr-6"}`}
          >
            <div className="h-3 w-24 animate-pulse rounded bg-[var(--wl-bg-soft)]" />
            <div className="mt-5 h-8 w-20 animate-pulse rounded bg-[var(--wl-bg-deep)]" />
          </div>
        ))}
      </div>
      <div className="grid gap-10 pt-10 xl:grid-cols-[minmax(0,1.65fr)_minmax(350px,.75fr)]">
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 w-full animate-pulse rounded bg-[var(--wl-bg-soft)]" />
          ))}
        </div>
        <div className="h-72 w-full animate-pulse rounded bg-[var(--wl-bg-soft)]" />
      </div>
    </div>
  );
}
