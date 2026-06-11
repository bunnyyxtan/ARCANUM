"use client";

import { AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";

import { motionTransition } from "@/lib/motion";
import { MotionDiv } from "@/lib/motion-elements";
import { useReducedMotion } from "@/lib/use-reduced-motion";

type DashboardRouteTransitionProps = Readonly<{
  children: ReactNode;
}>;

export function DashboardRouteTransition({ children }: DashboardRouteTransitionProps) {
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();
  const previousPathname = useRef(pathname);
  const previousDepth = routeDepth(previousPathname.current);
  const currentDepth = routeDepth(pathname);
  const direction =
    currentDepth > previousDepth ? "forward" : currentDepth < previousDepth ? "back" : "sibling";

  useEffect(() => {
    previousPathname.current = pathname;
  }, [pathname]);

  if (reducedMotion) {
    return children;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <MotionDiv
        key={pathname}
        initial={initialState(direction)}
        animate={{ opacity: 1, scale: 1 }}
        exit={exitState(direction)}
        transition={motionTransition("short", direction === "sibling" ? "standard" : "outExpo")}
      >
        {children}
      </MotionDiv>
    </AnimatePresence>
  );
}

function routeDepth(pathname: string) {
  return pathname.split("/").filter(Boolean).length;
}

function initialState(direction: "forward" | "back" | "sibling") {
  if (direction === "forward") {
    return { opacity: 0, scale: 1.02 };
  }

  if (direction === "back") {
    return { opacity: 0, scale: 0.98 };
  }

  return { opacity: 0, scale: 1 };
}

function exitState(direction: "forward" | "back" | "sibling") {
  if (direction === "forward") {
    return { opacity: 0, scale: 0.98 };
  }

  if (direction === "back") {
    return { opacity: 0, scale: 1.02 };
  }

  return { opacity: 0, scale: 1 };
}
