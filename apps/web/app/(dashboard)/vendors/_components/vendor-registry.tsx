import { ConnectCta } from "@/components/warm/ConnectCta";
import type { VendorFlagDetail, VendorUnflagDetail } from "@/lib/live-data";
import type { Vendor } from "@/lib/types";

import { VendorRow } from "./vendor-row";
import { VendorFilters } from "./vendor-summary";

interface VendorRegistryProps {
  errored: boolean;
  loading: boolean;
  openAddVendor: () => void;
  registry: {
    category: string;
    menu: string | null;
    notice: string;
    query: string;
    setCategory: (value: string) => void;
    setMenu: (value: string | null) => void;
    setNotice: (value: string) => void;
    setQuery: (value: string) => void;
  };
  retryVendors: () => Promise<void>;
  rowActions: {
    isVendorFlagged: (address: string) => boolean;
    selectVendor: (id: string) => void;
    setVendorStatusRemote: (
      action: "block" | "remove",
      vendor: Vendor,
      event: React.MouseEvent<HTMLElement>,
    ) => Promise<void>;
    vendorFlagDetail: (address: string) => VendorFlagDetail | undefined;
    vendorSaving: boolean;
    vendorUnflagDetail: (address: string) => VendorUnflagDetail | undefined;
  };
  selected: Vendor | null;
  visible: readonly Vendor[];
  workspace: { dataMode: string; isResolving: boolean };
}

export function VendorRegistry(props: VendorRegistryProps) {
  const { workspace, loading, errored, visible, selected, registry, rowActions } = props;
  return (
    <section className="mt-14">
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--wl-ink)] pb-4 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.18em] text-[var(--wl-signal)]">
            REGISTRY / GOVERNED
          </p>
          <h2 className="font-display mt-3 text-2xl font-semibold tracking-[-.015em]">
            Vendor registry
          </h2>
        </div>
        <span className="font-mono text-[9px] tracking-[.12em] text-[var(--wl-mute)]">
          {registry.notice}
        </span>
      </div>
      <VendorFilters registry={registry} />
      <div className="hidden grid-cols-[1.1fr_.7fr_1fr_1.2fr_.8fr_.65fr] gap-4 border-b border-[var(--wl-line)] px-4 py-3 font-mono text-[9px] uppercase tracking-[.14em] text-[var(--wl-mute)] lg:grid">
        <span>Vendor</span>
        <span>Category</span>
        <span>Per-payment cap</span>
        <span>Approved by</span>
        <span>Trust</span>
        <span>State</span>
      </div>
      <div className="divide-y divide-[var(--wl-line-soft)] border-b border-[var(--wl-line)]">
        {workspace.dataMode === "disconnected" && !workspace.isResolving ? (
          <ConnectCta className="px-4 py-12 text-center" />
        ) : loading ? (
          [0, 1, 2].map((row) => (
            <div
              key={row}
              className="grid gap-3 px-4 py-5 max-md:gap-4 lg:grid-cols-[1.1fr_.7fr_1fr_1.2fr_.8fr_.65fr]"
            >
              <div className="h-4 w-32 animate-pulse rounded bg-[var(--wl-line-soft)]" />
              <div className="h-4 w-16 animate-pulse rounded bg-[var(--wl-line-soft)]" />
              <div className="h-4 w-20 animate-pulse rounded bg-[var(--wl-line-soft)]" />
              <div className="h-4 w-24 animate-pulse rounded bg-[var(--wl-line-soft)]" />
              <div className="h-4 w-16 animate-pulse rounded bg-[var(--wl-line-soft)]" />
              <div className="h-4 w-16 animate-pulse rounded bg-[var(--wl-line-soft)]" />
            </div>
          ))
        ) : errored ? (
          <div className="px-4 py-12 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[.14em] text-[var(--wl-signal)]">
              VENDOR QUERY FAILED
            </p>
            <button
              type="button"
              onClick={() => void props.retryVendors()}
              className="mt-3 font-mono text-[10px] tracking-[.12em] text-[var(--wl-secondary)] hover:text-[var(--wl-ink)]"
            >
              RETRY
            </button>
          </div>
        ) : visible.length === 0 ? (
          <div className="px-4 py-12 text-center font-mono text-[10px] tracking-[.14em] text-[var(--wl-secondary)]">
            NO VENDORS YET · ADD A COUNTERPARTY TO THE ALLOWLIST
          </div>
        ) : (
          visible.map((vendor, index) => (
            <VendorRow
              key={vendor.id}
              vendor={vendor}
              index={index}
              selected={selected}
              registry={registry}
              selectVendor={rowActions.selectVendor}
              isVendorFlagged={rowActions.isVendorFlagged}
              vendorFlagDetail={rowActions.vendorFlagDetail}
              vendorUnflagDetail={rowActions.vendorUnflagDetail}
              vendorSaving={rowActions.vendorSaving}
              setVendorStatusRemote={rowActions.setVendorStatusRemote}
            />
          ))
        )}
        <button
          type="button"
          onClick={props.openAddVendor}
          className="flex min-h-14 w-full items-center gap-3 border border-dashed border-[var(--wl-line)] px-4 py-5 text-left text-[var(--wl-secondary)] transition-colors duration-[220ms] hover:border-[var(--wl-signal)] hover:text-[var(--wl-signal)]"
        >
          <span className="font-mono text-[13px]">+</span>
          <span className="font-mono text-[10px] uppercase tracking-[.14em]">
            Add vendor to allowlist
          </span>
          <span className="ml-auto font-mono text-[9px]">SIGNED APPROVAL REQUIRED</span>
        </button>
      </div>
    </section>
  );
}
