import type { CSSProperties } from "react";

const INK = "#292522";
const PAPER = "#faf6f1";
const SIGNAL = "#ff3c00";
const HAIR = "#ded7d0";
const MUTED = "#9b9289";

type MarkProps = { size?: number; color?: string; signal?: boolean };

function CipherMark({ size = 292, color = INK, signal = true }: MarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 240 240" aria-label="Cipher monogram mark" role="img">
      <g fill="none" stroke={color} strokeLinecap="square" strokeLinejoin="miter">
        <circle cx="120" cy="120" r="91" strokeWidth="0.8" opacity=".32" />
        <circle cx="120" cy="120" r="83" strokeWidth="0.55" opacity=".52" />
        <path d="M120 27v186M27 120h186" strokeWidth=".45" opacity=".2" />
        {/* mirrored A ciphers, deliberately broken at the crossings to show the weave */}
        <path d="M61 181 106 54l14 0 43 127" strokeWidth="8.8" />
        <path d="M179 181 134 54h-14" strokeWidth="8.8" />
        <path d="M73 146h94" strokeWidth="8.8" />
        <path d="M179 181 134 54l-14 0-43 127" strokeWidth="8.8" />
        <path d="M61 181 106 54h14l43 127" strokeWidth="8.8" />
        {/* precise paper interruptions: the upper A is carried over the lower one */}
        <path d="M113 78l14 0" stroke={PAPER} strokeWidth="12" />
        <path d="M113 78l14 0" stroke={color} strokeWidth="8.8" />
        <path d="M108 146h24" stroke={PAPER} strokeWidth="12" />
        <path d="M108 146h24" stroke={color} strokeWidth="8.8" />
        <path d="M74 145h32M134 145h32" stroke={color} strokeWidth="8.8" />
        <path d="M61 181 106 54h14M179 181 134 54h-14" strokeWidth="1.25" />
      </g>
      {signal && <circle cx="120" cy="120" r="3.2" fill={SIGNAL} />}
    </svg>
  );
}

function Wordmark({ reversed = false }: { reversed?: boolean }) {
  return (
    <span style={{ fontFamily: "'Fraunces', Georgia, serif", color: reversed ? PAPER : INK, fontSize: 29, letterSpacing: ".045em", lineHeight: 1 }}>
      ARCANUM<span style={{ color: reversed ? PAPER : INK }}>.</span>
    </span>
  );
}

function Caption({ children }: { children: string }) {
  return <div style={{ marginTop: 11, color: MUTED, fontFamily: "'IBM Plex Mono', monospace", fontSize: 9, letterSpacing: ".14em" }}>{children}</div>;
}

export default function CipherMonogram() {
  const frame: CSSProperties = { minHeight: "100dvh", background: PAPER, color: INK, padding: 20, boxSizing: "border-box" };
  const inner: CSSProperties = { border: `1px solid ${HAIR}`, minHeight: "calc(100dvh - 40px)", display: "flex", flexDirection: "column", overflow: "hidden" };
  const mono: CSSProperties = { fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".14em", color: "#837a72", textTransform: "uppercase" };
  return (
    <main style={frame}>
      <section style={inner}>
        <header style={{ ...mono, height: 50, padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span>ARCANUM — LOGO STUDY 07/08</span><span>CIPHER MONOGRAM</span>
        </header>
        <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <CipherMark />
        </div>
        <div style={{ borderTop: `1px solid ${HAIR}`, padding: "23px 24px 27px", flexShrink: 0 }}>
          <div style={{ ...mono, color: MUTED, fontSize: 9, marginBottom: 12 }}>PRIMARY LOCKUP</div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}><CipherMark size={47} /><Wordmark /></div>
        </div>
        <div style={{ borderTop: `1px solid ${HAIR}`, display: "grid", gridTemplateColumns: "1.25fr .75fr 1fr", flexShrink: 0 }}>
          <div style={{ padding: "18px 19px 17px", background: INK, minHeight: 104 }}>
            <div style={{ height: 55, display: "flex", alignItems: "center", gap: 10 }}><CipherMark size={48} color={PAPER} signal={false} /><Wordmark reversed /></div><Caption>REVERSED LOCKUP</Caption>
          </div>
          <div style={{ padding: "18px 18px 17px", borderLeft: `1px solid ${HAIR}`, minHeight: 104 }}>
            <div style={{ height: 55, display: "flex", alignItems: "center" }}><CipherMark size={24} /></div><Caption>24 PX</Caption>
          </div>
          <div style={{ padding: "18px 18px 17px", borderLeft: `1px solid ${HAIR}`, minHeight: 104 }}>
            <div style={{ height: 55, display: "flex", alignItems: "center" }}><Wordmark /></div><Caption>WORDMARK ONLY</Caption>
          </div>
        </div>
      </section>
    </main>
  );
}