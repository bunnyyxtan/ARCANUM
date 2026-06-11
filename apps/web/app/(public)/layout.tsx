import type { ReactNode } from "react";

type PublicLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function PublicLayout({ children }: PublicLayoutProps) {
  return children;
}
