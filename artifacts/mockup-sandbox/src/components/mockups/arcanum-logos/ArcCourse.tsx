import React from "react";

const ink = "#292522";
const paper = "#faf6f1";
const signal = "#ff3c00";
const hair = "#ded7d0";
const muted = "#9b9289";

function ArcCourseMark({ reversed = false, size = 300 }: { reversed?: boolean; size?: number }) {
  const foreground = reversed ? paper : ink;
  const secondary = reversed ? "#9b9289" : "#655d56";
  const ticks = Array.from({ length: 25 }, (_, i) => {
    const angle = -72 + i * 6;
    const major = i % 4 === 0;
    const a = (angle * Math.PI) / 180;
    const x1 = 120 + Math.cos(a) * 76;
    const y1 = 150 + Math.sin(a) * 76;
    const x2 = 120 + Math.cos(a) * (major ? 66 : 70);
    const y2 = 150 + Math.sin(a) * (major ? 66 : 70);
    return <path key={i} d={`M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`} />;
  });
  return (
    <svg width={size} height={size} viewBox="0 0 240 240" aria-label="Arc Course instrument mark" role="img">
      <g fill="none" stroke={foreground} strokeLinecap="square">
        <path d="M39 150a81 81 0 0 1 162 0" strokeWidth="1.2" />
        <path d="M47 150a73 73 0 0 1 146 0" stroke={secondary} strokeWidth=".65" />
        <path d="M56 150a64 64 0 0 1 128 0" stroke={secondary} strokeWidth=".65" />
        <g strokeWidth="1.05">{ticks}</g>
        <path d="M120 150V63M120 150L79 150" strokeWidth="1.4" />
        <path d="M120 150L163 150" stroke={secondary} strokeWidth=".65" />
        <path d="M72 150L120 63l48 87" strokeWidth="1.2" />
        <circle cx="120" cy="150" r="3.2" strokeWidth="1.1" />
        <path d="M39 157h162" stroke={secondary} strokeWidth=".65" />
      </g>
      <path d="M120 63l-3.7 7h7.4z" fill={signal} />
      <g fill={foreground} fontFamily="'IBM Plex Mono', monospace" fontSize="6" letterSpacing=".06em">
        <text x="35" y="171">W</text><text x="199" y="171">E</text><text x="116" y="48">N</text>
      </g>
    </svg>
  );
}

function Wordmark({ reversed = false, compact = false }: { reversed?: boolean; compact?: boolean }) {
  return <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: compact ? 21 : 29, letterSpacing: compact ? ".07em" : ".055em", color: reversed ? paper : ink, fontWeight: 470, lineHeight: 1 }}>ARCANUM<span style={{ color: signal }}>.</span></span>;
}
function Caption({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: "'IBM Plex Mono', monospace", color: muted, fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase" }}>{children}</div>;
}

export default function ArcCourse() {
  return (
    <main style={{ minHeight: "100vh", width: "100%", background: paper, color: ink, padding: 20, boxSizing: "border-box" }}>
      <div style={{ minHeight: "calc(100vh - 40px)", border: `1px solid ${hair}`, display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <header style={{ height: 48, padding: "0 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${hair}`, flexShrink: 0 }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".14em", color: "#837a72" }}>ARCANUM — LOGO STUDY 06/08</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".14em", color: "#837a72" }}>ARC COURSE</span>
        </header>
        <section style={{ flex: "1 1 auto", minHeight: 390, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <ArcCourseMark />
        </section>
        <section style={{ borderTop: `1px solid ${hair}`, minHeight: 100, display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
          <ArcCourseMark size={58} /><Wordmark />
        </section>
        <section style={{ borderTop: `1px solid ${hair}`, display: "grid", gridTemplateColumns: "1.3fr .7fr 1fr", minHeight: 170 }}>
          <div style={{ background: ink, padding: "18px 16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}><ArcCourseMark reversed size={55} /><Wordmark reversed compact /></div>
            <Caption>Reversed lockup</Caption>
          </div>
          <div style={{ borderLeft: `1px solid ${hair}`, padding: "18px 14px", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center" }}>
            <ArcCourseMark size={24} /><Caption>24 PX</Caption>
          </div>
          <div style={{ borderLeft: `1px solid ${hair}`, padding: "18px 16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <Wordmark compact /><Caption>Wordmark only</Caption>
          </div>
        </section>
      </div>
    </main>
  );
}