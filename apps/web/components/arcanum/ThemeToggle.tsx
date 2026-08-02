"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "arcanum-theme";

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("wl-dark", dark);
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    /* private mode */
  }
  window.dispatchEvent(new CustomEvent("arcanum-theme-change", { detail: { dark } }));
}

export function useArcanumTheme() {
  const [dark, setDark] = useState(
    () => typeof document !== "undefined" && document.documentElement.classList.contains("wl-dark"),
  );

  useEffect(() => {
    setDark(document.documentElement.classList.contains("wl-dark"));
    const onChange = (event: Event) => {
      setDark(Boolean((event as CustomEvent<{ dark: boolean }>).detail?.dark));
    };
    window.addEventListener("arcanum-theme-change", onChange);
    return () => window.removeEventListener("arcanum-theme-change", onChange);
  }, []);

  return {
    dark,
    toggle: () => applyTheme(!document.documentElement.classList.contains("wl-dark")),
  } as const;
}

type ThemeToggleProps = Readonly<{ className?: string }>;

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { dark, toggle } = useArcanumTheme();

  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      title={dark ? "LIGHT MODE" : "DARK MODE"}
      onClick={toggle}
      className={
        className ??
        "hidden h-8 w-8 items-center justify-center border border-[var(--wl-hairline)] bg-[var(--wl-inset)] text-[var(--wl-text-secondary)] hover:text-[var(--wl-text-body)] sm:flex"
      }
    >
      {dark ? <Sun className="h-4 w-4" strokeWidth={1.5} /> : <Moon className="h-4 w-4" strokeWidth={1.5} />}
    </button>
  );
}
