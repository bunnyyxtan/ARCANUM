import type { SettingsController } from "../_hooks/use-settings-controller";
import { InactiveTab } from "./inactive-tab";
import { InviteDialog } from "./invite-dialog";
import { OrganizationTab } from "./organization-tab";
import { SettingsHeader } from "./settings-header";
import { SettingsSidebar } from "./settings-sidebar";
import { TeamTab } from "./team-tab";

export function SettingsPageContent({ settings }: { settings: SettingsController }) {
  return (
    <main className="min-h-[100dvh] bg-[var(--wl-bg)] text-[var(--wl-ink)]">
      <style>{`
        .member-row{transition:transform 220ms cubic-bezier(.16,1,.3,1),background-color 220ms ease}
        .member-row:hover{transform:translateX(3px);background:var(--wl-bg-soft)}
        .settings-tab{transition:color 220ms ease,background-color 220ms ease}
        .settings-tab:hover{background:var(--wl-bg-soft)}
        @media (prefers-reduced-motion:reduce){.member-row{transition:none!important;transform:none!important}}
        @media (max-width:900px){.settings-grid{grid-template-columns:1fr}}
      `}</style>

      <div className="mx-auto max-w-[1400px] px-5 py-10 md:px-8">
        <SettingsHeader settings={settings} />
        <div className="settings-grid mt-16 grid grid-cols-[210px_1fr] gap-12 max-md:mt-10 max-md:gap-8">
          <SettingsSidebar settings={settings} />
          <div className="min-w-0">
            {settings.activeTab === "TEAM" ? (
              <TeamTab settings={settings} />
            ) : settings.activeTab === "ORGANIZATION" ? (
              <OrganizationTab settings={settings} />
            ) : (
              <InactiveTab settings={settings} />
            )}
          </div>
        </div>
      </div>

      <InviteDialog settings={settings} />
      {settings.notice && (
        <div
          role="status"
          className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-5 right-5 border border-[var(--wl-line)] bg-[var(--wl-bg-soft)] px-5 py-4 text-[12px] text-[var(--wl-ink)] shadow-[0_10px_30px_-20px_rgba(var(--wl-ink-rgb),.7)] md:bottom-6 md:left-auto md:right-6"
        >
          {settings.notice}
        </div>
      )}
    </main>
  );
}
