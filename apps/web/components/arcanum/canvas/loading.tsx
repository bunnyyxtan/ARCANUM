import { Skeleton } from "@/components/ui/skeleton";

type CanvasLoadingProps = Readonly<{
  title?: string;
  rows?: number;
}>;

const navSkeletons = [
  { key: "overview", width: "w-20" },
  { key: "agents", width: "w-16" },
  { key: "vendors", width: "w-20" },
  { key: "ledger", width: "w-20" },
  { key: "escalations", width: "w-28" },
  { key: "anomalies", width: "w-24" },
] as const;

export function CanvasLoading({ title = "LOADING FOUNDRY VIEW", rows = 8 }: CanvasLoadingProps) {
  const rowSkeletons = Array.from({ length: rows }, (_, index) => `loading-row-${index}`);

  return (
    <div className="min-h-screen bg-foundry-grid font-mono text-[var(--wl-text-body)]">
      <div className="flex h-[52px] items-center justify-between border-b border-[var(--wl-hairline)] bg-[var(--wl-panel2)] px-5">
        <Skeleton className="h-5 w-64 bg-[var(--wl-hairline)]" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-64 bg-[var(--wl-panel-muted)]" />
          <Skeleton className="h-8 w-44 bg-[var(--wl-panel-muted)]" />
          <Skeleton className="h-8 w-32 bg-[var(--wl-panel-muted)]" />
        </div>
      </div>
      <div className="flex h-10 items-center justify-between border-b border-[var(--wl-hairline)] bg-[var(--wl-panel-dark)] px-5">
        <div className="flex gap-2">
          {navSkeletons.map(({ key, width }) => (
            <Skeleton key={key} className={`h-5 ${width} bg-[var(--wl-hairline)]`} />
          ))}
        </div>
        <Skeleton className="h-5 w-80 bg-[var(--wl-hairline)]" />
      </div>
      <main className="space-y-4 px-5 py-5">
        <div className="grid grid-cols-4 divide-x divide-[var(--wl-hairline)] border border-[var(--wl-hairline)] bg-[var(--wl-panel)]">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="p-5">
              <Skeleton className="h-3 w-28 bg-[var(--wl-hairline)]" />
              <Skeleton className="mt-3 h-9 w-20 bg-[var(--wl-line-strong)]" />
              <Skeleton className="mt-2 h-3 w-32 bg-[var(--wl-hairline)]" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_360px] gap-4">
          <section className="border border-[var(--wl-hairline)] bg-[var(--wl-panel)]">
            <div className="flex h-9 items-center justify-between border-b border-[var(--wl-hairline)] px-4">
              <span className="text-[11px] tracking-[0.22em] text-[var(--wl-text-secondary)]">
                {title}
              </span>
              <Skeleton className="h-3 w-24 bg-[var(--wl-hairline)]" />
            </div>
            <div className="divide-y divide-[var(--wl-subrule)]">
              {rowSkeletons.map((rowKey) => (
                <div
                  key={rowKey}
                  className="grid grid-cols-[110px_1fr_1fr_120px_120px] gap-4 px-4 py-3"
                >
                  <Skeleton className="h-4 bg-[var(--wl-hairline)]" />
                  <Skeleton className="h-4 bg-[var(--wl-hairline)]" />
                  <Skeleton className="h-4 bg-[var(--wl-hairline)]" />
                  <Skeleton className="h-4 bg-[var(--wl-hairline)]" />
                  <Skeleton className="h-4 bg-[var(--wl-hairline)]" />
                </div>
              ))}
            </div>
          </section>
          <aside className="space-y-4">
            <Skeleton className="h-48 border border-[var(--wl-hairline)] bg-[var(--wl-panel)]" />
            <Skeleton className="h-64 border border-[var(--wl-hairline)] bg-[var(--wl-panel)]" />
          </aside>
        </div>
      </main>
    </div>
  );
}
