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
    <div className="min-h-screen bg-foundry-grid font-mono text-[#D7DBE0]">
      <div className="flex h-[52px] items-center justify-between border-b border-[#282C34] bg-[#16181D] px-5">
        <Skeleton className="h-5 w-64 bg-[#282C34]" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-64 bg-[#20242B]" />
          <Skeleton className="h-8 w-44 bg-[#20242B]" />
          <Skeleton className="h-8 w-32 bg-[#20242B]" />
        </div>
      </div>
      <div className="flex h-10 items-center justify-between border-b border-[#282C34] bg-[#14161A] px-5">
        <div className="flex gap-2">
          {navSkeletons.map(({ key, width }) => (
            <Skeleton key={key} className={`h-5 ${width} bg-[#282C34]`} />
          ))}
        </div>
        <Skeleton className="h-5 w-80 bg-[#282C34]" />
      </div>
      <main className="space-y-4 px-5 py-5">
        <div className="grid grid-cols-4 divide-x divide-[#282C34] border border-[#282C34] bg-[#181B21]">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="p-5">
              <Skeleton className="h-3 w-28 bg-[#282C34]" />
              <Skeleton className="mt-3 h-9 w-20 bg-[#343A44]" />
              <Skeleton className="mt-2 h-3 w-32 bg-[#282C34]" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[1fr_360px] gap-4">
          <section className="border border-[#282C34] bg-[#181B21]">
            <div className="flex h-9 items-center justify-between border-b border-[#282C34] px-4">
              <span className="text-[11px] tracking-[0.22em] text-[#8A909B]">{title}</span>
              <Skeleton className="h-3 w-24 bg-[#282C34]" />
            </div>
            <div className="divide-y divide-[#1E222A]">
              {rowSkeletons.map((rowKey) => (
                <div
                  key={rowKey}
                  className="grid grid-cols-[110px_1fr_1fr_120px_120px] gap-4 px-4 py-3"
                >
                  <Skeleton className="h-4 bg-[#282C34]" />
                  <Skeleton className="h-4 bg-[#282C34]" />
                  <Skeleton className="h-4 bg-[#282C34]" />
                  <Skeleton className="h-4 bg-[#282C34]" />
                  <Skeleton className="h-4 bg-[#282C34]" />
                </div>
              ))}
            </div>
          </section>
          <aside className="space-y-4">
            <Skeleton className="h-48 border border-[#282C34] bg-[#181B21]" />
            <Skeleton className="h-64 border border-[#282C34] bg-[#181B21]" />
          </aside>
        </div>
      </main>
    </div>
  );
}
