import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Header } from "./_shared/Header";

type VendorState = "APPROVED" | "BLOCKED";
type Category = "API" | "COMPUTE" | "DATA" | "ARCANEVM";
type Vendor = { name: string; address: string; category: Category; cap: string; approvedBy: string; date: string; volume: string; state: VendorState; used: number; txs: string[] };

const navItems = ["DASHBOARD", "AGENTS", "VENDORS", "LEDGER", "ESCALATIONS", "ANOMALIES"];
const categories = ["ALL", "API", "COMPUTE", "DATA", "ARCANEVM"];
const initialVendors: Vendor[] = [
  { name: "AWS", address: "0x3f…9a2c", category: "COMPUTE", cap: "$2,500 / mo", approvedBy: "Mira Chen", date: "12 Jun 25", volume: "$1,842.20", state: "APPROVED", used: 61, txs: ["$184.20 · procurement-bot · 09:41", "$316.40 · research-bot · 08:16", "$740.00 · support-agent · 06:52"] },
  { name: "OpenAI", address: "0x71…4be1", category: "API", cap: "$1,200 / mo", approvedBy: "Nikhil Rao", date: "08 Jun 25", volume: "$740.00", state: "APPROVED", used: 42, txs: ["$740.00 · support-agent · 09:41", "$96.20 · research-bot · 07:34"] },
  { name: "Anthropic", address: "0xa8…c912", category: "API", cap: "$3,000 / mo", approvedBy: "Mira Chen", date: "02 Jun 25", volume: "$2,100.00", state: "APPROVED", used: 70, txs: ["$2,100.00 · growth-bot · 09:18", "$184.20 · support-agent · 08:44"] },
  { name: "Qdrant Cloud", address: "0xc2…ff18", category: "DATA", cap: "$500 / mo", approvedBy: "Jon Bell", date: "28 May 25", volume: "$96.20", state: "APPROVED", used: 19, txs: ["$96.20 · research-bot · 09:31"] },
  { name: "AWS Bedrock", address: "0xb4…11d0", category: "ARCANEVM", cap: "$800 / mo", approvedBy: "System", date: "14 Apr 25", volume: "$0.00", state: "BLOCKED", used: 0, txs: ["No recent transactions"] },
];

function StatePill({ state }: { state: VendorState }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[9px] tracking-[.12em] ${state === "BLOCKED" ? "bg-[#292522] text-[#faf6f1]" : "bg-[#e7f0e5] text-[#3f653e]"}`}>{state}</span>;
}

function AppShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] bg-[#faf6f1] text-[#292522]" style={{ fontFamily: "'Inter Tight', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Inter+Tight:wght@400;500;600;700&display=swap');
        .font-mono{font-family:'DM Mono',monospace}
        .warm-pill{position:relative;isolation:isolate;overflow:hidden;box-shadow:0 1px 2px rgba(41,37,34,.06);transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 320ms cubic-bezier(.16,1,.3,1),color 220ms ease,border-color 220ms ease}
        .warm-pill::before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:#d63200;transform:translateY(102%);transition:transform 320ms cubic-bezier(.16,1,.3,1)}
        .warm-pill:hover{box-shadow:0 10px 28px -8px rgba(255,60,0,.32),0 2px 6px rgba(41,37,34,.08);transform:translateY(-1px)}
        .warm-pill:hover::before{transform:translateY(0)}
        .warm-pill-ghost::before{background:#292522}.warm-pill-ghost:hover{color:#faf6f1;border-color:#292522}
        .vendor-row{animation:vendorIn 420ms cubic-bezier(.16,1,.3,1) both;animation-delay:calc(var(--row) * 80ms);transition:transform 220ms cubic-bezier(.16,1,.3,1),box-shadow 220ms ease}
        .vendor-row:hover{transform:translate3d(3px,-2px,0);box-shadow:inset 2px 0 0 #ff3c00}
        @keyframes vendorIn{from{opacity:0;transform:translateY(9px)}to{opacity:1;transform:translateY(0)}}
        @media (prefers-reduced-motion:reduce){.warm-pill,.warm-pill::before,.vendor-row{animation:none;transition:none}.warm-pill:hover,.vendor-row:hover{transform:none}}
      `}</style>
      <Header active="VENDORS" /><header className="hidden flex min-h-[68px] flex-wrap items-center justify-between gap-4 border-b border-[#ded7d0] px-5 py-4 sm:h-[68px] sm:flex-nowrap sm:px-8 sm:py-0">
        <div className="flex min-w-0 items-center gap-7">
          <a href="/__mockup/preview/arcanum-app/Vendors" className="shrink-0 text-[18px] font-bold tracking-[-.06em]">ARCANUM<span className="text-[#ff3c00]">.</span></a>
          <nav className="flex min-w-0 gap-4 overflow-x-auto pb-0.5 sm:gap-5">
            {navItems.map((item) => {
              const active = item === "VENDORS";
              return <a key={item} href={`/__mockup/preview/arcanum-app/${item[0] + item.slice(1).toLowerCase()}`} className={`whitespace-nowrap text-[11px] font-medium tracking-[-.01em] transition-colors duration-[220ms] ${active ? "border-b-2 border-[#ff3c00] pb-[6px] text-[#292522]" : "text-[#655d56] hover:text-[#292522]"}`}>{item}</a>;
            })}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-4"><span className="hidden font-mono text-[9px] tracking-[.14em] text-[#9b9289] sm:inline">ARC TESTNET</span><div className="flex items-center gap-2 rounded-full border border-[#ded7d0] px-3 py-1.5"><span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#292522] font-mono text-[9px] text-[#faf6f1]">HD</span><span className="text-[12px] font-medium">HELIX-DAO</span></div></div>
      </header>
      <div className="mx-auto max-w-[1400px] px-5 py-8 sm:px-8 sm:py-10">{children}</div>
    </main>
  );
}

export function Vendors() {
  const [vendors, setVendors] = useState(initialVendors);
  const [selectedName, setSelectedNameRaw] = useState("AWS");
  const setSelectedName = (name: string) => { setSelectedNameRaw(name); setCapEditing(false); };
  const [category, setCategory] = useState("ALL");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [notice, setNotice] = useState("ALLOWLIST / 30 DAY WINDOW");
  const [newName, setNewName] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const [capEditing, setCapEditing] = useState(false);
  const [capValue, setCapValue] = useState("");
  useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && setMenu(null);
    const closeOutside = (event: PointerEvent) => {
      if (!(event.target as HTMLElement).closest?.("[data-vendor-menu]")) setMenu(null);
    };
    window.addEventListener("keydown", close);
    window.addEventListener("pointerdown", closeOutside);
    return () => {
      window.removeEventListener("keydown", close);
      window.removeEventListener("pointerdown", closeOutside);
    };
  }, []);
  const selected = vendors.find((vendor) => vendor.name === selectedName) ?? vendors[0];
  const visible = useMemo(() => vendors.filter((vendor) => (category === "ALL" || vendor.category === category) && `${vendor.name} ${vendor.address}`.toLowerCase().includes(query.toLowerCase())), [vendors, category, query]);

  const addVendor = () => {
    const cleanName = newName.trim();
    if (!cleanName) return;
    const added: Vendor = { name: cleanName, address: "0xd7…8e40", category: "API", cap: "$500 / mo", approvedBy: "Helix-DAO", date: "Today", volume: "$0.00", state: "APPROVED", used: 0, txs: ["No recent transactions"] };
    setVendors((items) => [...items, added]);
    setSelectedName(cleanName);
    setNewName("");
    setShowAdd(false);
    setNotice(`${cleanName.toUpperCase()} ADDED · APPROVAL RECORDED`);
  };

  const blockSelected = () => {
    if (!selected) return;
    setVendors((items) => items.map((vendor) => vendor.name === selected.name ? { ...vendor, state: "BLOCKED" } : vendor));
    setNotice(`${selected.name.toUpperCase()} BLOCKED · NEW TRANSACTIONS WILL REJECT`);
  };

  return (
    <AppShell>
      <section className="flex flex-col justify-between gap-6 border-b border-[#ded7d0] pb-8 sm:flex-row sm:items-end">
        <div><p className="font-mono text-[10px] uppercase tracking-[.19em] text-[#ff3c00]">COUNTERPARTIES / ALLOWLIST</p><h1 className="mt-4 text-[clamp(3.2rem,6vw,5.8rem)] font-semibold leading-[.88] tracking-[-.09em]">Vendors</h1><p className="mt-5 max-w-[480px] text-[14px] leading-[1.45] text-[#776f68]">The counterparties your agents can pay, with a cap and an accountable name attached.</p></div>
        <button type="button" onClick={() => setShowAdd(true)} className="warm-pill w-fit rounded-full bg-[#ff3c00] px-5 py-3 text-[11px] font-semibold text-[#faf6f1]">Add vendor <span className="ml-2 text-base leading-none">+</span></button>
      </section>

      <section className="mt-8 grid grid-cols-3 divide-x divide-[#ded7d0] border border-[#ded7d0] bg-[#f5f0ea]">
        <div className="p-5 sm:p-7"><span className="font-mono text-[9px] tracking-[.15em] text-[#837a72]">APPROVED</span><strong className="mt-6 block text-4xl font-semibold tracking-[-.08em]">8</strong><span className="mt-2 block font-mono text-[9px] text-[#9b9289]">COUNTERPARTIES</span></div>
        <div className="p-5 sm:p-7"><span className="font-mono text-[9px] tracking-[.15em] text-[#837a72]">CATEGORIES</span><strong className="mt-6 block text-4xl font-semibold tracking-[-.08em]">4</strong><span className="mt-2 block font-mono text-[9px] text-[#9b9289]">ACTIVE GROUPS</span></div>
        <div className="p-5 sm:p-7"><span className="font-mono text-[9px] tracking-[.15em] text-[#837a72]">BLOCKED</span><strong className="mt-6 block text-4xl font-semibold tracking-[-.08em] text-[#ff3c00]">2</strong><span className="mt-2 block font-mono text-[9px] text-[#9b9289]">COUNTERPARTIES</span></div>
      </section>

      <section className="mt-14">
        <div className="flex flex-col justify-between gap-4 border-b border-[#292522] pb-4 lg:flex-row lg:items-end"><div><p className="font-mono text-[10px] uppercase tracking-[.18em] text-[#ff3c00]">REGISTRY / GOVERNED</p><h2 className="mt-3 text-2xl font-semibold tracking-[-.06em]">Vendor registry</h2></div><span className="font-mono text-[9px] tracking-[.12em] text-[#9b9289]">{notice}</span></div>
        <div className="flex flex-col justify-between gap-4 border-b border-[#ded7d0] py-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2">{categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`rounded-full px-3 py-1.5 font-mono text-[9px] tracking-[.13em] transition-colors duration-[220ms] ${category === item ? "bg-[#292522] text-[#faf6f1]" : "border border-[#ded7d0] text-[#776f68] hover:border-[#292522] hover:text-[#292522]"}`}>{item}</button>)}</div>
          <label className="flex items-center gap-2 border-b border-[#ded7d0] pb-1 text-[#837a72]"><span className="font-mono text-[10px]">⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search vendors" className="w-[170px] bg-transparent text-[12px] outline-none placeholder:text-[#9b9289]" /></label>
        </div>
        <div className="hidden grid-cols-[1.1fr_.7fr_1fr_1.2fr_.8fr_.65fr] gap-4 border-b border-[#ded7d0] px-4 py-3 font-mono text-[9px] uppercase tracking-[.14em] text-[#9b9289] lg:grid"><span>Vendor</span><span>Category</span><span>Per-vendor cap</span><span>Approved by</span><span>30d volume</span><span>State</span></div>
        <div className="divide-y divide-[#e3dcd5] border-b border-[#ded7d0]">
          {visible.map((vendor, index) => (
             <div key={vendor.name} onClick={() => { setSelectedName(vendor.name); setNotice(`${vendor.name.toUpperCase()} SELECTED · DETAIL RAIL READY`); }} onKeyDown={(event) => event.key === "Enter" && setSelectedName(vendor.name)} role="button" tabIndex={0} style={{ "--row": index } as CSSProperties} className={`vendor-row relative grid w-full gap-3 px-4 py-5 text-left lg:grid-cols-[1.1fr_.7fr_1fr_1.2fr_.8fr_.65fr] lg:items-center ${selected?.name === vendor.name ? "bg-[#f5f0ea]" : ""}`}>
              <span><strong className="block text-[13px] font-medium">{vendor.name}</strong><small className="mt-1 block font-mono text-[9px] text-[#9b9289]">{vendor.address}</small></span>
              <span className="w-fit rounded-full border border-[#ded7d0] px-2.5 py-1 font-mono text-[9px] tracking-[.1em] text-[#655d56]">{vendor.category}</span>
              <span className="font-mono text-[11px] tabular-nums text-[#655d56]">{vendor.cap}</span>
              <span><span className="block text-[12px]">{vendor.approvedBy}</span><small className="mt-1 block font-mono text-[9px] text-[#9b9289]">{vendor.date}</small></span>
              <span className="font-mono text-[11px] tabular-nums">{vendor.volume}</span>
               <span className="flex items-center justify-between gap-3"><StatePill state={vendor.state} /><span data-vendor-menu className="relative" onClick={(event) => event.stopPropagation()}><button type="button" aria-label={`Actions for ${vendor.name}`} aria-expanded={menu === vendor.name} onClick={() => setMenu(menu === vendor.name ? null : vendor.name)} className="flex h-7 w-7 items-center justify-center font-mono text-[16px] text-[#837a72] transition-colors hover:text-[#ff3c00]">⋯</button>{menu === vendor.name && <div role="menu" className="absolute right-0 top-8 z-20 w-[190px] border border-[#cfc5bc] bg-[#fbf8f4] p-1 shadow-[8px_10px_0_#e7e0d9]"><button type="button" onClick={() => { navigator.clipboard?.writeText(vendor.address); setNotice(`${vendor.name.toUpperCase()} ADDRESS COPIED`); setMenu(null); }} className="block w-full px-3 py-2 text-left font-mono text-[9px] hover:bg-[#f5f0ea]">COPY ADDRESS</button><button type="button" onClick={() => { setNotice(`${vendor.name.toUpperCase()} OPENED ON ARCscan`); setMenu(null); }} className="block w-full px-3 py-2 text-left font-mono text-[9px] hover:bg-[#f5f0ea]">VIEW ON ARCSCAN</button><button type="button" onClick={() => { setVendors((items) => items.map((item) => item.name === vendor.name ? { ...item, state: "BLOCKED" } : item)); setNotice(`${vendor.name.toUpperCase()} BLOCKED · CONFIRMATION RECORDED`); setMenu(null); }} className="block w-full px-3 py-2 text-left font-mono text-[9px] text-[#ff3c00] hover:bg-[#f5f0ea]">BLOCK VENDOR</button><button type="button" onClick={() => { setVendors((items) => items.filter((item) => item.name !== vendor.name)); setNotice(`${vendor.name.toUpperCase()} REMOVED FROM ALLOWLIST`); setMenu(null); }} className="block w-full px-3 py-2 text-left font-mono text-[9px] text-[#ff3c00] hover:bg-[#f5f0ea]">REMOVE VENDOR</button></div>}</span></span>
             </div>
          ))}
          <button type="button" onClick={() => setShowAdd(true)} className="flex w-full items-center gap-3 border border-dashed border-[#ded7d0] px-4 py-5 text-left text-[#837a72] transition-colors duration-[220ms] hover:border-[#ff3c00] hover:text-[#ff3c00]"><span className="font-mono text-[13px]">+</span><span className="font-mono text-[10px] uppercase tracking-[.14em]">Add vendor to allowlist</span><span className="ml-auto font-mono text-[9px]">SIGNED APPROVAL REQUIRED</span></button>
        </div>
      </section>

      {selected && <aside className="mt-8 grid gap-7 border-t-2 border-[#292522] bg-[#f5f0ea] p-6 sm:p-8 lg:grid-cols-[.7fr_1.3fr]">
        <div><div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.17em] text-[#ff3c00]">SELECTED / COUNTERPARTY</p><h3 className="mt-4 text-3xl font-semibold tracking-[-.07em]">{selected.name}</h3><p className="mt-2 font-mono text-[10px] text-[#837a72]">{selected.address} · {selected.category}</p></div><StatePill state={selected.state} /></div>
          <div className="mt-10"><div className="flex justify-between font-mono text-[9px] uppercase tracking-[.13em] text-[#837a72]"><span>CAP USAGE / MONTH</span><span>{selected.used}%</span></div><div className="mt-3 h-1.5 bg-[#ded7d0]"><span className="block h-full bg-[#292522]" style={{ width: `${selected.used}%` }} /></div><div className="mt-3 flex justify-between font-mono text-[9px] text-[#9b9289]"><span>{selected.volume} used</span><span>{selected.cap} limit</span></div></div>
          <div className="mt-8 flex flex-wrap gap-3"><button type="button" onClick={() => { setCapValue(selected.cap.replace(/[^0-9]/g, "")); setCapEditing((value) => !value); }} className="warm-pill warm-pill-ghost rounded-full border border-[#ded7d0] px-4 py-2.5 font-mono text-[9px] tracking-[.1em]">Update cap</button><button type="button" onClick={blockSelected} className="rounded-full border border-[#ff3c00] px-4 py-2.5 font-mono text-[9px] tracking-[.1em] text-[#ff3c00] transition-transform duration-[220ms] hover:-translate-y-0.5">Block vendor</button></div>
          {capEditing && <form className="mt-4 border-l-2 border-[#ff3c00] bg-[#f5f0ea] p-4" onSubmit={(event) => {
            event.preventDefault();
            const amount = Number(capValue);
            if (!amount || amount <= 0) { setNotice("ENTER A VALID MONTHLY CAP"); return; }
            const formatted = `$${amount.toLocaleString("en-US")} / mo`;
            setVendors((items) => items.map((item) => item.name === selected.name ? { ...item, cap: formatted } : item));
            setNotice(`${selected.name.toUpperCase()} CAP REVISED TO ${formatted.toUpperCase()} · SIGNED BY OPERATOR`);
            setCapEditing(false);
          }}>
            <p className="font-mono text-[9px] uppercase tracking-[.14em] text-[#ff3c00]">REVISE MONTHLY CAP / {selected.name.toUpperCase()}</p>
            <div className="mt-3 flex items-center gap-2">
              <span className="font-mono text-[13px] text-[#837a72]">$</span>
              <input autoFocus inputMode="numeric" value={capValue} onChange={(event) => setCapValue(event.target.value.replace(/[^0-9]/g, ""))} placeholder="2500" className="w-[110px] border-b border-[#bdb4aa] bg-transparent py-1 font-mono text-[13px] outline-none focus:border-[#ff3c00]" />
              <span className="font-mono text-[10px] text-[#9b9289]">/ MO · USDC</span>
              <button type="submit" className="warm-pill ml-2 rounded-full bg-[#ff3c00] px-4 py-2 font-mono text-[9px] tracking-[.1em] text-white">SIGN &amp; APPLY</button>
              <button type="button" onClick={() => setCapEditing(false)} className="font-mono text-[9px] tracking-[.1em] text-[#837a72] hover:text-[#292522]">CANCEL</button>
            </div>
            <p className="mt-2 font-mono text-[8.5px] tracking-[.08em] text-[#9b9289]">CURRENT {selected.cap.toUpperCase()} · TAKES EFFECT NEXT SETTLEMENT WINDOW</p>
          </form>}
        </div>
        <div><div className="flex items-center justify-between border-b border-[#ded7d0] pb-4"><span className="font-mono text-[10px] uppercase tracking-[.16em] text-[#837a72]">Recent transactions</span><span className="font-mono text-[9px] text-[#9b9289]">30D / {selected.volume}</span></div><div className="divide-y divide-[#ded7d0]">{selected.txs.map((tx, index) => <div key={`${tx}-${index}`} className="flex items-center justify-between gap-4 py-4"><span className="text-[12px] text-[#655d56]">{tx.split(" · ").slice(1).join(" · ")}</span><span className="font-mono text-[11px] tabular-nums">{tx.split(" · ")[0]}</span></div>)}</div><p className="mt-8 max-w-[390px] font-mono text-[9px] leading-[1.6] tracking-[.08em] text-[#9b9289]">Every payment is evaluated against this cap before it reaches the governed wallet.</p></div>
      </aside>}

      {showAdd && <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#292522]/10 p-5 sm:items-center" role="dialog" aria-modal="true" onClick={() => setShowAdd(false)} onKeyDown={(event) => event.key === "Escape" && setShowAdd(false)}><div className="w-full max-w-[440px] border border-[#ded7d0] bg-[#faf6f1] p-7 shadow-[12px_14px_0_#e7e0d9]" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between"><div><p className="font-mono text-[10px] uppercase tracking-[.17em] text-[#ff3c00]">ALLOWLIST / NEW</p><h3 className="mt-3 text-2xl font-semibold tracking-[-.06em]">Add vendor</h3></div><button type="button" onClick={() => setShowAdd(false)} className="font-mono text-[11px] text-[#837a72] hover:text-[#292522]">CLOSE</button></div><label className="mt-8 block"><span className="font-mono text-[9px] uppercase tracking-[.14em] text-[#837a72]">Vendor name</span><input autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && addVendor()} placeholder="e.g. Mistral" className="mt-2 w-full border-b border-[#292522] bg-transparent py-3 text-[15px] outline-none placeholder:text-[#9b9289]" /></label><p className="mt-5 font-mono text-[9px] leading-[1.5] tracking-[.08em] text-[#9b9289]">New vendors enter with a $500 / month cap and require operator approval before first payment.</p><div className="mt-7 flex justify-end gap-3"><button type="button" onClick={() => setShowAdd(false)} className="warm-pill warm-pill-ghost rounded-full border border-[#ded7d0] px-4 py-2.5 font-mono text-[9px] tracking-[.1em]">Cancel</button><button type="button" onClick={addVendor} className="warm-pill rounded-full bg-[#ff3c00] px-4 py-2.5 font-mono text-[9px] tracking-[.1em] text-[#faf6f1]">Create vendor</button></div></div></div>}
    </AppShell>
  );
}