import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center border border-line-subtle bg-panel-muted px-2 py-0.5 font-mono text-[10px] text-ash-soft tracking-[0.14em]",
        className,
      )}
      {...props}
    />
  );
}
