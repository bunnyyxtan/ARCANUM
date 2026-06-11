import type { Transition, Variants } from "framer-motion";

export const motionDurations = {
  instant: 80,
  micro: 150,
  short: 220,
  base: 320,
  long: 600,
  xlong: 1200,
  staggerChild: 40,
  staggerDelay: 60,
  dataFlash: 200,
  urgencyPulse: 1600,
  anomalyPulse: 2000,
  landingRedirect: 1500,
} as const;

export type MotionDuration = keyof Pick<
  typeof motionDurations,
  "instant" | "micro" | "short" | "base" | "long" | "xlong"
>;

export const motionEasings = {
  outExpo: [0.16, 1, 0.3, 1],
  inExpo: [0.7, 0, 0.84, 0],
  standard: [0.32, 0.72, 0, 1],
  countUp: [0.25, 1, 0.5, 1],
  linear: [0, 0, 1, 1],
} satisfies Record<string, [number, number, number, number]>;

export const motionCssEasings = {
  outExpo: "cubic-bezier(0.16, 1, 0.3, 1)",
  inExpo: "cubic-bezier(0.7, 0, 0.84, 0)",
  standard: "cubic-bezier(0.32, 0.72, 0, 1)",
  countUp: "cubic-bezier(0.25, 1, 0.5, 1)",
  linear: "cubic-bezier(0, 0, 1, 1)",
} as const;

export const motionTransforms = {
  pressY: 1,
  rowEnterY: -8,
  fadeUpY: 8,
  fadeDownY: -8,
} as const;

export const motionOpacity = {
  heartbeatLow: 0.5,
  flagLow: 0.6,
  urgencyLow: 0.7,
  full: 1,
  hidden: 0,
  ghost: 0.55,
} as const;

export const confettiMotion = {
  particleCount: 12,
  gravity: 1.2,
  scalar: 0.6,
  drift: 0,
  ticks: 80,
} as const;

export function motionSeconds(duration: MotionDuration) {
  return motionDurations[duration] / 1000;
}

export function motionTransition(
  duration: MotionDuration,
  ease: keyof typeof motionEasings = "standard",
): Transition {
  return {
    duration: motionSeconds(duration),
    ease: motionEasings[ease],
  };
}

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: motionTransforms.fadeUpY },
  show: { opacity: 1, y: 0 },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1 },
};

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: motionDurations.staggerChild / 1000,
      delayChildren: motionDurations.staggerDelay / 1000,
    },
  },
};
