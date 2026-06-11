"use client";

import { useReducedMotion as useFramerReducedMotion } from "framer-motion";
import type { Variants } from "framer-motion";

export function useReducedMotion() {
  return useFramerReducedMotion() === true;
}

export const enterFade: Variants = {
  hidden: { opacity: 0 },
  show: (index = 0) => ({
    opacity: 1,
    transition: {
      delay: Number(index) * 0.05,
      duration: 0.18,
      ease: "easeOut",
    },
  }),
};

export const enterRise: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.22,
      ease: "easeOut",
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: {
      duration: 0.12,
      ease: "easeOut",
    },
  },
};

export const hoverLift: Variants = {
  rest: { scale: 1, y: 0 },
  hover: {
    scale: 1.01,
    y: -1,
    transition: {
      duration: 0.12,
      ease: "easeOut",
    },
  },
};

export const tickPulse: Variants = {
  idle: { opacity: 0.4 },
  pulse: {
    opacity: 1,
    transition: {
      duration: 0.9,
      ease: "easeOut",
      repeat: Number.POSITIVE_INFINITY,
      repeatType: "reverse",
    },
  },
};

export function countUp(
  from: number,
  to: number,
  durationMs: number,
  onUpdate: (value: number) => void,
) {
  if (typeof window === "undefined") {
    onUpdate(to);
    return () => undefined;
  }

  const startedAt = window.performance.now();
  const delta = to - from;
  let frame = 0;

  const step = (now: number) => {
    const elapsed = Math.min(now - startedAt, durationMs);
    const progress = durationMs <= 0 ? 1 : elapsed / durationMs;
    const eased = 1 - (1 - progress) ** 3;
    onUpdate(from + delta * eased);

    if (progress < 1) {
      frame = window.requestAnimationFrame(step);
    }
  };

  frame = window.requestAnimationFrame(step);

  return () => window.cancelAnimationFrame(frame);
}
