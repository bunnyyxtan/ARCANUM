"use client";

/**
 * Warm Ledger light/dark toggle. Dark mode is the old ARCANUM foundry
 * black-grid theme (`html.wl-dark`), persisted in localStorage so
 * public/theme-init.js can re-apply it before first paint.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const toggle = () => {
    const dark = document.documentElement.classList.toggle("wl-dark");
    try {
      localStorage.setItem("arcanum-theme", dark ? "dark" : "light");
    } catch {
      /* storage unavailable — theme just won't persist */
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      className={
        className ??
        "flex h-8 w-8 items-center justify-center text-[var(--wl-body)] transition-transform duration-[220ms] hover:-translate-y-0.5 hover:text-[var(--wl-signal)]"
      }
    >
      <svg aria-hidden="true" viewBox="0 0 20 20" className="wl-icon-moon h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4">
        <path d="M15.5 12.5A6.5 6.5 0 0 1 7.5 4.5a6.5 6.5 0 1 0 8 8Z" />
      </svg>
      <svg aria-hidden="true" viewBox="0 0 20 20" className="wl-icon-sun h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.4">
        <circle cx="10" cy="10" r="4" />
        <path d="M10 1.5v2M10 16.5v2M1.5 10h2M16.5 10h2M4 4l1.4 1.4M14.6 14.6 16 16M16 4l-1.4 1.4M5.4 14.6 4 16" />
      </svg>
    </button>
  );
}
