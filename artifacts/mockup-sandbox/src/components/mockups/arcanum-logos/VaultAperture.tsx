import React from "react";

const INK = "#292522";
const PAPER = "#faf6f1";
const SIGNAL = "#ff3c00";
const MUTED = "#9b9289";
const HAIR = "#ded7d0";

function VaultMark({ reversed = false, size = 236 }: { reversed?: boolean; size?: number }) {
  const ink = reversed ? PAPER : INK;
  const blades = Array.from({ length: 40 }, (_, i) => i);
  const rings = [101, 96, 91, 84, 77];
  return (
    <svg width={size} height={size} viewBox="0 0 240 240" role="img" aria-label="Vault aperture mark">
      <g fill="none" stroke={ink} strokeLinecap="round">
        <circle cx="120" cy="120" r="103" strokeWidth=".95" />
        <circle cx="120" cy="120" r="100" strokeWidth=".45" />
        {rings.map((r, i) => <circle key={r} cx="120" cy="120" r={r} strokeWidth={i === 0 ? ".9" : ".5"} />)}
        {blades.map((i) => {
          const a = i * 9 * Math.PI / 180;
          const twist = (i % 2 ? -1 : 1) * .1;
          const outer = 93;
          const inner = i % 2 ? 27 : 43;
          const x1 = 120 + Math.cos(a) * outer;
          const y1 = 120 + Math.sin(a) * outer;
          const x2 = 120 + Math.cos(a + twist) * inner;
          const y2 = 120 + Math.sin(a + twist) * inner;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={i % 5 === 0 ? ".95" : ".52"} />;
        })}
        <path d="M120 91 L103 145 L111 145 L115 132 L125 132 L129 145 L137 145 Z" strokeWidth="1.05" fill={reversed ? PAPER : "none"} />
        <path d="M115 126 Q120 119 125 126" strokeWidth=".75" />
        <path d="M120 17v8 M120 215v8 M17 120h8 M215 120h8" strokeWidth="1" />
      </g>
      {!reversed && <circle cx="120" cy="17" r="2.35" fill={SIGNAL} />}
    </svg>
  );
}

function Wordmark({ reversed = false, compact = false }: { reversed?: boolean; compact?: boolean }) {
  return <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: compact ? 22 : 29, letterSpacing: compact ? ".08em" : ".115em", lineHeight: 1, color: reversed ? PAPER : INK, fontWeight: 500 }}>
    ARCANUM<span style={{ color: SIGNAL, letterSpacing: 0 }}>.</span>
  </div>;
}

export default function VaultAperture() {
  return (
    <main style={{ minHeight: "100vh", width: "100%", background: PAPER, color: INK, boxSizing: "border-box", padding: 20, fontFamily: "'Schibsted Grotesk', sans-serif" }}>
      <style>{`*{box-sizing:border-box} .va-frame{min-height:calc(100vh - 40px);border:1px solid ${HAIR};display:flex;flex-direction:column;padding:0 22px} .va-mono{font-family:'IBM Plex Mono','DM Mono',monospace;letter-spacing:.14em;text-transform:uppercase} .va-header{height:55px;display:flex;align-items:center;justify-content:space-between;font-size:10px;color:#837a72;white-space:nowrap} .va-hero{flex:1;min-height:350px;display:flex;align-items:center;justify-content:center;padding:14px 0 20px} .va-lockup{height:80px;display:flex;align-items:center;justify-content:center;gap:18px;border-bottom:1px solid ${HAIR}} .va-band{height:142px;display:grid;grid-template-columns:1.2fr .8fr 1fr}.va-tile{min-width:0;padding:17px 14px 12px;display:flex;flex-direction:column;justify-content:space-between;border-left:1px solid ${HAIR}}.va-tile:first-child{border-left:0;padding-left:0}.va-dark{background:${INK};padding:11px 14px}.va-caption{font-family:'IBM Plex Mono','DM Mono',monospace;font-size:9px;letter-spacing:.13em;color:${MUTED};text-transform:uppercase}.va-dark .va-caption{color:#9b9289}.va-word-only{display:flex;align-items:center;justify-content:flex-end;height:100%}@media(max-width:520px){.va-frame{padding:0 14px}.va-header{font-size:8px}.va-hero{min-height:300px}.va-lockup{gap:10px}.va-band{height:130px}.va-tile{padding-left:8px;padding-right:8px}}`}</style>
      <section className="va-frame">
        <header className="va-header va-mono"><span>ARCANUM — LOGO STUDY 02/08</span><span>VAULT APERTURE</span></header>
        <div className="va-hero"><VaultMark size={290} /></div>
        <div className="va-lockup"><VaultMark size={58} /><Wordmark /></div>
        <div className="va-band">
          <div className="va-tile va-dark"><div style={{ display: "flex", alignItems: "center", gap: 9 }}><VaultMark reversed size={58} /><Wordmark reversed compact /></div><span className="va-caption">Reverse / certificate ink</span></div>
          <div className="va-tile"><div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}><VaultMark size={24} /></div><span className="va-caption">24 PX</span></div>
          <div className="va-tile"><div className="va-word-only"><Wordmark compact /></div><span className="va-caption" style={{ textAlign: "right" }}>Wordmark only</span></div>
        </div>
      </section>
    </main>
  );
}