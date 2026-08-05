import React from "react";

const INK = "#292522";
const PAPER = "#faf6f1";
const SIGNAL = "#ff3c00";
const MUTED = "#9b9289";
const HAIR = "#ded7d0";

function RegistrarMark({ reversed = false, size = 236 }: { reversed?: boolean; size?: number }) {
  const ink = reversed ? PAPER : INK;
  const rings = [96, 91, 86, 78, 73, 67];
  const ticks = Array.from({ length: 48 }, (_, i) => i);
  const radial = Array.from({ length: 24 }, (_, i) => i);
  return (
    <svg width={size} height={size} viewBox="0 0 240 240" role="img" aria-label="Registrar's seal mark">
      <g fill="none" stroke={ink} strokeLinecap="round">
        <circle cx="120" cy="120" r="101" strokeWidth="1.1" />
        <circle cx="120" cy="120" r="99" strokeWidth=".55" />
        {rings.map((r, i) => <circle key={r} cx="120" cy="120" r={r} strokeWidth={i % 2 ? ".52" : ".82"} />)}
        {ticks.map((i) => {
          const a = (i * 7.5 - 90) * Math.PI / 180;
          const r1 = i % 4 === 0 ? 93 : 95;
          const r2 = 98;
          return <line key={i} x1={120 + Math.cos(a) * r1} y1={120 + Math.sin(a) * r1} x2={120 + Math.cos(a) * r2} y2={120 + Math.sin(a) * r2} strokeWidth={i % 4 === 0 ? "1.05" : ".45"} />;
        })}
        {radial.map((i) => {
          const a = i * 15 * Math.PI / 180;
          return <line key={i} x1={120 + Math.cos(a) * 67} y1={120 + Math.sin(a) * 67} x2={120 + Math.cos(a + .18) * 73} y2={120 + Math.sin(a + .18) * 73} strokeWidth=".42" />;
        })}
        <path d="M120 79 L91 157 L103 157 L111 135 L129 135 L137 157 L149 157 Z M115 125 L120 108 L125 125 Z" strokeWidth="1.15" fill={reversed ? PAPER : "none"} />
        <circle cx="120" cy="120" r="3.4" strokeWidth=".75" />
        <path d="M120 19v5 M120 216v5 M19 120h5 M216 120h5" strokeWidth="1" />
      </g>
      {!reversed && <circle cx="120" cy="222" r="2.35" fill={SIGNAL} />}
    </svg>
  );
}

function Wordmark({ reversed = false, compact = false }: { reversed?: boolean; compact?: boolean }) {
  return <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: compact ? 22 : 29, letterSpacing: compact ? ".08em" : ".115em", lineHeight: 1, color: reversed ? PAPER : INK, fontWeight: 500 }}>
    ARCANUM<span style={{ color: SIGNAL, letterSpacing: 0 }}>.</span>
  </div>;
}

export default function RegistrarsSeal() {
  return (
    <main style={{ minHeight: "100vh", width: "100%", background: PAPER, color: INK, boxSizing: "border-box", padding: 20, fontFamily: "'Schibsted Grotesk', sans-serif" }}>
      <style>{`*{box-sizing:border-box} .rs-frame{min-height:calc(100vh - 40px);border:1px solid ${HAIR};display:flex;flex-direction:column;padding:0 22px} .rs-mono{font-family:'IBM Plex Mono','DM Mono',monospace;letter-spacing:.14em;text-transform:uppercase} .rs-header{height:55px;display:flex;align-items:center;justify-content:space-between;font-size:10px;color:#837a72;white-space:nowrap} .rs-hero{flex:1;min-height:350px;display:flex;align-items:center;justify-content:center;padding:14px 0 20px} .rs-lockup{height:80px;display:flex;align-items:center;justify-content:center;gap:18px;border-bottom:1px solid ${HAIR}} .rs-lockup svg{flex:none}.rs-band{height:142px;display:grid;grid-template-columns:1.2fr .8fr 1fr}.rs-tile{min-width:0;padding:17px 14px 12px;display:flex;flex-direction:column;justify-content:space-between;border-left:1px solid ${HAIR}} .rs-tile:first-child{border-left:0;padding-left:0}.rs-dark{background:${INK};padding:11px 14px}.rs-caption{font-family:'IBM Plex Mono','DM Mono',monospace;font-size:9px;letter-spacing:.13em;color:${MUTED};text-transform:uppercase}.rs-dark .rs-caption{color:#9b9289}.rs-word-only{display:flex;align-items:center;justify-content:flex-end;height:100%}@media(max-width:520px){.rs-frame{padding:0 14px}.rs-header{font-size:8px}.rs-hero{min-height:300px}.rs-lockup{gap:10px}.rs-band{height:130px}.rs-tile{padding-left:8px;padding-right:8px}}`}</style>
      <section className="rs-frame">
        <header className="rs-header rs-mono"><span>ARCANUM — LOGO STUDY 01/08</span><span>REGISTRAR'S SEAL</span></header>
        <div className="rs-hero"><RegistrarMark size={290} /></div>
        <div className="rs-lockup"><RegistrarMark size={58} /><Wordmark /></div>
        <div className="rs-band">
          <div className="rs-tile rs-dark"><div style={{ display: "flex", alignItems: "center", gap: 9 }}><RegistrarMark reversed size={58} /><Wordmark reversed compact /></div><span className="rs-caption">Reverse / certificate ink</span></div>
          <div className="rs-tile"><div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1 }}><RegistrarMark size={24} /></div><span className="rs-caption">24 PX</span></div>
          <div className="rs-tile"><div className="rs-word-only"><Wordmark compact /></div><span className="rs-caption" style={{ textAlign: "right" }}>Wordmark only</span></div>
        </div>
      </section>
    </main>
  );
}