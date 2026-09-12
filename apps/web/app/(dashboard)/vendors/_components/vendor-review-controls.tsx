import type { Dispatch, MouseEvent, SetStateAction } from "react";

import type { VendorFlagDetail } from "@/lib/live-data";
import type { Vendor } from "@/lib/types";

import { preserveRawUsdcCapInput, vendorCapDraftState } from "../_lib/helpers";

function focusInlineEditor(input: HTMLInputElement | null) {
  input?.focus();
}

export interface VendorReviewControlsProps {
  detail: {
    capEditing: boolean;
    capValue: string;
    flagNote: string;
    flagNoteOpen: boolean;
    noteEditOpen: boolean;
    noteEditValue: string;
    setCapEditing: Dispatch<SetStateAction<boolean>>;
    setCapValue: Dispatch<SetStateAction<string>>;
    setFlagNote: Dispatch<SetStateAction<string>>;
    setFlagNoteOpen: Dispatch<SetStateAction<boolean>>;
    setNoteEditOpen: Dispatch<SetStateAction<boolean>>;
    setNoteEditValue: Dispatch<SetStateAction<string>>;
  };
  flagToggling: boolean;
  isConnected: boolean;
  isVendorFlagged: (address: string) => boolean;
  saveNoteEdit: (vendor: Vendor) => Promise<void>;
  selected: Vendor | null;
  setVendorStatusRemote: (
    action: "block" | "remove",
    vendor: Vendor,
    event: MouseEvent<HTMLElement>,
  ) => Promise<void>;
  submitCap: (event: MouseEvent<HTMLButtonElement>) => void;
  toggleVendorFlag: (vendor: Vendor) => Promise<void>;
  vendorFlagDetail: (address: string) => VendorFlagDetail | undefined;
  vendorSaving: boolean;
}

export function VendorReviewControls(props: VendorReviewControlsProps) {
  const { selected, detail } = props;
  if (!selected) return null;
  const flagged = props.isVendorFlagged(selected.address);
  const capState = vendorCapDraftState(detail.capValue, "edit");
  return (
    <>
      <div className="mt-8 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            detail.setCapValue("");
            detail.setCapEditing((value) => !value);
          }}
          className="warm-pill warm-pill-ghost rounded-full border border-[var(--wl-line)] px-4 py-2.5 font-mono text-[9px] tracking-[.1em]"
        >
          Update cap
        </button>
        <button
          type="button"
          disabled={props.vendorSaving || selected.trust === "blocked"}
          onClick={(event) => void props.setVendorStatusRemote("block", selected, event)}
          className="rounded-full border border-[var(--wl-signal)] px-4 py-2.5 font-mono text-[9px] tracking-[.1em] text-[var(--wl-signal)] transition-transform duration-[220ms] hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Block vendor
        </button>
        <button
          type="button"
          disabled={props.flagToggling || !props.isConnected}
          title={!props.isConnected ? "Connect wallet first." : undefined}
          onClick={() => void props.toggleVendorFlag(selected)}
          className="rounded-full border border-[var(--wl-line)] px-4 py-2.5 font-mono text-[9px] tracking-[.1em] text-[var(--wl-body)] transition-all duration-[220ms] hover:-translate-y-0.5 hover:border-[var(--wl-signal)] hover:text-[var(--wl-signal)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {flagged ? "Unflag review" : detail.flagNoteOpen ? "Save flag" : "Flag for review"}
        </button>
        {flagged && (
          <button
            type="button"
            disabled={props.flagToggling || !props.isConnected}
            title={!props.isConnected ? "Connect wallet first." : undefined}
            onClick={() => {
              if (detail.noteEditOpen) {
                void props.saveNoteEdit(selected);
              } else {
                detail.setNoteEditValue(props.vendorFlagDetail(selected.address)?.note ?? "");
                detail.setNoteEditOpen(true);
              }
            }}
            className="rounded-full border border-[var(--wl-line)] px-4 py-2.5 font-mono text-[9px] tracking-[.1em] text-[var(--wl-body)] transition-all duration-[220ms] hover:-translate-y-0.5 hover:border-[var(--wl-signal)] hover:text-[var(--wl-signal)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {detail.noteEditOpen
              ? "Save note"
              : props.vendorFlagDetail(selected.address)?.note
                ? "Edit note"
                : "Add note"}
          </button>
        )}
        {flagged && detail.noteEditOpen && (
          <div className="w-full">
            <input
              ref={focusInlineEditor}
              value={detail.noteEditValue}
              maxLength={200}
              onChange={(event) => detail.setNoteEditValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void props.saveNoteEdit(selected);
              }}
              placeholder="Review note (leave empty to clear it)"
              className="w-full max-w-[360px] border-b border-[var(--wl-faint)] bg-transparent py-1.5 text-[11px] text-[var(--wl-ink)] outline-none placeholder:text-[var(--wl-mute)] focus:border-[var(--wl-signal)]"
            />
            <button
              type="button"
              onClick={() => {
                detail.setNoteEditOpen(false);
                detail.setNoteEditValue("");
              }}
              className="mt-1.5 block font-mono text-[9px] uppercase tracking-[.1em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
            >
              Cancel
            </button>
          </div>
        )}
        {!flagged && detail.flagNoteOpen && (
          <div className="w-full">
            <input
              ref={focusInlineEditor}
              value={detail.flagNote}
              maxLength={200}
              onChange={(event) => detail.setFlagNote(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void props.toggleVendorFlag(selected);
              }}
              placeholder="Optional note: why flag this vendor?"
              className="w-full max-w-[360px] border-b border-[var(--wl-faint)] bg-transparent py-1.5 text-[11px] text-[var(--wl-ink)] outline-none placeholder:text-[var(--wl-mute)] focus:border-[var(--wl-signal)]"
            />
            <button
              type="button"
              onClick={() => {
                detail.setFlagNoteOpen(false);
                detail.setFlagNote("");
              }}
              className="mt-1.5 block font-mono text-[9px] uppercase tracking-[.1em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
            >
              Cancel
            </button>
          </div>
        )}
        {!props.isConnected && (
          <p className="w-full font-mono text-[9px] tracking-[.1em] text-[var(--wl-mute)]">
            CONNECT WALLET FIRST
          </p>
        )}
      </div>
      {detail.capEditing && (
        <div className="mt-4 border-l-2 border-[var(--wl-signal)] bg-[var(--wl-bg-soft)] p-4">
          <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
            REVISE PER-PAYMENT CAP / {selected.name.toUpperCase()}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] text-[var(--wl-secondary)]">$</span>
            <input
              ref={focusInlineEditor}
              inputMode="numeric"
              value={detail.capValue}
              aria-describedby={capState.error ? "vendor-cap-edit-error" : undefined}
              aria-invalid={Boolean(capState.error)}
              onChange={(event) => detail.setCapValue(preserveRawUsdcCapInput(event.target.value))}
              placeholder="2500"
              className="w-[110px] border-b border-[var(--wl-faint)] bg-transparent py-1 font-mono text-[13px] outline-none focus:border-[var(--wl-signal)]"
            />
            <span className="font-mono text-[10px] text-[var(--wl-mute)]">PER PAYMENT · USDC</span>
            <button
              type="button"
              disabled={props.vendorSaving || !capState.canSubmit}
              onClick={props.submitCap}
              className="warm-pill ml-2 rounded-full bg-[var(--wl-signal)] px-4 py-2 font-mono text-[9px] tracking-[.1em] text-[var(--wl-bg)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {props.vendorSaving ? "SIGNING…" : "SIGN & APPLY"}
            </button>
            <button
              type="button"
              onClick={() => detail.setCapEditing(false)}
              className="font-mono text-[9px] tracking-[.1em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
            >
              CANCEL
            </button>
          </div>
          {capState.error ? (
            <p
              id="vendor-cap-edit-error"
              role="alert"
              className="mt-2 font-mono text-[8.5px] tracking-[.08em] text-[var(--wl-signal)]"
            >
              {capState.error}
            </p>
          ) : null}
          <p className="mt-2 font-mono text-[8.5px] tracking-[.08em] text-[var(--wl-mute)]">
            WRITES addVendor WITH THE REVISED PER-PAYMENT CAP · WALLET-WIDE DAILY / MONTHLY CAPS
            STILL APPLY
          </p>
        </div>
      )}
    </>
  );
}
