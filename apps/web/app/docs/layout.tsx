import type { ReactNode } from "react";

type DocsLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function DocsLayout({ children }: DocsLayoutProps) {
  return children;
}
