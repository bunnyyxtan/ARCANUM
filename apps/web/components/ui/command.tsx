"use client";

import { Command as CommandPrimitive } from "cmdk";
import * as React from "react";

import { cn } from "@/lib/utils";

export const Command = React.forwardRef<
  React.ComponentRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      "flex h-full w-full flex-col overflow-hidden bg-foundry-panel text-ash",
      className,
    )}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

export const CommandInput = React.forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Input
    ref={ref}
    className={cn(
      "h-10 w-full border-line-subtle border-b bg-transparent px-3 text-[12px] outline-none placeholder:text-ash-muted",
      className,
    )}
    {...props}
  />
));
CommandInput.displayName = CommandPrimitive.Input.displayName;

export const CommandList = CommandPrimitive.List;
export const CommandEmpty = CommandPrimitive.Empty;
export const CommandGroup = CommandPrimitive.Group;
export const CommandSeparator = CommandPrimitive.Separator;

export const CommandItem = React.forwardRef<
  React.ComponentRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn("px-3 py-2 text-[12px] aria-selected:bg-panel-hover", className)}
    {...props}
  />
));
CommandItem.displayName = CommandPrimitive.Item.displayName;

export const CommandShortcut = ({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn("ml-auto text-[10px] tracking-widest text-ash-muted", className)}
    {...props}
  />
);
