"use client";

import { animate, useMotionValue } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import {
  type MotionDuration,
  motionCssEasings,
  motionDurations,
  motionEasings,
  motionSeconds,
} from "@/lib/motion";
import { useReducedMotion } from "@/lib/use-reduced-motion";

type AnimatedNumberProps = Readonly<{
  value: number;
  duration?: MotionDuration;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  minimumIntegerDigits?: number;
}>;

export function AnimatedNumber({
  value,
  duration = "long",
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
  minimumIntegerDigits,
}: AnimatedNumberProps) {
  const reducedMotion = useReducedMotion();
  const motionValue = useMotionValue(reducedMotion ? value : 0);
  const [displayValue, setDisplayValue] = useState(reducedMotion ? value : 0);
  const [isFlashing, setIsFlashing] = useState(false);
  const hasMounted = useRef(false);

  useEffect(() => {
    if (reducedMotion) {
      setDisplayValue(value);
      motionValue.set(value);
      hasMounted.current = true;
      return;
    }

    const isUpdate = hasMounted.current;

    if (isUpdate) {
      setIsFlashing(true);
    }

    const controls = animate(motionValue, value, {
      duration: motionSeconds(isUpdate ? "short" : duration),
      ease: motionEasings.countUp,
      onUpdate: (latest) => setDisplayValue(latest),
    });

    const flashTimer = window.setTimeout(() => {
      setIsFlashing(false);
    }, motionDurations.dataFlash);

    hasMounted.current = true;

    return () => {
      controls.stop();
      window.clearTimeout(flashTimer);
    };
  }, [duration, motionValue, reducedMotion, value]);

  return (
    <span className={className}>
      {prefix}
      <span
        className="tabular-nums"
        style={{
          color: isFlashing ? "var(--color-amber)" : "var(--color-ash-bright)",
          transitionDuration: `${motionDurations.dataFlash}ms`,
          transitionProperty: "color",
          transitionTimingFunction: motionCssEasings.standard,
        }}
      >
        {displayValue.toLocaleString("en-US", {
          maximumFractionDigits: decimals,
          minimumFractionDigits: decimals,
          minimumIntegerDigits,
        })}
      </span>
      {suffix}
    </span>
  );
}
