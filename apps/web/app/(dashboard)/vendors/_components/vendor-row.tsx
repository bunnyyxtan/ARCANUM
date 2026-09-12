import type { CSSProperties, MouseEvent } from "react";

import { copyText } from "@/lib/clipboard";
import { shortAddress } from "@/lib/format/address";
import { formatUSDCBaseUnitsExact } from "@/lib/format/money";
import type { VendorFlagDetail, VendorUnflagDetail } from "@/lib/live-data";
import type { Vendor } from "@/lib/types";

import { categoryLabel } from "../_lib/helpers";

export function StatePill({ trust }: { trust: Vendor["trust"] }) {
  const removed = trust === "removed";
  const blocked = trust === "blocked";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.12em] ${
        removed
          ? "border border-[var(--wl-line)] text-[var(--wl-mute)]"
          : blocked
            ? "bg-[var(--wl-ink)] text-[var(--wl-bg)]"
            : "bg-[var(--wl-green-tint)] text-[var(--wl-green)]"
      }`}
    >
      {removed ? "REMOVED" : blocked ? "BLOCKED" : "APPROVED"}
    </span>
  );
}

interface VendorRowProps {
  index: number;
  isVendorFlagged: (address: string) => boolean;
  registry: {
    menu: string | null;
    setMenu: (value: string | null) => void;
    setNotice: (value: string) => void;
  };
  selected: Vendor | null;
  selectVendor: (id: string) => void;
  setVendorStatusRemote: (
    action: "block" | "remove",
    vendor: Vendor,
    event: MouseEvent<HTMLElement>,
  ) => Promise<void>;
  vendor: Vendor;
  vendorFlagDetail: (address: string) => VendorFlagDetail | undefined;
  vendorSaving: boolean;
  vendorUnflagDetail: (address: string) => VendorUnflagDetail | undefined;
}

export function VendorRow(props: VendorRowProps) {
  const { vendor, index, registry } = props;
  const flag = props.vendorFlagDetail(vendor.address);
  const unflag = props.vendorUnflagDetail(vendor.address);
  const selectRow = () => {
    props.selectVendor(vendor.id);
    registry.setNotice(`${vendor.name.toUpperCase()} SELECTED · DETAIL RAIL READY`);
  };
  const copyVendorAddress = async () => {
    const copied = await copyText(vendor.address);
    registry.setNotice(
      copied
        ? `${vendor.name.toUpperCase()} ADDRESS COPIED`
        : `${vendor.name.toUpperCase()} ADDRESS COPY FAILED · SELECT MANUALLY: ${vendor.address}`,
    );
    registry.setMenu(null);
  };
  // The entrance animation leaves a transform on every row, so each row is its
  // own stacking context and the next row paints over this row's open menu. It
  // is transparent, so the menu stays visible but the row takes the clicks.
  // Lifting the row that owns the open menu keeps the menu above later rows.
  const menuOpen = registry.menu === vendor.id;
  return (
    <div
      onClick={selectRow}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        selectRow();
      }}
      // biome-ignore lint/a11y/useSemanticElements: the row owns nested action buttons, so a native button would create invalid nested controls.
      role="button"
      tabIndex={0}
      style={{ "--row": index } as CSSProperties}
      className={`vendor-row relative grid w-full gap-3 px-4 py-5 text-left max-md:gap-4 lg:grid-cols-[1.1fr_.7fr_1fr_1.2fr_.8fr_.65fr] lg:items-center ${
        props.selected?.id === vendor.id ? "bg-[var(--wl-bg-soft)]" : ""
      } ${menuOpen ? "z-30" : ""}`}
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
          PAYMENT CAP
        </small>
        {vendor.perVendorCap === null
          ? "cap unknown"
          : vendor.confidential
            ? formatUSDCBaseUnitsExact(vendor.perVendorCap)
            : "no cap"}
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
        <StatePill trust={vendor.trust} />
        <span
          data-vendor-menu
          className="relative"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            aria-label={`Actions for ${vendor.name}`}
            aria-expanded={menuOpen}
            onClick={() => registry.setMenu(menuOpen ? null : vendor.id)}
            className="flex h-11 w-11 items-center justify-center font-mono text-[16px] text-[var(--wl-secondary)] transition-colors hover:text-[var(--wl-signal)]"
          >
            ⋯
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-8 z-20 w-[190px] border border-[var(--wl-line-bold)] bg-[var(--wl-bg-raised)] p-1 shadow-[8px_10px_0_var(--wl-line-faint)]"
            >
              <button
                type="button"
                onClick={() => void copyVendorAddress()}
                className="block w-full px-3 py-2 text-left font-mono text-[9px] hover:bg-[var(--wl-bg-soft)]"
              >
                COPY ADDRESS
              </button>
              {(["block", "remove"] as const).map((action) => (
                <button
                  key={action}
                  type="button"
                  disabled={
                    props.vendorSaving ||
                    vendor.trust === "removed" ||
                    (action === "block" && vendor.trust === "blocked")
                  }
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
