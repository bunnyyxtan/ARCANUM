import type { ReactNode } from "react";

import { DashboardPolishLayout } from "@/components/arcanum/DashboardPolishLayout";

export default function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <DashboardPolishLayout>{children}</DashboardPolishLayout>;
}
