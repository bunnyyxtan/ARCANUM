"use client";

import { signOutAuthSession, useAuthSession } from "@/lib/auth-session";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useDisconnect } from "wagmi";

export function SessionControls() {
  const { user } = useAuthSession();
  const { disconnect } = useDisconnect();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOutAll() {
    setBusy(true);
    setError(null);
    try {
      await signOutAuthSession(true);
      await queryClient.cancelQueries();
      queryClient.clear();
      disconnect();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-out failed. Please retry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="mt-8 border-t border-[var(--wl-line)] px-4 pt-5"
      aria-labelledby="session-controls-title"
    >
      <h2 id="session-controls-title" className="font-mono text-[10px] tracking-[.16em]">
        SIGNED SESSIONS
      </h2>
      <p className="mt-3 text-[12px] leading-relaxed text-[var(--wl-secondary)]">
        Sessions expire after 12 hours. Sign out every device for this wallet in this workspace.
        Wallet connections and onchain permissions are not revoked.
      </p>
      <button
        type="button"
        disabled={busy || !user}
        onClick={() => void signOutAll()}
        className="mt-4 border border-[var(--wl-line)] px-3 py-2 text-left text-[12px] disabled:opacity-50"
      >
        {busy ? "Signing out…" : "Sign out all devices"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-[12px] text-[var(--wl-signal)]">
          {error}
        </p>
      )}
    </section>
  );
}
