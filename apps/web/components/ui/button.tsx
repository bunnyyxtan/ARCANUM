"use client";

import * as React from "react";

import {
  motionCssEasings,
  motionDurations,
  motionTransforms,
  motionTransition,
} from "@/lib/motion";
import { MotionButton } from "@/lib/motion-elements";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "gradient" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg" | "xl" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-hazard text-coal-grid shadow-none hover:brightness-[1.04] hover:shadow-[0_0_24px_-8px_color-mix(in_srgb,var(--color-hazard)_40%,transparent)] focus-visible:ring-hazard",
  gradient:
    "bg-[linear-gradient(135deg,var(--color-hazard)_0%,var(--color-amber)_100%)] text-coal-grid shadow-[0_0_32px_color-mix(in_srgb,var(--color-hazard)_24%,transparent)] hover:brightness-[1.04] hover:shadow-[0_0_24px_-8px_color-mix(in_srgb,var(--color-hazard)_40%,transparent)] focus-visible:ring-hazard",
  secondary:
    "border border-line-strong bg-panel-muted text-ash-bright hover:border-line-active hover:bg-panel-hover hover:brightness-[1.04] focus-visible:ring-hazard",
  ghost:
    "bg-transparent text-ash-soft hover:bg-panel-hover hover:text-ash-bright hover:brightness-[1.04] focus-visible:ring-hazard",
  destructive: "bg-rust text-ash-bright hover:brightness-[1.04] focus-visible:ring-rust",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 gap-2 px-3 text-[13px]",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-12 gap-2 px-5 text-base",
  xl: "h-14 gap-3 px-7 text-[17px]",
  icon: "h-10 w-10 p-0",
};

type NativeButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onAnimationStart" | "onDrag" | "onDragEnd" | "onDragStart"
>;

export type ButtonProps = NativeButtonProps & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", style, ...props }, ref) => {
    const reducedMotion = useReducedMotion();

    return (
      <MotionButton
        ref={ref}
        type={type}
        whileTap={
          reducedMotion ? undefined : { filter: "brightness(0.96)", y: motionTransforms.pressY }
        }
        transition={motionTransition("instant", "standard")}
        style={{
          transitionDuration: `${motionDurations.micro}ms`,
          transitionTimingFunction: motionCssEasings.standard,
          ...style,
        }}
        className={cn(
          "inline-flex cursor-pointer items-center justify-center rounded-lg font-semibold transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-coal-grid",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
