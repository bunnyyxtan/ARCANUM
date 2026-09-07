import { ARC_CHAIN_ID, ARC_NETWORK_NAME } from "@arcanum/shared";

import type { SettingsController } from "../_hooks/use-settings-controller";

export function OrganizationTab({ settings }: { settings: SettingsController }) {
  const { isOwner, members, nameDraft, nameValue, org, renameReady, renameWorkspace } = settings;
  return (
    <section className="warm-reveal is-visible">
      <div className="border-b border-[var(--wl-line)] pb-4">
        <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
          WORKSPACE / ORGANIZATION
        </p>
        <h2 className="font-display mt-4 text-[26px] font-semibold tracking-[-.015em]">
          What this workspace is called.
        </h2>
      </div>

      <div className="mt-8 max-w-[560px]">
        <label className="block">
          <span className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
            WORKSPACE NAME
          </span>
          <input
            value={nameValue}
            disabled={!isOwner || org.isLoading}
            onChange={(event) => settings.setNameDraft(event.target.value)}
            maxLength={120}
            className="mt-2 w-full border-b border-[var(--wl-line)] bg-transparent py-3 text-[16px] outline-none transition-colors focus:border-[var(--wl-signal)] disabled:cursor-not-allowed disabled:text-[var(--wl-secondary)]"
          />
        </label>
        <p className="mt-3 font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
          {isOwner ? "EVERY MEMBER SEES THIS NAME" : "ONLY THE WORKSPACE OWNER CAN RENAME THIS"}
        </p>

        {isOwner && (
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              disabled={!renameReady || renameWorkspace.isPending}
              onClick={() => {
                if (!renameReady || renameWorkspace.isPending) return;
                renameWorkspace.mutate({ name: nameValue.trim() });
              }}
              className="warm-pill rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {renameWorkspace.isPending ? "Saving…" : "Save name"}
            </button>
            {nameDraft !== null && (
              <button
                type="button"
                onClick={() => settings.setNameDraft(null)}
                className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-secondary)] transition-colors hover:text-[var(--wl-ink)]"
              >
                RESET
              </button>
            )}
          </div>
        )}
      </div>

      <dl className="mt-14 border-t border-[var(--wl-line)]">
        {[
          ["NETWORK", `${ARC_NETWORK_NAME} · chain ${ARC_CHAIN_ID}`],
          ["MEMBERS", `${members.length} with access`],
          ["YOUR ROLE", (org.data?.callerRole ?? "-").toUpperCase()],
        ].map(([label, value]) => (
          <div
            key={label}
            className="grid grid-cols-[140px_1fr] gap-6 border-b border-[var(--wl-line-soft)] py-4 max-md:grid-cols-1 max-md:gap-1"
          >
            <dt className="font-mono text-[9px] uppercase tracking-[.16em] text-[var(--wl-mute)]">
              {label}
            </dt>
            <dd className="text-[13px] text-[var(--wl-body)]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
