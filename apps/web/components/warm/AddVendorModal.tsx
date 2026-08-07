"use client";

import { useEffect } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

import { getArcscanTxUrl } from "@/lib/arcscan";
import type { AddVendorFormState, VendorCategoryValue } from "@/lib/contracts";
import { vendorCategoryOptions } from "@/lib/contracts";
import { shortAddress } from "@/lib/format/address";

type WalletOption = { address: string; label: string };

export function AddVendorModal({
  error,
  form,
  networkNotice,
  onAdd,
  onChange,
  onClose,
  onWalletChange,
  saving,
  selectedWalletAddress,
  txHash,
  walletOptions,
  writeDisabledReason,
}: Readonly<{
  error: string | null;
  form: AddVendorFormState;
  networkNotice: string | null;
  onAdd: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  onChange: (patch: Partial<AddVendorFormState>) => void;
  onClose: () => void;
  onWalletChange: (address: string) => void;
  saving: boolean;
  selectedWalletAddress: string;
  txHash: string | null;
  walletOptions: ReadonlyArray<WalletOption>;
  writeDisabledReason: string | null;
}>) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const fieldClass =
    "mt-2 h-11 w-full border border-[var(--wl-line)] bg-[var(--wl-bg-raised)] px-3 text-[12px] text-[var(--wl-ink)] outline-none placeholder:text-[var(--wl-mute)] focus:border-[var(--wl-signal)]";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(var(--wl-ink-rgb),.1)] p-5 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Add vendor"
    >
      <button
        type="button"
        aria-label="Close add vendor dialog"
        className="warm-modal-backdrop absolute inset-0 bg-[rgba(var(--wl-ink-rgb),.35)]"
        onClick={onClose}
      />
      <section className="warm-modal-panel relative flex max-h-[calc(100dvh-24px)] w-full max-w-[520px] flex-col border border-[var(--wl-line)] bg-[var(--wl-bg)] shadow-[0_28px_70px_-18px_rgba(var(--wl-ink-rgb),.45)] sm:max-h-[calc(100dvh-40px)]">
        <div className="flex min-h-[60px] items-center justify-between border-b border-[var(--wl-line)] bg-[var(--wl-bg-soft)] px-5">
          <span className="font-mono text-[11px] uppercase tracking-[.18em] text-[var(--wl-ink)]">
            ADD VENDOR
          </span>
          <button
            type="button"
            aria-label="Close add vendor dialog"
            onClick={onClose}
            disabled={saving}
            className="flex h-11 w-11 items-center justify-center border border-[var(--wl-line)] font-mono text-[13px] text-[var(--wl-secondary)] transition-colors hover:border-[var(--wl-ink)] hover:text-[var(--wl-ink)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            ✕
          </button>
        </div>
        <div className="min-h-0 space-y-5 overflow-y-auto overscroll-contain p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-[12px] text-[var(--wl-secondary)]">
          <label className="block">
            <span className="block font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
              GOVERNED WALLET
            </span>
            <select
              value={selectedWalletAddress}
              onChange={(event) => onWalletChange(event.target.value)}
              disabled={saving || walletOptions.length === 0}
              className={`${fieldClass} font-mono`}
            >
              {walletOptions.length > 0 ? (
                walletOptions.map((wallet) => (
                  <option key={wallet.address} value={wallet.address}>
                    {wallet.label} / {shortAddress(wallet.address)}
                  </option>
                ))
              ) : (
                <option value="">No governed wallet available</option>
              )}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="block font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
                VENDOR NAME
              </span>
              <input
                value={form.name}
                onChange={(event) => onChange({ name: event.target.value })}
                placeholder="Qdrant Cloud"
                className="mt-2 h-11 w-full border-b border-[var(--wl-ink)] bg-transparent px-0 text-[15px] leading-[1.5] text-[var(--wl-ink)] outline-none placeholder:text-[var(--wl-mute)] focus:border-[var(--wl-signal)]"
              />
            </label>
            <label className="block">
              <span className="block font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
                CATEGORY
              </span>
              <select
                value={form.category}
                onChange={(event) =>
                  onChange({ category: event.target.value as VendorCategoryValue })
                }
                className={`${fieldClass} font-mono`}
              >
                {vendorCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="block font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
              ADDRESS / DOMAIN
            </span>
            <input
              value={form.address}
              onChange={(event) => onChange({ address: event.target.value })}
              placeholder="0x vendor address"
              className={`${fieldClass} font-mono`}
            />
            <span className="mt-1.5 block font-mono text-[10px] leading-[1.5] tracking-[.08em] text-[var(--wl-mute)]">
              Needs a 0x destination address. Put domains in notes.
            </span>
          </label>

          <label className="block">
            <span className="block font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
              PER-VENDOR CAP / USDC
            </span>
            <input
              value={form.perVendorCap}
              onChange={(event) => onChange({ perVendorCap: event.target.value })}
              inputMode="decimal"
              placeholder="0"
              className={fieldClass}
            />
            <span className="mt-1.5 block font-mono text-[10px] leading-[1.5] tracking-[.08em] text-[var(--wl-mute)]">
              `0` means no vendor-specific cap; global policy caps still apply.
            </span>
          </label>

          <label className="block">
            <span className="block font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-secondary)]">
              NOTES
            </span>
            <input
              value={form.notes}
              onChange={(event) => onChange({ notes: event.target.value })}
              placeholder="approval context, domain, owner"
              className={fieldClass}
            />
          </label>

          {networkNotice ? (
            <div className="border border-[var(--wl-amber)] bg-[var(--wl-bg-soft)] px-3 py-2 font-mono text-[11px] tracking-[.08em] text-[var(--wl-amber)]">
              {networkNotice}
            </div>
          ) : null}
          {writeDisabledReason ? (
            <div className="border border-[var(--wl-line)] bg-[var(--wl-bg-soft)] px-3 py-2 font-mono text-[11px] tracking-[.08em] text-[var(--wl-secondary)]">
              {writeDisabledReason}
            </div>
          ) : null}
          {error ? (
            <div className="border border-[var(--wl-signal)] bg-[var(--wl-bg-soft)] px-3 py-2 font-mono text-[11px] tracking-[.08em] text-[var(--wl-signal)]">
              {error}
            </div>
          ) : null}
          {txHash ? (
            <div className="flex flex-wrap items-center gap-2 border border-[var(--wl-green)] bg-[var(--wl-green-tint)] px-3 py-2 font-mono text-[11px] tracking-[.08em] text-[var(--wl-green)]">
              <span>TX {shortAddress(txHash, { head: 10, tail: 6 })}</span>
              {getArcscanTxUrl(txHash) ? (
                <a
                  href={getArcscanTxUrl(txHash) ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
                >
                  OPEN IN ARCSCAN
                </a>
              ) : null}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="warm-pill warm-pill-ghost flex h-11 items-center justify-center border border-[var(--wl-line)] font-mono text-[11px] tracking-[.12em] text-[var(--wl-secondary)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={(event) => onAdd(event)}
              disabled={saving || Boolean(writeDisabledReason)}
              className="warm-pill flex h-11 items-center justify-center rounded-full bg-[var(--wl-signal)] font-mono text-[11px] tracking-[.12em] text-[var(--wl-bg)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {saving ? "CONFIRMING..." : "ADD / UPDATE VENDOR"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
