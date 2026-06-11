import { type MotionProps, motion } from "framer-motion";
import type {
  ButtonHTMLAttributes,
  ComponentType,
  HTMLAttributes,
  RefAttributes,
  SVGProps,
} from "react";

export const MotionDiv = motion.div as ComponentType<HTMLAttributes<HTMLDivElement> & MotionProps>;

export const MotionMain = motion.main as ComponentType<HTMLAttributes<HTMLElement> & MotionProps>;

export const MotionSpan = motion.span as ComponentType<
  HTMLAttributes<HTMLSpanElement> & MotionProps
>;

export const MotionButton = motion.button as ComponentType<
  ButtonHTMLAttributes<HTMLButtonElement> & MotionProps & RefAttributes<HTMLButtonElement>
>;

export const MotionPolyline = motion.polyline as ComponentType<
  SVGProps<SVGPolylineElement> & MotionProps
>;

export const MotionCircle = motion.circle as ComponentType<
  SVGProps<SVGCircleElement> & MotionProps
>;
