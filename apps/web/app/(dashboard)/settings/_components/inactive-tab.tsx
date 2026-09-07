import type { SettingsController } from "../_hooks/use-settings-controller";

export function InactiveTab({ settings }: { settings: SettingsController }) {
  return (
    <section className="warm-reveal is-visible border border-[var(--wl-line)] bg-[var(--wl-bg-soft)] p-8 md:p-10">
      <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
        WORKSPACE / {settings.activeTab}
      </p>
      <h2 className="font-display mt-7 text-[34px] font-semibold tracking-[-.015em]">
        {settings.activeTab[0] + settings.activeTab.slice(1).toLowerCase()}
      </h2>
      <p className="mt-5 max-w-[560px] text-[15px] leading-[1.5] text-[var(--wl-secondary2)]">
        This workspace surface is owner-managed. Review and approval controls for{" "}
        {settings.activeTab.toLowerCase()} will appear here when configured for {settings.orgName}.
      </p>
      <button
        type="button"
        onClick={() => settings.setActiveTab("TEAM")}
        className="warm-pill warm-pill-ghost mt-8 rounded-full border border-[var(--wl-line)] px-5 py-3 text-[12px] font-semibold"
      >
        Back to team
      </button>
    </section>
  );
}
