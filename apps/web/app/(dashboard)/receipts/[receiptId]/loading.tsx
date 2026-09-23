export default function ReceiptDetailLoading() {
  return (
    <main className="mx-auto max-w-[1400px] px-5 py-8 md:px-8 md:py-10">
      <div className="border-b border-[var(--wl-line)] pb-9">
        <div className="h-3 w-36 animate-pulse rounded bg-[var(--wl-bg-soft)]" />
        <div className="mt-4 h-14 w-72 animate-pulse rounded bg-[var(--wl-bg-deep)]" />
      </div>
      <div className="mt-7 grid gap-7 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-48 w-full animate-pulse rounded border border-[var(--wl-line)] bg-[var(--wl-bg-raised)] p-5"
          />
        ))}
      </div>
    </main>
  );
}
