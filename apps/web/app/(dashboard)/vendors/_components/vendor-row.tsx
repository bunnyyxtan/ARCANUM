import type { CSSProperties } from "react";

import { shortAddress } from "@/lib/format/address";
import type { Vendor } from "@/lib/types";

import type { VendorsController } from "../_hooks/use-vendors-controller";
import { categoryLabel } from "../_lib/helpers";

export function StatePill({ blocked }: { blocked: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.12em] ${
        blocked
          ? "bg-[var(--wl-ink)] text-[var(--wl-bg)]"
          : "bg-[var(--wl-green-tint)] text-[var(--wl-green)]"
      }`}
    >
      {blocked ? "BLOCKED" : "APPROVED"}
    </span>
  );
}

type VendorRowProps = Pick<
  VendorsController,
  | "selected"
  | "registry"
  | "selectVendor"
  | "isVendorFlagged"
  | "vendorFlagDetail"
  | "vendorUnflagDetail"
  | "form"
  | "setVendorStatusRemote"
> & { vendor: Vendor; index: number };

export function VendorRow(props: VendorRowProps) {
  const { vendor, index, registry, form } = props;
  const flag = props.vendorFlagDetail(vendor.address);
  const unflag = props.vendorUnflagDetail(vendor.address);
  return (
    <div
      onClick={() => {
        props.selectVendor(vendor.id);
        registry.setNotice(`${vendor.name.toUpperCase()} SELECTED · DETAIL RAIL READY`);
      }}
      onKeyDown={(event) => event.key === "Enter" && props.selectVendor(vendor.id)}
      role="button"
      tabIndex={0}
      style={{ "--row": index } as CSSProperties}
      className={`vendor-row relative grid w-full gap-3 px-4 py-5 text-left max-md:gap-4 lg:grid-cols-[1.1fr_.7fr_1fr_1.2fr_.8fr_.65fr] lg:items-center ${
        props.selected?.id === vendor.id ? "bg-[var(--wl-bg-soft)]" : ""
      }`}
    >
      <span className="min-w-0">
        <strong className="block truncate text-[13px] font-medium">{vendor.name}</strong>
        <small className="mt-1 block font-mono text-[9px] text-[var(--wl-mute)]">
          {shortAddress(vendor.address)}
        </small>
        {props.isVendorFlagged(vendor.address) && (
          <span
            title={
              flag
                ? `Flagged by ${flag.flaggedBy} · ${flag.flaggedAt}${
                    flag.note ? ` · ${flag.note}` : ""
                  }${
                    flag.noteEditedBy
                      ? ` · Note last edited by ${flag.noteEditedBy} · ${flag.noteEditedAt}`
                      : ""
                  }`
                : undefined
            }
            className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--wl-signal)] px-2 py-0.5 font-mono text-[8px] uppercase tracking-[.12em] text-[var(--wl-signal)]"
          >
            <span className="shrink-0">⚑ Review</span>
            {flag && (
              <span className="min-w-0 truncate normal-case tracking-[.08em] text-[var(--wl-secondary)]">
                by {flag.flaggedByShort} · {flag.flaggedAt}
                {flag.note && <span className="max-w-[140px] truncate">· “{flag.note}”</span>}
                {flag.noteEditedBy && (
                  <span>
                    {" "}
                    · note edited by {flag.noteEditedByShort} · {flag.noteEditedAt}
                  </span>
                )}
              </span>
            )}
          </span>
        )}
        {!props.isVendorFlagged(vendor.address) && unflag && (
          <span
            title={`Review flag removed by ${unflag.removedBy} · ${unflag.removedAt}`}
            className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--wl-line)] px-2 py-0.5 font-mono text-[8px] uppercase tracking-[.12em] text-[var(--wl-mute)]"
          >
            <span className="shrink-0">Unflagged</span>
            <span className="min-w-0 truncate normal-case tracking-[.08em]">
              by {unflag.removedByShort} · {unflag.removedAt}
            </span>
          </span>
        )}
      </span>
      <span className="w-fit rounded-full border border-[var(--wl-line)] px-2.5 py-1 font-mono text-[9px] tracking-[.1em] text-[var(--wl-body)]">
        <small className="mr-2 text-[8px] text-[var(--wl-mute)] md:hidden">CATEGORY</small>
        {categoryLabel(vendor.category)}
      </span>
      <span className="font-mono text-[11px] tabular-nums text-[var(--wl-body)]">
        <small className="mr-2 text-[8px] tracking-[.12em] text-[var(--wl-mute)] md:hidden">
          CAP
        </small>
        {vendor.confidential ? "capped" : "no cap"}
      </span>
      <span>
        <small className="mr-2 font-mono text-[8px] tracking-[.12em] text-[var(--wl-mute)] md:hidden">
          APPROVED BY
        </small>
        <span className="block text-[12px]">
          {vendor.approvedBy[0] ? shortAddress(vendor.approvedBy[0]) : "-"}
        </span>
        <small className="mt-1 block font-mono text-[9px] text-[var(--wl-mute)]">
          {vendor.createdAt ?? "N/A"}
        </small>
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[.1em]">
        <small className="mr-2 text-[8px] tracking-[.12em] text-[var(--wl-mute)] md:hidden">
          TRUST
        </small>
        {vendor.trust}
      </span>
      <span className="flex items-center justify-between gap-3">
        <StatePill blocked={vendor.trust === "blocked"} />
        <span data-vendor-menu className="relative" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            aria-label={`Actions for ${vendor.name}`}
            aria-expanded={registry.menu === vendor.id}
            onClick={() => registry.setMenu(registry.menu === vendor.id ? null : vendor.id)}
            className="flex h-11 w-11 items-center justify-center font-mono text-[16px] text-[var(--wl-secondary)] transition-colors hover:text-[var(--wl-signal)]"
          >
            ⋯
          </button>
          {registry.menu === vendor.id && (
            <div
              role="menu"
              className="absolute right-0 top-8 z-20 w-[190px] border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] p-1 shadow-[8px_10px_0_var(--wl-line-faint)]"
            >
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(vendor.address);
                  registry.setNotice(`${vendor.name.toUpperCase()} ADDRESS COPIED`);
                  registry.setMenu(null);
                }}
                className="block w-full px-3 py-2 text-left font-mono text-[9px] hover:bg-[var(--wl-bg-soft)]"
              >
                COPY ADDRESS
              </button>
              {(["block", "remove"] as const).map((action) => (
                <button
                  key={action}
                  type="button"
                  disabled={form.vendorSaving || (action === "block" && vendor.trust === "blocked")}
                  onClick={(event) => {
                    registry.setMenu(null);
                    void props.setVendorStatusRemote(action, vendor, event);
                  }}
                  className="block w-full px-3 py-2 text-left font-mono text-[9px] text-[var(--wl-signal)] hover:bg-[var(--wl-bg-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {action === "block" ? "BLOCK VENDOR" : "REMOVE VENDOR"}
                </button>
              ))}
            </div>
          )}
        </span>
      </span>
    </div>
  );
}
