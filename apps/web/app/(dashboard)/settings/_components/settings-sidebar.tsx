import type { SettingsController } from "../_hooks/use-settings-controller";
import { settingsTabs } from "../_lib/settings";

export function SettingsSidebar({ settings }: { settings: SettingsController }) {
  return (
    <aside className="border-t border-[var(--wl-line)]">
      {settingsTabs.map((tab) => (
        <button
          type="button"
          key={tab}
          onClick={() => settings.setActiveTab(tab)}
          className={`settings-tab relative flex w-full items-center border-b border-[var(--wl-line)] px-4 py-4 text-left font-mono text-[10px] tracking-[.16em] ${
            settings.activeTab === tab
              ? "bg-[var(--wl-bg-soft)] text-[var(--wl-ink)]"
              : "text-[var(--wl-secondary)]"
          }`}
        >
          {settings.activeTab === tab && (
            <span className="absolute bottom-0 left-0 top-0 w-[2px] bg-[var(--wl-signal)]" />
          )}
          {tab}
        </button>
      ))}
      <p className="mt-7 px-4 font-mono text-[9px] uppercase leading-[1.6] tracking-[.12em] text-[var(--wl-mute)]">
        Changes are reviewed by the workspace owner before they affect a wallet.
      </p>
    </aside>
  );
}
