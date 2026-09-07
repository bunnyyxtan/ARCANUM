"use client";

import type { LedgerStatus } from "@/lib/types";
import type { CSSProperties, ReactNode } from "react";
import { useCountUp } from "../_hooks/use-count-up";
import { statusPillStyles } from "../_lib/status-pill-styles";

export function Arrow() {
  return (
    <span
      aria-hidden="true"
      className="ml-1.5 inline-block transition-transform duration-[220ms] group-hover:translate-x-1"
    >
      →
    </span>
  );
}

export function StatusPill({ status }: { status: LedgerStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[9px] uppercase tracking-[.12em] ${statusPillStyles[status]}`}
    >
      {status}
    </span>
  );
}

export function Reveal({
  children,
  className = "",
  index = 0,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
}) {
  return (
    <div
      className={`warm-reveal is-visible ${className}`}
      style={{ "--i": index } as CSSProperties}
    >
      {children}
    </div>
  );
}

export function CountUp({
  target,
  prefix = "",
  suffix = "",
  decimals = 0,
}: {
  target: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}) {
  const value = useCountUp(target);
  return (
    <>
      {prefix}
      {value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </>
  );
}
