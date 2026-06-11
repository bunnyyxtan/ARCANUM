"use client";

import { AnimatePresence } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { CommandPalette } from "@/components/arcanum/CommandPalette";
import { KeyboardShortcuts } from "@/components/arcanum/KeyboardShortcuts";
import { useArcanumDensity, usePresentationMode } from "@/lib/arcanum-preferences";
import { MotionDiv } from "@/lib/motion-elements";
import { enterRise, useReducedMotion } from "@/lib/motion/motion-config";

export function DashboardPolishLayout({ children }: Readonly<{ children: ReactNode }>) {
  const pathname = usePathname();
  const reduced = useReducedMotion();
  useArcanumDensity();
  usePresentationMode();

  return (
    <>
      <CommandPalette />
      <KeyboardShortcuts />
      <AnimatePresence mode="popLayout" initial={false}>
        <MotionDiv
          key={pathname}
          variants={reduced ? undefined : enterRise}
          initial={reduced ? false : "hidden"}
          animate={reduced ? undefined : "show"}
          exit={reduced ? undefined : "exit"}
        >
          {children}
        </MotionDiv>
      </AnimatePresence>
    </>
  );
}
