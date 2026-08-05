import React from "react";

const ink = "#292522";
const paper = "#faf6f1";
const signal = "#ff3c00";
const hair = "#9b9289";
const frame = "#ded7d0";

function LedgerMark({ reversed = false, small = false }: { reversed?: boolean; small?: boolean }) {
  const foreground = reversed ? paper : ink;
  const quiet = reversed ? "#b9b0a8" : hair;
  return (
    <svg
      viewBox="0 0 520 126"
      width={small ? 24 : "100%"}
      height={small ? 24 : "auto"}
      role="img"
      aria-label="Arcanum ledger rule mark"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block", overflow: "visible" }}
    >
      <g fill="none" stroke={foreground} strokeLinecap="square">
        <path d="M38 91.5H482" strokeWidth="1.15" />
        <path d="M38 95.5H482" strokeWidth="0.7" />
        <path d="M88 76.5L106 33L124 76.5" strokeWidth="1.1" />
        <path d="M96 57.4H116" strokeWidth="0.75" />
        <path d="M92 67.2H120" strokeWidth="0.75" />
      </g>
      <text x="38" y="78" fill={foreground} style={{ fontFamily: "Fraunces, Georgia, serif", fontSize: 57, fontWeight: 500, letterSpacing: "0.105em" }}>
        ARCANUM
      </text>
      <circle cx="487" cy="93.5" r="3.2" fill={signal} />
      <path d="M478 91.5H482" stroke={quiet} strokeWidth="0.6" />
    </svg>
  );
}

export default function LedgerRule() {
  const mono: React.CSSProperties = { fontFamily: "'IBM Plex Mono', 'DM Mono', monospace" };
  return (
    <main style={{ minHeight: "100vh", width: "100%", background: paper, color: ink, padding: 20, boxSizing: "border-box", fontFamily: "'Schibsted Grotesk', sans-serif" }}>
      <div style={{ minHeight: "calc(100vh - 40px)", border: `1px solid ${frame}`, boxSizing: "border-box", display: "flex", flexDirection: "column", padding: "15px 18px 0" }}>
        <header style={{ ...mono, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, color: "#837a72", fontSize: 10, letterSpacing: "0.14em", lineHeight: 1.2, textTransform: "uppercase" }}>
          <span>Arcanum — Logo Study 03/08</span><span>Ledger Rule</span>
        </header>
        <section style={{ flex: "1 1 auto", minHeight: 360, display: "flex", alignItems: "center", justifyContent: "center", padding: "22px 8px 15px" }}>
          <div style={{ width: "min(520px, 100%)" }}><LedgerMark /></div>
        </section>
        <section style={{ borderTop: `1px solid ${frame}`, padding: "22px 0 23px", display: "flex", justifyContent: "center" }}>
          <div style={{ width: "min(414px, 78%)" }}>
            <LedgerMark />
          </div>
        </section>
        <section style={{ borderTop: `1px solid ${frame}`, display: "grid", gridTemplateColumns: "1.3fr 0.72fr 1fr", minHeight: 148 }}>
          <div style={{ background: ink, padding: "18px 17px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ width: "100%" }}><LedgerMark reversed /></div>
            <span style={{ ...mono, color: "#b9b0a8", fontSize: 9, letterSpacing: "0.12em" }}>REVERSED LOCKUP</span>
          </div>
          <div style={{ borderLeft: `1px solid ${frame}`, padding: "18px 16px", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "flex-start" }}>
            <LedgerMark small />
            <span style={{ ...mono, color: hair, fontSize: 9, letterSpacing: "0.12em" }}>24 PX</span>
          </div>
          <div style={{ borderLeft: `1px solid ${frame}`, padding: "18px 17px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
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