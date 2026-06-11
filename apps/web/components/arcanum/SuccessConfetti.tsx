"use client";

import confetti from "canvas-confetti";
import { useEffect, useRef } from "react";

import { confettiMotion } from "@/lib/motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";

type SuccessConfettiProps = Readonly<{
  enabled: boolean;
}>;

function themeColor(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function SuccessConfetti({ enabled }: SuccessConfettiProps) {
  const reducedMotion = useReducedMotion();
  const hasFired = useRef(false);

  useEffect(() => {
    if (!enabled || reducedMotion || hasFired.current) {
      return;
    }

    hasFired.current = true;

    confetti({
      colors: ["--color-hazard", "--color-amber", "--color-steel-green"].map(themeColor),
      drift: confettiMotion.drift,
      gravity: confettiMotion.gravity,
      particleCount: confettiMotion.particleCount,
      scalar: confettiMotion.scalar,
      ticks: confettiMotion.ticks,
    });
  }, [enabled, reducedMotion]);

  return null;
}
