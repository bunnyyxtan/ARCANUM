"use client";

import type { ReactNode } from "react";

import { fadeUp, motionTransition, staggerContainer } from "@/lib/motion";
import { MotionDiv } from "@/lib/motion-elements";
import { useReducedMotion } from "@/lib/use-reduced-motion";

type PageMotionProps = Readonly<{
  children: ReactNode;
  className?: string;
}>;

export function PageMotion({ children, className }: PageMotionProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <MotionDiv
      className={className}
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      exit="hidden"
      transition={motionTransition("short", "standard")}
    >
      {children}
    </MotionDiv>
  );
}

type PageMotionItemProps = Readonly<{
  children: ReactNode;
  className?: string;
}>;

export function PageMotionItem({ children, className }: PageMotionItemProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <MotionDiv
      className={className}
      variants={fadeUp}
      transition={motionTransition("base", "outExpo")}
    >
      {children}
    </MotionDiv>
  );
}
