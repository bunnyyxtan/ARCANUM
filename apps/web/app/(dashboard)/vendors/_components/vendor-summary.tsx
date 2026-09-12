import { vendorCategories } from "../_lib/helpers";

interface VendorHeaderProps {
  approvedCount: number;
  blockedCount: number;
  categoryCount: number;
  openAddVendor: () => void;
}

export function VendorHeader({
  approvedCount,
  blockedCount,
  categoryCount,
  openAddVendor,
}: VendorHeaderProps) {
  return (
    <>
      <section className="flex flex-col justify-between gap-6 border-b border-[var(--wl-line)] pb-8 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[.19em] text-[var(--wl-signal)]">
            COUNTERPARTIES / ALLOWLIST
          </p>
          <h1 className="font-display mt-4 text-[clamp(3.2rem,6vw,5.8rem)] font-semibold leading-[.88] tracking-[-.015em]">
            Vendors
          </h1>
          <p className="mt-5 max-w-[480px] text-[14px] leading-[1.45] text-[var(--wl-secondary2)]">
            The counterparties your agents can pay, with a per-payment cap and an accountable name
            attached.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddVendor}
          className="warm-pill min-h-11 md:min-h-0 w-fit rounded-full bg-[var(--wl-signal)] px-5 py-3 text-[11px] font-semibold text-[var(--wl-bg)]"
        >
          Add vendor <span className="ml-2 text-base leading-none">+</span>
        </button>
      </section>
      <section className="mt-8 grid grid-cols-3 divide-x divide-[var(--wl-line)] border border-[var(--wl-line)] bg-[var(--wl-bg-soft)] max-md:grid-cols-1 max-md:divide-x-0 max-md:divide-y">
        {[
          ["APPROVED", approvedCount, "COUNTERPARTIES", ""],
          ["CATEGORIES", categoryCount, "ACTIVE GROUPS", ""],
          ["BLOCKED", blockedCount, "COUNTERPARTIES", "text-[var(--wl-signal)]"],
        ].map(([label, count, detail, color]) => (
          <div
            key={label}
            className="p-5 sm:p-7 max-md:flex max-md:items-center max-md:justify-between"
          >
            <span className="font-mono text-[9px] tracking-[.15em] text-[var(--wl-secondary)]">
              {label}
            </span>
            <strong
              className={`font-display mt-6 block text-4xl font-semibold tracking-[-.015em] max-md:mt-0 ${color}`}
            >
              {count}
            </strong>
            <span className="mt-2 block font-mono text-[9px] text-[var(--wl-mute)] max-md:hidden">
              {detail}
            </span>
          </div>
        ))}
      </section>
    </>
  );
}

interface VendorFiltersProps {
  registry: {
    category: string;
    query: string;
    setCategory: (value: string) => void;
    setQuery: (value: string) => void;
  };
}

export function VendorFilters({ registry }: VendorFiltersProps) {
  return (
    <div className="flex flex-col justify-between gap-4 border-b border-[var(--wl-line)] py-4 sm:flex-row sm:items-center">
      <div className="flex flex-wrap gap-2">
        {vendorCategories.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => registry.setCategory(item)}
            className={`min-h-11 md:min-h-0 rounded-full px-3 py-1.5 font-mono text-[9px] tracking-[.13em] transition-colors duration-[220ms] ${
              registry.category === item
                ? "bg-[var(--wl-ink)] text-[var(--wl-bg)]"
                : "border border-[var(--wl-line)] text-[var(--wl-secondary2)] hover:border-[var(--wl-ink)] hover:text-[var(--wl-ink)]"
            }`}
          >
            {item}
          </button>
        ))}
      </div>
      <label className="flex items-center gap-2 border-b border-[var(--wl-line)] pb-1 text-[var(--wl-secondary)]">
        <span className="font-mono text-[10px]">⌕</span>
        <input
          value={registry.query}
          onChange={(event) => registry.setQuery(event.target.value)}
          placeholder="Search vendors"
          className="h-11 w-[170px] bg-transparent text-[12px] outline-none placeholder:text-[var(--wl-mute)] max-md:w-full"
        />
      </label>
    </div>
  );
}
