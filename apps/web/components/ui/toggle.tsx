"use client";

import * as TogglePrimitive from "@radix-ui/react-toggle";
import * as React from "react";

import { cn } from "@/lib/utils";

export const Toggle = React.forwardRef<
  React.ComponentRef<typeof TogglePrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TogglePrimitive.Root>
>(({ className, ...props }, ref) => (
  <TogglePrimitive.Root
    ref={ref}
    className={cn(
      "inline-flex h-8 items-center justify-center border border-line-subtle bg-foundry-panel px-3 text-[11px] text-ash-soft data-[state=on]:bg-hazard data-[state=on]:text-coal-grid",
      className,
    )}
    {...props}
  />
));
Toggle.displayName = TogglePrimitive.Root.displayName;
