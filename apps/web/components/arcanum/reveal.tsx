import type { CSSProperties, ReactNode } from "react";

export function Reveal({
  children,
  className = "",
  index = 0,
  delayClassPrefix,
}: {
  children: ReactNode;
  className?: string;
  index?: number;
  delayClassPrefix?: string;
}) {
  if (delayClassPrefix) {
    return <div className={`${className} ${delayClassPrefix}${index}`}>{children}</div>;
  }
  return (
    <div
      className={`warm-reveal is-visible ${className}`}
      style={{ "--i": index } as CSSProperties}
    >
      {children}
    </div>
  );
}
