"use client";

import { useDialogFocus } from "@/lib/use-dialog-focus";

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useDialogFocus(open, onClose);

  if (!open) return null;

  const shortcuts = [
    ["⌘ K", "Open command palette"],
    ["?", "Show keyboard shortcuts"],
    ["ESC", "Close open overlay"],
    ["↑ ↓", "Move through palette"],
  ];

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[65] flex items-center justify-center bg-[rgba(var(--wl-ink-rgb),.14)] p-5"
      // biome-ignore lint/a11y/useSemanticElements: custom ARIA dialog is managed by useDialogFocus; native showModal lifecycle is intentionally not used
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <button
        type="button"
        aria-label="Close keyboard shortcuts"
        aria-hidden="true"
        data-dialog-backdrop
        tabIndex={-1}
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="warm-modal-panel relative z-10 w-full max-w-[420px] border border-[var(--wl-faint)] bg-[var(--wl-bg)] p-6 shadow-[12px_14px_0_var(--wl-line-faint)]">
        <div className="flex items-start justify-between border-b border-[var(--wl-line)] pb-4">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[.17em] text-[var(--wl-signal)]">
              OPERATOR / REFERENCE
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-.05em]">Keyboard shortcuts</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="font-mono text-[9px] text-[var(--wl-secondary)]"
          >
            CLOSE
          </button>
        </div>
        <div className="divide-y divide-[var(--wl-line-soft)]">
          {shortcuts.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between py-4">
              <span className="text-[13px] text-[var(--wl-body)]">{label}</span>
              <kbd className="border border-[var(--wl-line-bold)] bg-[var(--wl-bg-soft)] px-2 py-1 font-mono text-[9px] text-[var(--wl-ink)]">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
