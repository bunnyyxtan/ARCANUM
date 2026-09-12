"use client";

import { Arrow } from "@/components/arcanum/arrow";

/**
 * The connected-but-unsigned state. The wallet is attached, the SIWE session
 * is not: either the signature prompt is still open in the wallet or it was
 * dismissed. Say so, and offer the signature again instead of leaving a
 * skeleton on screen that never resolves.
 */
export function SignInCta({ note, className }: Readonly<{ note?: string; className?: string }>) {
  const retry = () => {
    window.dispatchEvent(new Event("arcanum:wallet-auth-retry"));
  };

  return (
    <div className={className ?? "px-6 py-16 text-center"}>
      <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
        SIGNATURE REQUIRED
      </p>
      <p className="mx-auto mt-3 max-w-[420px] text-[13px] leading-[1.6] text-[var(--wl-secondary2)]">
        {note ??
          "Your wallet is connected but has not signed in. Approve the signature in your wallet, or request it again."}
      </p>
      <button
        type="button"
        onClick={retry}
        className="warm-pill group mt-6 rounded-full bg-[var(--wl-signal)] px-6 py-3 text-[12px] font-semibold text-white"
      >
        Sign in
        <Arrow glyph="↗" />
      </button>
    </div>
  );
}
