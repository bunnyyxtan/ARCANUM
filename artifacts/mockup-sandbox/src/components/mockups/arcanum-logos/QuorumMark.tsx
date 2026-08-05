import type { CSSProperties } from "react";

const INK = "#292522";
const PAPER = "#faf6f1";
const SIGNAL = "#ff3c00";
const HAIR = "#ded7d0";
const MUTED = "#9b9289";

type MarkProps = { size?: number; color?: string; signal?: boolean };

function Quorum({ size = 292, color = INK, signal = true }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 240 240" aria-label="Quorum mark" role="img">
      <g fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="120" cy="120" r="91" strokeWidth=".7" opacity=".3" />
        <circle cx="120" cy="120" r="84" strokeWidth=".45" opacity=".45" />
        <path d="M42 185h156" strokeWidth=".55" opacity=".35" />
        {/* two signatories: a restrained ink stroke and a measured signal-red stroke */}
        <path d="M54 184C70 160 85 119 105 72c6-14 11-25 15-25 6 0 10 14 16 29l45 108" strokeWidth="10" />
        <path d="M74 145c23-3 54-5 91-4" strokeWidth="10" />
        {/* engraved edge lines keep the gestures intentional at large scale */}
        <path d="M54 184C70 160 85 119 105 72c6-14 11-25 15-25" strokeWidth="1.2" />
        <path d="M120 47c6 0 10 14 16 29l45 108" strokeWidth="1.2" />
        <path d="M74 145c23-3 54-5 91-4" strokeWidth="1.2" />
        {/* negative-space tick at the quorum junction */}
        <path d="M115 140l9 9 13-15" stroke={PAPER} strokeWidth="5.5" />
      </g>
      {signal && <path d="M124 149l8-9" stroke={SIGNAL} strokeWidth="2.4" strokeLinecap="square" />}
    </svg>
  );
}

function Wordmark({ reversed = false }: { reversed?: boolean }) {
  return <span style={{ fontFamily: "'Fraunces', Georgia, serif", color: reversed ? PAPER : INK, fontSize: 29, letterSpacing: ".045em", lineHeight: 1 }}>ARCANUM<span style={{ color: reversed ? PAPER : INK }}>.</span></span>;
}

function Caption({ children }: { children: string }) {
  return <div style={{ marginTop: 11, color: MUTED, fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: ".14em" }}>{children}</div>;
}

export default function QuorumMark() {
  const frame: CSSProperties = { minHeight: "100dvh", background: PAPER, color: INK, padding: 20, boxSizing: "border-box" };
  const inner: CSSProperties = { border: `1px solid ${HAIR}`, minHeight: "calc(100dvh - 40px)", display: "flex", flexDirection: "column", overflow: "hidden" };
  const mono: CSSProperties = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".14em", color: "#837a72", textTransform: "uppercase" };
  return (
    <main style={frame}>
      <section style={inner}>
        <header style={{ ...mono, height: 50, padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}><span>ARCANUM — LOGO STUDY 08/08</span><span>QUORUM MARK</span></header>
        <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}><Quorum /></div>
        <div style={{ borderTop: `1px solid ${HAIR}`, padding: "23px 24px 27px", flexShrink: 0 }}>
          <div style={{ ...mono, color: MUTED, fontSize: 9, marginBottom: 12 }}>PRIMARY LOCKUP</div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}><Quorum size={47} /><Wordmark /></div>
        </div>
        <div style={{ borderTop: `1px solid ${HAIR}`, display: "grid", gridTemplateColumns: "1.25fr .75fr 1fr", flexShrink: 0 }}>
          <div style={{ padding: "18px 19px 17px", background: INK, minHeight: 104 }}><div style={{ height: 55, display: "flex", alignItems: "center", gap: 10 }}><Quorum size={48} color={PAPER} signal={false} /><Wordmark reversed /></div><Caption>REVERSED LOCKUP</Caption></div>
          <div style={{ padding: "18px 18px 17px", borderLeft: `1px solid ${HAIR}`, minHeight: 104 }}><div style={{ height: 55, display: "flex", alignItems: "center" }}><Quorum size={24} /></div><Caption>24 PX</Caption></div>
          <div style={{ padding: "18px 18px 17px", borderLeft: `1px solid ${HAIR}`, minHeight: 104 }}><div style={{ height: 55, display: "flex", alignItems: "center" }}><Wordmark /></div><Caption>WORDMARK ONLY</Caption></div>
        </div>
      </section>
    </main>
  );
}