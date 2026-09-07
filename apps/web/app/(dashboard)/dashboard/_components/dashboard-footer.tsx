export function DashboardFooter() {
  return (
    <section
      id="ledger"
      className="mt-14 flex flex-col justify-between gap-5 border-t border-[var(--wl-line)] pt-5 text-[11px] text-[var(--wl-secondary)] sm:flex-row"
    >
      <span className="font-mono uppercase tracking-[.14em]">Arc testnet · USDC</span>
      <span>Live record · governed spend settled onchain</span>
    </section>
  );
}
