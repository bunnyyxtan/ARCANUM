import type { Metadata } from "next";
import type { ReactNode } from "react";

export function generateMetadata(): Metadata {
  return {
    title: "Glossary | Arcanum",
    description: "Definitions for Arcanum governance, policy, and escalation concepts.",
  };
}

export default function GlossaryLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
