"use client";

import { Button } from "@/components/ui/button";
import { systemCopy } from "@/lib/copy";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function NotFound() {
  const pathname = usePathname();

  return (
    <main className="grid min-h-screen place-items-center px-5 bg-foundry-page text-foundry-text-primary">
      <section className="relative w-full max-w-xl overflow-hidden border border-foundry-hairline bg-foundry-panel">
        <div className="absolute inset-y-0 left-0 w-2 bg-foundry-hazard" />
        <div className="p-8 pl-10">
          <div className="font-mono text-[10px] text-foundry-hazard tracking-[0.22em]">
            ROUTE RESTRAINT
          </div>
          <h1 className="mt-3 font-cond text-[42px] font-bold text-foundry-text-primary leading-none tracking-[0.04em]">
            ROUTE NOT FOUND IN DOCTRINE
          </h1>
          <div className="mt-5 border border-foundry-hairline bg-foundry-inset px-3 py-2 font-mono text-[11px] text-foundry-text-secondary">
            {pathname}
          </div>
          <Link href="/dashboard" className="mt-6 inline-flex">
            <Button variant="gradient" size="lg">
              <ArrowLeft className="size-4 mr-2" />
              {systemCopy.actions.returnOverview}
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
