import type { SettingsController } from "../_hooks/use-settings-controller";

export function SettingsHeader({ settings }: { settings: SettingsController }) {
  return (
    <div className="flex items-end justify-between gap-8 max-md:flex-col max-md:items-start">
      <div className="warm-reveal is-visible">
        <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[var(--wl-signal)]">
          WORKSPACE / GOVERNANCE
        </p>
        <h1 className="font-display mt-5 text-[clamp(3rem,6vw,5.8rem)] font-semibold leading-[.85] tracking-[-.015em]">
          Settings
        </h1>
        <p className="mt-6 max-w-[500px] text-[14px] leading-[1.5] text-[var(--wl-secondary2)]">
          Keep the people, permissions, and integrations around governed spend legible.
        </p>
      </div>
      <div className="flex flex-col items-start gap-1.5 max-md:w-full md:items-end">
        <button
          type="button"
          disabled={!settings.isConnected || !settings.isOwner}
          title={
            !settings.isConnected
              ? "Connect wallet first."
              : !settings.isOwner
                ? "Only the workspace owner can change who has access."
                : undefined
          }
          onClick={() => {
            if (!settings.isConnected || !settings.isOwner) return;
            settings.setInviteOpen(true);
          }}
          className="warm-pill group rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Invite member{" "}
          <span className="ml-1.5 inline-block transition-transform duration-[220ms] group-hover:translate-x-1">
            ↗
          </span>
        </button>
        {!settings.isConnected ? (
          <span className="font-mono text-[9px] tracking-[.12em] text-[var(--wl-mute)]">
            CONNECT WALLET FIRST
          </span>
        ) : settings.isOwner ? null : (
          <span className="font-mono text-[9px] tracking-[.12em] text-[var(--wl-mute)]">
            OWNER ONLY
          </span>
        )}
      </div>
    </div>
  );
}
