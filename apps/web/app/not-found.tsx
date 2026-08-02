import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[var(--wl-bg)] px-6 text-center text-[var(--wl-ink)]">
      <p className="font-mono text-[10px] uppercase tracking-[.24em] text-[var(--wl-signal)]">
        ERR / 404
      </p>
      <h1 className="mt-6 text-[clamp(3rem,10vw,7rem)] font-semibold leading-[.84] tracking-[-.05em]">
        Not found
      </h1>
      <p className="mt-6 max-w-[420px] text-[14px] leading-[1.5] text-[var(--wl-body)]">
        The record you asked for is not part of the governed ledger, or it has moved.
      </p>
      <Link
        href="/"
        className="warm-pill mt-9 rounded-full bg-[var(--wl-signal)] px-6 py-3 text-[12px] font-semibold text-[var(--wl-bg)] transition"
      >
        Return home ↗
      </Link>
    </main>
  );
}
