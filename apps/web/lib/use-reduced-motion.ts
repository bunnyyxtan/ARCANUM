"use client";

import { useReducedMotion as useFramerReducedMotion } from "framer-motion";

export function useReducedMotion() {
  return useFramerReducedMotion() === true;
}
