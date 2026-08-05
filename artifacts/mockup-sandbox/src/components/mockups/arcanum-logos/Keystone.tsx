import React from "react";

const ink = "#292522";
const paper = "#faf6f1";
const signal = "#ff3c00";
const hair = "#ded7d0";
const muted = "#9b9289";

function KeystoneMark({ reversed = false, size = 300 }: { reversed?: boolean; size?: number }) {
  const foreground = reversed ? paper : ink;
  const secondary = reversed ? "#9b9289" : "#655d56";
  return (
    <svg width={size} height={size} viewBox="0 0 240 240" aria-label="Keystone arch mark" role="img">
      <g fill="none" stroke={foreground} strokeWidth="1.15" strokeLinecap="square">
        <path d="M47 195V111c0-40 32-72 73-72s73 32 73 72v84" />
        <path d="M54 195v-84c0-36 29-65 66-65s66 29 66 65v84" stroke={secondary} strokeWidth=".65" />
        <path d="M34 195h172" />
        <path d="M39 202h162" stroke={secondary} strokeWidth=".65" />
      </g>
      <g fill={foreground}>
        <path d="M42 195v-84c0-44 35-79 78-79s78 35 78 79v84h-12v-84c0-37-29-67-66-67s-66 30-66 67v84z" fillOpacity=".025" />
        <path d="M47 107L58 91l10 7-9 16z" />
        <path d="M61 86l16-13 8 10-14 12z" />
        <path d="M81 70l19-8 5 11-17 8z" />
        <path d="M104 59l22-2v12l-20 2z" />
        <path d="M130 57l22 4-3 12-20-4z" />
        <path d="M156 63l19 9-6 11-17-8z" />
        <path d="M178 76l16 13-9 10-14-12z" />
        <path d="M198 94l11 16-11 7-9-15z" />
      </g>
      <path d="M116 54l4-10 4 10v17l-4 5-4-5z" fill={signal} />
      <g fill="none" stroke={secondary} strokeWidth=".65">
        <path d="M53 119h16M52 132h17M52 145h17M52 158h17M52 171h17M52 184h17" />
        <path d="M171 119h17M171 132h17M171 145h17M171 158h17M171 171h17M171 184h17" />
      </g>
    </svg>
  );
}

function Wordmark({ reversed = false, compact = false }: { reversed?: boolean; compact?: boolean }) {
  return (
    <span style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: compact ? 21 : 29, letterSpacing: compact ? ".07em" : ".055em", color: reversed ? paper : ink, fontWeight: 470, lineHeight: 1 }}>
      ARCANUM<span style={{ color: signal }}>.</span>
    </span>
  );
}

function Caption({ children }: { children: React.ReactNode }) {
  return <div style={{ fontFamily: "'IBM Plex Mono', monospace", color: muted, fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase" }}>{children}</div>;
}

export default function Keystone() {
  return (
    <main style={{ minHeight: "100vh", width: "100%", background: paper, color: ink, padding: 20, boxSizing: "border-box" }}>
      <div style={{ minHeight: "calc(100vh - 40px)", border: `1px solid ${hair}`, display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
        <header style={{ height: 48, padding: "0 18px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${hair}`, flexShrink: 0 }}>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".14em", color: "#837a72" }}>ARCANUM — LOGO STUDY 05/08</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".14em", color: "#837a72" }}>KEYSTONE</span>
        </header>
        <section style={{ flex: "1 1 auto", minHeight: 390, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <KeystoneMark />
        </section>
        <section style={{ borderTop: `1px solid ${hair}`, minHeight: 100, display: "flex", alignItems: "center", justifyContent: "center", gap: 18 }}>
          <KeystoneMark size={58} />
          <Wordmark />
        </section>
        <section style={{ borderTop: `1px solid ${hair}`, display: "grid", gridTemplateColumns: "1.3fr .7fr 1fr", minHeight: 170 }}>
          <div style={{ background: ink, padding: "18px 16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 11 }}><KeystoneMark reversed size={55} /><Wordmark reversed compact /></div>
            <Caption>Reversed lockup</Caption>
          </div>
          <div style={{ borderLeft: `1px solid ${hair}`, padding: "18px 14px", display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center" }}>
            <KeystoneMark size={24} />
            <Caption>24 PX</Caption>
          </div>
          <div style={{ borderLeft: `1px solid ${hair}`, padding: "18px 16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <Wordmark compact />
            <Caption>Wordmark only</Caption>
          </div>
        </section>
      </div>
    </main>
  );
}