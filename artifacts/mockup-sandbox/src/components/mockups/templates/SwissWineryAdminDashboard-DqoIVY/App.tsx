import { useState, useMemo } from 'react';
import { ArrowUpRight, ArrowDown, ArrowUp, X, Plus, Search } from 'lucide-react';

const TEAM = [
  { id: '01', name: 'Margaux Verrier', role: 'Maître de Chai', atelier: 'Vinification', origin: 'Beaune, FR', vintage: 1998, signature: 'Cuvée Ardente №7', status: 'Active', img: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop', bio: 'Third-generation cellar master. Margaux composes blends the way others compose music — by ear, by instinct, against the grain of convention.' },
  { id: '02', name: 'Elias Brandt', role: 'Head Distiller', atelier: 'Distillation', origin: 'Basel, CH', vintage: 2004, signature: 'Eau-de-Vie Solstice', status: 'Active', img: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop', bio: 'Trained in copper and patience. Elias runs the alembic stills on a lunar schedule he refuses to explain and no one dares to question.' },
  { id: '03', name: 'Soraya Klein', role: 'Blend Architect', atelier: 'Assemblage', origin: 'Vienna, AT', vintage: 2011, signature: 'Vermouth Carmin', status: 'Active', img: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&h=400&fit=crop', bio: 'Former perfumer. Soraya treats every blend as a fragrance with a finish — top notes, heart, and a long amber tail.' },
  { id: '04', name: 'Théo Lasserre', role: 'Vineyard Director', atelier: 'Vinification', origin: 'Banyuls, FR', vintage: 2007, signature: 'Parcelle 14 Rouge', status: 'Field', img: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=400&fit=crop', bio: 'Walks every row of every parcel twice a season. Believes terroir is a verb, not a noun.' },
  { id: '05', name: 'Imke Voss', role: 'Cooperage Lead', atelier: 'Élevage', origin: 'Bremen, DE', vintage: 2015, signature: 'Fût Cendré Series', status: 'Active', img: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop', bio: 'Toasts her own barrels over vine cuttings. The smoke profile of the Cendré series is hers alone — unrepeatable, unlicensed.' },
  { id: '06', name: 'Rafael Conti', role: 'Fermentation Scientist', atelier: 'Vinification', origin: 'Turin, IT', vintage: 2018, signature: 'Wild Ferment 03', status: 'Lab', img: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=400&fit=crop', bio: 'Cultivates a library of 212 indigenous yeast strains, each named after a jazz standard.' },
  { id: '07', name: 'Anouk Perrin', role: 'Cellar Operations', atelier: 'Élevage', origin: 'Sion, CH', vintage: 2012, signature: 'Réserve Souterraine', status: 'Active', img: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400&h=400&fit=crop', bio: 'Keeps 14,000 barrels in conversation with each other. Knows every stave by sound.' },
  { id: '08', name: 'Dario Maturana', role: 'Spirits Innovator', atelier: 'Distillation', origin: 'Mendoza, AR', vintage: 2019, signature: 'Amaro Cordillera', status: 'Lab', img: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=400&h=400&fit=crop', bio: 'Forages high-altitude botanicals at 3,000 metres. His amaro tastes like thin air and burnt orange.' },
  { id: '09', name: 'Lena Okafor', role: 'Quality Director', atelier: 'Assemblage', origin: 'Geneva, CH', vintage: 2009, signature: 'Standard Carmin Index', status: 'Active', img: 'https://images.unsplash.com/photo-1589571894960-20bbe2828d0a?w=400&h=400&fit=crop', bio: 'Wrote the 400-point sensory index the entire maison is judged against. Including herself.' },
  { id: '10', name: 'Pierre-Yves Roche', role: 'Archivist & Vault Keeper', atelier: 'Élevage', origin: 'Dijon, FR', vintage: 1991, signature: 'Bibliothèque 1947', status: 'Vault', img: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop', bio: 'Guardian of 9,400 library bottles dating to 1921. Has tasted every vintage. Remembers all of them.' },
];

const ATELIERS = ['All', 'Vinification', 'Distillation', 'Assemblage', 'Élevage'];

const STATUS_COLOR = {
  Active: '#8E1B2E',
  Field: '#D44324',
  Lab: '#DC7A1F',
  Vault: '#5A0F1E',
};

export default function App() {
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState('id');
  const [sortDir, setSortDir] = useState('asc');
  const [selected, setSelected] = useState(null);

  const rows = useMemo(() => {
    let r = TEAM.filter(t => (filter === 'All' || t.atelier === filter) &&
      (t.name + t.role + t.origin + t.signature).toLowerCase().includes(query.toLowerCase()));
    r.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return r;
  }, [filter, query, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sel = TEAM.find(t => t.id === selected);

  const SortHead = ({ label, k, className = '' }) => (
    <th className={`text-left font-semibold text-[10px] tracking-[0.14em] uppercase pb-3 cursor-pointer select-none group ${className}`}
        onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1 text-[#1A0E0C]">
        {label}
        {sortKey === k
          ? (sortDir === 'asc' ? <ArrowUp size={11} strokeWidth={2.5} className="text-[#8E1B2E]" /> : <ArrowDown size={11} strokeWidth={2.5} className="text-[#8E1B2E]" />)
          : <ArrowUp size={11} strokeWidth={2.5} className="opacity-0 group-hover:opacity-30 transition-opacity" />}
      </span>
    </th>
  );

  return (
    <div className="min-h-screen bg-[#F4EFE7] text-[#1A0E0C]" style={{ fontFamily: "'Inter', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: `
        * { -webkit-font-smoothing: antialiased; }
        ::selection { background: #8E1B2E; color: #F4EFE7; }
        .row-line { border-bottom: 1px solid rgba(26,14,12,0.14); }
        .hairline { border-color: rgba(26,14,12,0.18); }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: #F4EFE7; }
        ::-webkit-scrollbar-thumb { background: #8E1B2E; }
        @keyframes panelIn { from { opacity: 0; transform: translateX(16px); } to { opacity: 1; transform: translateX(0); } }
        .panel-in { animation: panelIn .28s cubic-bezier(.2,.8,.2,1) both; }
        input::placeholder { color: rgba(26,14,12,0.35); }
        .tabular { font-variant-numeric: tabular-nums; }
      `}} />

      <div className="flex min-h-screen">

        {/* ───────── SIDEBAR ───────── */}
        <aside className="w-[232px] shrink-0 border-r hairline flex flex-col justify-between sticky top-0 h-screen z-40 bg-[#F4EFE7]">
          <div>
            <div className="px-7 pt-8 pb-10">
              <div className="w-9 h-9 bg-[#8E1B2E] mb-5" />
              <div className="text-[15px] font-extrabold leading-[1.05] tracking-tight uppercase">
                Maison<br />Carmin
              </div>
              <div className="text-[10px] tracking-[0.18em] uppercase mt-2 text-[#8E1B2E] font-semibold">
                Vins &amp; Spiritueux
              </div>
            </div>

            <nav className="px-7">
              {[
                ['01', 'Overview', false],
                ['02', 'The Atelier', true],
                ['03', 'Cuvées', false],
                ['04', 'Distillates', false],
                ['05', 'Cellar Ledger', false],
                ['06', 'Provenance', false],
              ].map(([n, label, active]) => (
                <a key={n} href="#" onClick={e => e.preventDefault()}
                   className={`flex items-baseline gap-3 py-[9px] border-b hairline group ${active ? '' : 'opacity-60 hover:opacity-100'} transition-opacity`}>
                  <span className={`text-[10px] tabular font-semibold ${active ? 'text-[#D44324]' : ''}`}>{n}</span>
                  <span className={`text-[13px] ${active ? 'font-extrabold' : 'font-normal'}`}>{label}</span>
                  {active && <span className="ml-auto w-2 h-2 bg-[#8E1B2E]" />}
                </a>
              ))}
            </nav>
          </div>

          <div className="px-7 pb-7">
            <div className="border-t hairline pt-4 text-[10px] leading-[1.7] uppercase tracking-[0.12em]">
              <div className="font-semibold">Internal System v4.2</div>
              <div className="opacity-50">Banyuls — Basel — Turin</div>
              <div className="mt-3 flex items-center gap-2">
                <span className="w-[6px] h-[6px] rounded-full bg-[#DC7A1F]" />
                <span className="opacity-70">Harvest mode active</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ───────── MAIN ───────── */}
        <main className="flex-1 relative overflow-hidden">

          {/* Top bar */}
          <header className="flex items-center justify-between px-10 h-14 border-b hairline relative z-30 bg-[#F4EFE7]">
            <div className="text-[10px] tracking-[0.18em] uppercase font-semibold">
              02 / The Atelier — People Register
            </div>
            <div className="flex items-center gap-6 text-[10px] tracking-[0.14em] uppercase">
              <span className="opacity-60">Vintage 2024–25</span>
              <span className="font-semibold text-[#8E1B2E]">M. Verrier — Admin</span>
              <span className="w-7 h-7 bg-[#1A0E0C] text-[#F4EFE7] grid place-items-center font-extrabold text-[11px]">MV</span>
            </div>
          </header>

          {/* Title block — overlapped by stat band */}
          <section className="relative px-10 pt-12 pb-0">
            {/* layered color fields */}
            <div className="absolute right-0 top-0 w-[38%] h-[300px] bg-[#8E1B2E] z-0" />
            <div className="absolute right-[14%] top-[110px] w-[26%] h-[260px] bg-[#D44324] z-[1]" />
            <div className="absolute right-[6%] top-[200px] w-[140px] h-[140px] bg-[#DC7A1F] z-[2]" />

            <div className="relative z-10 max-w-[760px]">
              <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#8E1B2E] mb-4">
                Team / Company Introduction
              </p>
              <h1 className="text-[clamp(56px,7.5vw,104px)] leading-[0.88] font-extrabold tracking-[-0.03em] uppercase">
                The hands<br />behind the<br /><span className="text-[#8E1B2E]">house.</span>
              </h1>
              <p className="mt-6 max-w-[440px] text-[14px] leading-[1.65]">
                Forty-seven people. Four ateliers. One register. Every blend, barrel and
                bottle at Maison Carmin is signed by a person, not a process — this is
                the index of who they are and what they keep.
              </p>
            </div>

            {/* Photo card overlapping title and stat band */}
            <div className="hidden xl:block absolute right-[64px] top-[64px] w-[300px] z-20">
              <img src="https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=600&h=720&fit=crop"
                   alt="Cellar" className="w-full h-[340px] object-cover" />
              <div className="bg-[#1A0E0C] text-[#F4EFE7] px-5 py-4 flex items-center justify-between">
                <div>
                  <div className="text-[10px] tracking-[0.16em] uppercase opacity-60">Cave Souterraine</div>
                  <div className="text-[13px] font-semibold mt-0.5">Banyuls-sur-Mer, Cellar 03</div>
                </div>
                <ArrowUpRight size={18} className="text-[#DC7A1F]" />
              </div>
            </div>

            {/* Stat band — overlaps upward */}
            <div className="relative z-10 mt-14 -mb-px grid grid-cols-2 md:grid-cols-4 bg-[#1A0E0C] text-[#F4EFE7]">
              {[
                ['47', 'People in register', '+3 this vintage'],
                ['04', 'Ateliers', 'Vinification → Élevage'],
                ['1921', 'Oldest vault vintage', 'Bibliothèque cellar'],
                ['212', 'Yeast strains archived', 'Wild Ferment lab'],
              ].map(([num, label, sub], i) => (
                <div key={label} className={`px-7 py-7 ${i !== 0 ? 'border-l border-[#F4EFE7]/15' : ''}`}>
                  <div className="text-[40px] font-extrabold leading-none tabular tracking-tight">{num}</div>
                  <div className="text-[11px] uppercase tracking-[0.14em] font-semibold mt-3">{label}</div>
                  <div className="text-[10px] uppercase tracking-[0.12em] mt-1 text-[#DC7A1F]">{sub}</div>
                </div>
              ))}
            </div>
          </section>

          {/* ───────── TABLE SECTION ───────── */}
          <section className="relative px-10 pt-10 pb-20">
            {/* gigantic index numeral behind table */}
            <div className="absolute -right-6 top-2 text-[280px] leading-none font-extrabold text-[#D44324]/12 select-none z-0 tabular tracking-tighter">
              {String(rows.length).padStart(2, '0')}
            </div>

            {/* Controls */}
            <div className="relative z-10 flex flex-wrap items-end justify-between gap-6 mb-6">
              <div>
                <div className="text-[10px] tracking-[0.2em] uppercase font-semibold text-[#8E1B2E] mb-2">Filter by atelier</div>
                <div className="flex">
                  {ATELIERS.map(a => (
                    <button key={a} onClick={() => setFilter(a)}
                      className={`px-4 py-2 text-[12px] uppercase tracking-[0.08em] border hairline -ml-px first:ml-0 transition-colors
                        ${filter === a ? 'bg-[#8E1B2E] border-[#8E1B2E] text-[#F4EFE7] font-semibold relative z-10' : 'bg-transparent hover:bg-[#1A0E0C]/5 font-normal'}`}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 border-b border-[#1A0E0C] pb-1.5 w-[240px]">
                  <Search size={14} strokeWidth={2.5} className="opacity-50" />
                  <input value={query} onChange={e => setQuery(e.target.value)}
                    placeholder="Search name, role, signature…"
                    className="bg-transparent outline-none text-[13px] w-full" />
                </div>
                <button className="flex items-center gap-2 bg-[#1A0E0C] text-[#F4EFE7] px-4 py-2.5 text-[11px] uppercase tracking-[0.12em] font-semibold hover:bg-[#8E1B2E] transition-colors">
                  <Plus size={13} strokeWidth={2.5} /> Add member
                </button>
              </div>
            </div>

            {/* Table card */}
            <div className="relative z-10 bg-[#FBF8F2] border hairline" style={{ boxShadow: '12px 12px 0 0 rgba(142,27,46,0.12)' }}>
              <div className="flex items-center justify-between px-7 pt-5 pb-1">
                <div className="text-[11px] uppercase tracking-[0.16em] font-semibold">People Register — {filter}</div>
                <div className="text-[11px] tabular opacity-60">{rows.length} of {TEAM.length} records</div>
              </div>

              <div className="px-7 pb-7 overflow-x-auto">
                <table className="w-full border-collapse min-w-[860px]">
                  <thead>
                    <tr className="border-b-2 border-[#1A0E0C]">
                      <th className="text-left font-semibold text-[10px] tracking-[0.14em] uppercase pb-3 w-[48px]">№</th>
                      <SortHead label="Name" k="name" className="w-[220px]" />
                      <SortHead label="Role" k="role" />
                      <SortHead label="Atelier" k="atelier" className="w-[130px]" />
                      <SortHead label="Origin" k="origin" className="w-[120px]" />
                      <SortHead label="Vintage" k="vintage" className="w-[90px]" />
                      <th className="text-left font-semibold text-[10px] tracking-[0.14em] uppercase pb-3">Signature work</th>
                      <th className="text-left font-semibold text-[10px] tracking-[0.14em] uppercase pb-3 w-[90px]">Status</th>
                      <th className="w-[40px]" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(t => {
                      const active = selected === t.id;
                      return (
                        <tr key={t.id} onClick={() => setSelected(active ? null : t.id)}
                            className={`row-line cursor-pointer transition-colors group ${active ? 'bg-[#8E1B2E]/[0.06]' : 'hover:bg-[#1A0E0C]/[0.035]'}`}>
                          <td className="py-[14px] text-[12px] tabular font-semibold text-[#8E1B2E]">{t.id}</td>
                          <td className="py-[14px] pr-4">
                            <div className="flex items-center gap-3">
                              <img src={t.img} alt={t.name} className="w-8 h-8 object-cover grayscale group-hover:grayscale-0 transition-all" />
                              <span className="text-[13px] font-extrabold tracking-tight">{t.name}</span>
                            </div>
                          </td>
                          <td className="py-[14px] pr-4 text-[13px]">{t.role}</td>
                          <td className="py-[14px] pr-4">
                            <span className="text-[11px] uppercase tracking-[0.08em] font-semibold border-b-2 pb-px"
                                  style={{ borderColor: STATUS_COLOR[t.status] || '#8E1B2E' }}>
                              {t.atelier}
                            </span>
                          </td>
                          <td className="py-[14px] pr-4 text-[13px] opacity-70">{t.origin}</td>
                          <td className="py-[14px] pr-4 text-[13px] tabular font-semibold">{t.vintage}</td>
                          <td className="py-[14px] pr-4 text-[13px] italic-none">{t.signature}</td>
                          <td className="py-[14px] pr-2">
                            <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em]">
                              <span className="w-[7px] h-[7px]" style={{ background: STATUS_COLOR[t.status] }} />
                              {t.status}
                            </span>
                          </td>
                          <td className="py-[14px] text-right">
                            <ArrowUpRight size={15} strokeWidth={2.5}
                              className={`transition-all ${active ? 'text-[#8E1B2E]' : 'opacity-0 group-hover:opacity-60'}`} />
                          </td>
                        </tr>
                      );
                    })}
                    {rows.length === 0 && (
                      <tr><td colSpan={9} className="py-14 text-center text-[13px] opacity-50">No records match this filter.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between px-7 py-4 border-t hairline text-[10px] uppercase tracking-[0.14em]">
                <span className="opacity-60">Register maintained by Quality Direction · Updated 14 Mar 2025</span>
                <div className="flex items-center gap-5">
                  <span className="font-semibold">Page 1 / 5</span>
                  <div className="flex gap-1">
                    {[0,1,2,3,4].map(i => <span key={i} className={`w-5 h-[3px] ${i===0?'bg-[#8E1B2E]':'bg-[#1A0E0C]/20'}`} />)}
                  </div>
                </div>
              </div>
            </div>

            {/* ───── Detail panel (overlapping, z-50) ───── */}
            {sel && (
              <div className="panel-in fixed xl:absolute right-6 xl:right-16 top-24 xl:top-[120px] w-[340px] z-50 bg-[#1A0E0C] text-[#F4EFE7]"
                   style={{ boxShadow: '-14px 14px 0 0 #D44324' }}>
                <div className="flex items-center justify-between px-6 pt-5">
                  <span className="text-[10px] tracking-[0.2em] uppercase text-[#DC7A1F] font-semibold">Dossier {sel.id} / 47</span>
                  <button onClick={() => setSelected(null)} className="hover:text-[#D44324] transition-colors"><X size={16} /></button>
                </div>
                <div className="px-6 pt-4">
                  <img src={sel.img} alt={sel.name} className="w-full h-[180px] object-cover" />
                </div>
                <div className="px-6 pt-5 pb-6">
                  <h3 className="text-[24px] font-extrabold leading-[1.02] tracking-tight uppercase">{sel.name}</h3>
                  <div className="text-[11px] uppercase tracking-[0.14em] text-[#DC7A1F] font-semibold mt-1.5">{sel.role} — {sel.atelier}</div>
                  <p className="text-[12.5px] leading-[1.7] mt-4 opacity-85">{sel.bio}</p>
                  <div className="grid grid-cols-2 gap-px bg-[#F4EFE7]/15 mt-5 border border-[#F4EFE7]/15">
                    {[['Vintage joined', sel.vintage], ['Origin', sel.origin], ['Signature', sel.signature], ['Status', sel.status]].map(([k, v]) => (
                      <div key={k} className="bg-[#1A0E0C] px-3 py-3">
                        <div className="text-[9px] uppercase tracking-[0.16em] opacity-50">{k}</div>
                        <div className="text-[12px] font-semibold mt-1">{v}</div>
                      </div>
                    ))}
                  </div>
                  <button className="w-full mt-5 bg-[#8E1B2E] hover:bg-[#D44324] transition-colors text-[#F4EFE7] py-3 text-[11px] uppercase tracking-[0.16em] font-semibold flex items-center justify-center gap-2">
                    Open full dossier <ArrowUpRight size={14} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* footer rule */}
          <footer className="px-10 pb-8 -mt-8 relative z-10 flex items-center justify-between text-[10px] uppercase tracking-[0.16em]">
            <span className="font-semibold">Maison Carmin — Internal Register</span>
            <span className="opacity-50">Confidential · Do not distribute outside the house</span>
          </footer>
        </main>
      </div>
    </div>
  );
}