"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[76vh] max-w-[1400px] items-center px-5 py-16 md:px-8">
      <section className="warm-reveal is-visible w-full max-w-[640px]">
        <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[var(--wl-signal)]">
          UNABLE TO LOAD
        </p>
        <h1 className="font-display mt-5 text-[clamp(2.6rem,5.4vw,4.4rem)] font-semibold leading-[.88] tracking-[-.015em]">
          The dashboard hit an error.
        </h1>
        {error.digest ? (
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
            REFERENCE / {error.digest}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={reset}
            className="warm-pill group rounded-full bg-[var(--wl-signal)] px-6 py-3 text-[12px] font-semibold text-white"
          >
            Retry
          </button>
          <Link
            href="/dashboard"
            className="warm-pill warm-pill-ghost rounded-full border border-[var(--wl-line)] px-5 py-3 text-[12px] font-semibold"
          >
            Back to dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
