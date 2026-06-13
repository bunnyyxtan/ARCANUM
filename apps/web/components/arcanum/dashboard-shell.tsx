"use client";

import { Bell, Building2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccountChip } from "@/components/arcanum/AccountChip";
import { useArcanumRuntime } from "@/components/arcanum/ArcanumRuntime";
import { CommandBar } from "@/components/arcanum/CommandBar";
import { GlobalNav } from "@/components/arcanum/GlobalNav";
import { motionCssEasings, motionDurations } from "@/lib/motion";

type DashboardShellProps = Readonly<{
  children: ReactNode;
}>;

export function DashboardShell({ children }: DashboardShellProps) {
  const { openShortcutHelp } = useArcanumRuntime();
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-coal-grid text-ash">
      <header className="dashboard-chrome fixed inset-x-0 top-0 z-40 border-line-subtle border-b bg-panel-dark/95 backdrop-blur">
        <div className="flex h-chrome items-center gap-4 px-6">
          <button
            type="button"
            onClick={() => toast.info("ORG SWITCHER / Connect wallet to load workspace")}
            className="flex h-9 cursor-pointer items-center gap-2 border border-line-subtle bg-foundry-panel px-3 font-mono-arcanum text-[11px] text-ash-bright tracking-[0.14em] transition hover:border-line-active hover:bg-panel-hover"
            style={{
              transitionDuration: `${motionDurations.micro}ms`,
              transitionTimingFunction: motionCssEasings.standard,
            }}
          >
            <Building2 aria-hidden="true" className="size-4 text-hazard" />
            HELIX-DAO
          </button>

          <div className="flex flex-1 justify-center">
            <CommandBar />
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setNotificationsOpen((open) => !open)}
              className="grid size-9 cursor-pointer place-items-center border border-line-subtle bg-foundry-panel text-ash-soft transition hover:border-line-active hover:bg-panel-hover hover:text-ash-bright"
              style={{
                transitionDuration: `${motionDurations.micro}ms`,
                transitionTimingFunction: motionCssEasings.standard,
              }}
              aria-expanded={notificationsOpen}
              aria-label="Open alerts"
            >
              <Bell aria-hidden="true" className="size-4" />
            </button>
            {notificationsOpen ? (
              <>
                <button
                  type="button"
                  aria-label="Close notifications"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setNotificationsOpen(false)}
                />
                <div className="absolute right-0 top-11 z-50 w-80 border border-line-subtle bg-foundry-panel shadow-[0_18px_50px_rgba(0,0,0,0.45)]">
                  <div className="flex items-center justify-between border-line-subtle border-b px-4 py-3">
                    <span className="font-mono-arcanum text-[11px] text-ash-bright tracking-[0.16em]">
                      NOTIFICATIONS
                    </span>
                    <button
                      type="button"
                      aria-label="Close notifications"
                      onClick={() => setNotificationsOpen(false)}
                      className="text-ash-soft hover:text-ash-bright"
                    >
                      ×
                    </button>
                  </div>
                  <div className="divide-y divide-line-subtle text-[12px]">
                    {[
                      ["Escalation waiting", "$96.20 to AWS Bedrock needs quorum."],
                      ["Vendor review", "Qdrant Cloud is staged until contracts deploy."],
                      ["Indexer quiet", "No live on-chain events indexed in this session."],
                    ].map(([title, body]) => (
                      <div key={title} className="px-4 py-3">
                        <div className="text-ash-bright">{title}</div>
                        <div className="mt-1 text-ash-soft">{body}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <AccountChip />
        </div>
        <GlobalNav />
      </header>
      {children}
      <button
        type="button"
        onClick={openShortcutHelp}
        className="dashboard-chrome fixed right-4 bottom-4 z-40 grid size-8 cursor-pointer place-items-center border border-line-subtle bg-foundry-panel font-mono-arcanum text-[12px] text-ash-soft transition hover:border-line-active hover:bg-panel-hover hover:text-ash-bright"
        style={{
          transitionDuration: `${motionDurations.micro}ms`,
          transitionTimingFunction: motionCssEasings.standard,
        }}
        aria-label="Open keyboard shortcuts"
      >
        ?
      </button>
    </div>
  );
}
