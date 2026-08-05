import React from "react";

const ink = "#292522";
const paper = "#faf6f1";
const signal = "#ff3c00";
const frame = "#ded7d0";
const hair = "#9b9289";

function CrestDevice({ reversed = false, small = false }: { reversed?: boolean; small?: boolean }) {
  const foreground = reversed ? paper : ink;
  const quiet = reversed ? "#b9b0a8" : hair;
  return (
    <svg viewBox="0 0 520 210" width={small ? 24 : "100%"} height={small ? 24 : "auto"} role="img" aria-label="Arcanum letterhead crest mark" style={{ display: "block" }} preserveAspectRatio="xMidYMid meet">
      <g fill="none" stroke={foreground} strokeLinecap="square" strokeLinejoin="miter">
        <path d="M260 22V170" strokeWidth="0.8" />
        <path d="M216 170H304" strokeWidth="1.25" />
        <path d="M222 174H298" strokeWidth="0.65" />
        <path d="M224 169V84Q224 48 260 34Q296 48 296 84V169" strokeWidth="1.2" />
        <path d="M235 169V86Q235 61 260 48Q285 61 285 86V169" strokeWidth="0.65" />
        <path d="M241 169V89Q241 69 260 59Q279 69 279 89V169" strokeWidth="0.55" />
        <path d="M210 83H310M219 77H301" strokeWidth="0.65" />
        <path d="M244 34L260 21L276 34" strokeWidth="1" />
        <path d="M252 21H268" strokeWidth="0.55" />
        <path d="M246 92H274M246 102H274M246 112H274" strokeWidth="0.45" />
        <path d="M204 169H316" stroke={quiet} strokeWidth="0.45" />
      </g>
      <g fill={foreground}>
        <circle cx="260" cy="84" r="2.2" />
        <circle cx="210" cy="83" r="1.2" />
        <circle cx="310" cy="83" r="1.2" />
      </g>
    </svg>
  );
}

function CrestLockup({ reversed = false }: { reversed?: boolean }) {
  const foreground = reversed ? paper : ink;
  const quiet = reversed ? "#b9b0a8" : hair;
  return (
    <svg viewBox="0 0 520 258" width="100%" height="auto" role="img" aria-label="Arcanum letterhead crest lockup" preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
      <CrestDevice reversed={reversed} />
      <text x="260" y="206" textAnchor="middle" fill={foreground} style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 38, fontWeight: 500, letterSpacing: "0.18em" }}>ARCANUM</text>
      <path d="M76 220H444" stroke={foreground} strokeWidth="1.1" />
      <path d="M76 224H444" stroke={foreground} strokeWidth="0.65" />
      <text x="260" y="246" textAnchor="middle" fill={quiet} style={{ fontFamily: "'IBM Plex Mono', 'DM Mono', monospace", fontSize: 8.5, letterSpacing: "0.15em" }}>GOVERNED SPEND · ARC LEDGER</text>
      <circle cx="441" cy="222" r="2.5" fill={signal} />
    </svg>
  );
}

export default function LetterheadCrest() {
  const mono: React.CSSProperties = { fontFamily: "'IBM Plex Mono', 'DM Mono', monospace" };
  return (
    <main style={{ minHeight: "100vh", width: "100%", background: paper, color: ink, padding: 20, boxSizing: "border-box", fontFamily: "'Schibsted Grotesk', sans-serif" }}>
      <div style={{ minHeight: "calc(100vh - 40px)", border: `1px solid ${frame}`, boxSizing: "border-box", display: "flex", flexDirection: "column", padding: "15px 18px 0" }}>
        <header style={{ ...mono, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, color: "#837a72", fontSize: 10, letterSpacing: "0.14em", lineHeight: 1.2, textTransform: "uppercase" }}>
          <span>Arcanum — Logo Study 04/08</span><span>Letterhead Crest</span>
        </header>
        <section style={{ flex: "1 1 auto", minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center", padding: "10px 8px 6px" }}>
          <div style={{ width: "min(405px, 84%)" }}><CrestLockup /></div>
        </section>
        <section style={{ borderTop: `1px solid ${frame}`, padding: "17px 0 18px", display: "flex", justifyContent: "center" }}>
          <div style={{ width: "min(290px, 63%)" }}><CrestLockup /></div>
        </section>
        <section style={{ borderTop: `1px solid ${frame}`, display: "grid", gridTemplateColumns: "1.3fr 0.72fr 1fr", minHeight: 148 }}>
          <div style={{ background: ink, padding: "15px 17px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div><CrestLockup reversed /></div>
            <span style={{ ...mono, color: "#b9b0a8", fontSize: 9, letterSpacing: "0.12em" }}>REVERSED LOCKUP</span>
          </div>
          <div style={{ borderLeft: `1px solid ${frame}`, padding: "15px 16px", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-start" }}>
            <CrestDevice small />
            <span style={{ ...mono, color: hair, fontSize: 9, letterSpacing: "0.12em" }}>24 PX</span>
          </div>
          <div style={{ borderLeft: `1px solid ${frame}`, padding: "15px 17px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ whiteSpace: "nowrap", color: ink, fontFamily: "Fraunces, Georgia, serif", fontSize: "clamp(18px, 3vw, 26px)", fontWeight: 500, letterSpacing: "0.085em" }}>
              ARCANUM<span style={{ color: signal }}>.</span>
            </div>
            <span style={{ ...mono, color: hair, fontSize: 9, letterSpacing: "0.12em" }}>WORDMARK ONLY</span>
          </div>
        </section>
      </div>
    </main>
  );
}