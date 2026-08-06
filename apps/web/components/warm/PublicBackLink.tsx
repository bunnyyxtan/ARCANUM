"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Smart back control for public pages (badge / explorer).
 *
 * Shows "← BACK" only when the browser actually has somewhere to go back
 * to (in-app navigation or an external referrer). Visitors who open the
 * page directly — fresh tab, shared link, embed click-through — never see
 * a dead button.
 */
export function PublicBackLink() {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    setCanGoBack(window.history.length > 1);
  }, []);

  if (!canGoBack) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="font-mono text-[9px] uppercase tracking-[.15em] text-[var(--wl-body)] transition hover:text-[var(--wl-signal)]"
    >
      ← Back
    </button>
  );
}
