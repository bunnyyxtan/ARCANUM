import type { Metadata } from "next";
import type { ReactNode } from "react";

export function generateMetadata(): Metadata {
  return {
    title: "Documentation | Arcanum",
    description: "Integrate and operate Arcanum governed wallets.",
  };
}

export default function DocsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
