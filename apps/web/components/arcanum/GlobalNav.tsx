"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { motionCssEasings, motionDurations, motionTransition } from "@/lib/motion";
import { MotionSpan } from "@/lib/motion-elements";

const navItems = [
  { label: "DASHBOARD", href: "/dashboard" },
  { label: "AGENTS", href: "/agents" },
  { label: "VENDORS", href: "/vendors" },
  { label: "LEDGER", href: "/ledger" },
  { label: "ESCALATIONS", href: "/escalations" },
  { label: "ANOMALIES", href: "/anomalies" },
] as const;

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function GlobalNav() {
  const pathname = usePathname();

  return (
    <nav className="flex h-nav items-center border-line-subtle border-t bg-panel-dark/95 px-6 backdrop-blur">
      <div className="flex h-full items-center gap-1">
        {navItems.map((item) => {
          const isActive = isActivePath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className="relative flex h-full cursor-pointer items-center px-4 font-mono-arcanum text-[11px] text-ash-soft tracking-[0.16em] transition-colors hover:text-ash-bright"
              style={{
                transitionDuration: `${motionDurations.micro}ms`,
                transitionTimingFunction: motionCssEasings.standard,
              }}
            >
              {item.label}
              {isActive ? (
                <MotionSpan
                  layoutId="global-nav-active-underline"
                  className="absolute right-3 bottom-0 left-3 h-px bg-hazard"
                  transition={motionTransition("short", "standard")}
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
