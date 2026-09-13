"use client";

import { useDialogFocus } from "@/lib/use-dialog-focus";

import type { SettingsController } from "../_hooks/use-settings-controller";
import { inviteRoles } from "../_lib/settings";

export function InviteDialog({ settings }: { settings: SettingsController }) {
  const dialogRef = useDialogFocus(settings.inviteOpen, () => settings.setInviteOpen(false));

  if (!settings.inviteOpen) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-30 flex items-center justify-center bg-[rgba(var(--wl-ink-rgb),.18)] p-5"
      // biome-ignore lint/a11y/useSemanticElements: custom ARIA dialog is managed by useDialogFocus; native showModal lifecycle is intentionally not used
      role="dialog"
      aria-modal="true"
      aria-label="Invite team member"
    >
      <button
        type="button"
        aria-label="Close invite dialog"
        aria-hidden="true"
        data-dialog-backdrop
        tabIndex={-1}
        className="absolute inset-0"
        onClick={() => settings.setInviteOpen(false)}
      />
      <div className="relative w-full max-w-[450px] border border-[var(--wl-line)] bg-[var(--wl-bg)] p-7 shadow-[0_24px_50px_-28px_rgba(var(--wl-ink-rgb),.6)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
              TEAM / INVITATION
            </p>
            <h2 className="font-display mt-4 text-[28px] font-semibold tracking-[-.015em]">
              Invite a member.
            </h2>
          </div>
          <button
            type="button"
            onClick={() => settings.setInviteOpen(false)}
            className="font-mono text-[11px] text-[var(--wl-secondary)] transition-colors hover:text-[var(--wl-ink)]"
          >
            CLOSE
          </button>
        </div>
        <label className="mt-8 block">
          <span className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
            WALLET ADDRESS
          </span>
          <input
            value={settings.inviteWallet}
            onChange={(event) => settings.setInviteWallet(event.target.value)}
            spellCheck={false}
            data-dialog-autofocus
            className="mt-2 w-full border-b border-[var(--wl-line)] bg-transparent py-3 font-mono text-[13px] outline-none transition-colors placeholder:text-[var(--wl-mute)] focus:border-[var(--wl-signal)]"
            placeholder="0x…"
          />
          <span className="mt-2 block font-mono text-[9px] uppercase tracking-[.12em] text-[var(--wl-mute)]">
            THEY SIGN IN WITH THIS WALLET · NO EMAIL, NO PASSWORD
          </span>
        </label>
        <fieldset className="mt-7">
          <legend className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
            ROLE
          </legend>
          <div className="mt-3 space-y-1">
            {inviteRoles.map(([value, detail]) => (
              <label
                key={value}
                className={`flex cursor-pointer items-start gap-3 border-b border-[var(--wl-line-soft)] py-3 ${
                  settings.inviteRole === value
                    ? "text-[var(--wl-ink)]"
                    : "text-[var(--wl-secondary)]"
                }`}
              >
                <input
                  type="radio"
                  name="invite-role"
                  value={value}
                  checked={settings.inviteRole === value}
                  onChange={() => settings.setInviteRole(value)}
                  className="mt-1 accent-[var(--wl-signal)]"
                />
                <span>
                  <strong className="block font-mono text-[10px] uppercase tracking-[.14em]">
                    {value}
                  </strong>
                  <span className="mt-1 block text-[12px] text-[var(--wl-secondary)]">
                    {detail}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {settings.addMember.error && (
          <p
            role="alert"
            className="mt-5 border-l-2 border-[var(--wl-signal)] pl-3 text-[12px] leading-[1.5] text-[var(--wl-signal)]"
          >
            {settings.addMember.error.message}
          </p>
        )}
        <div className="mt-8 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => settings.setInviteOpen(false)}
            className="warm-pill warm-pill-ghost rounded-full border border-[var(--wl-line)] px-5 py-3 text-[12px] font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={settings.invite}
            disabled={!settings.inviteReady || settings.addMember.isPending}
            className="warm-pill rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {settings.addMember.isPending ? "Adding…" : "Add member ↗"}
          </button>
        </div>
      </div>
    </div>
  );
}
