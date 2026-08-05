import type { ReactNode } from "react";
import EmberMark from "./EmberMark";

const PAPER = "#faf6f1";
const INK = "#292522";
const FOUNDRY = "#1d1a18";
const SIGNAL = "#ff3c00";
const UMBER = "#655d56";
const HAIRLINE = "#ded7d0";
const MUTED = "#837a72";
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

function Swatch({ ground, label, oneColor = false, photo = false, orange = false }: { ground: string; label: string; oneColor?: boolean; photo?: boolean; orange?: boolean }) {
  return <figure style={{ margin: 0, background: ground, minHeight: 96, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 5, position: "relative", overflow: "hidden" }}>
    {photo ? <div style={{ position: "absolute", inset: 0, background: `repeating-linear-gradient(135deg, ${UMBER} 0 12px, ${INK} 12px 24px, ${SIGNAL} 24px 30px)`, opacity: .85 }} /> : null}
    {orange ? <div style={{ position: "absolute", inset: 0, background: SIGNAL }} /> : null}
    <div style={{ position: "relative", zIndex: 1 }}><EmberMark size={52} oneColor={oneColor} /></div>
    <figcaption style={{ position: "relative", zIndex: 1, color: ground === PAPER ? MUTED : PAPER, fontSize: 8, letterSpacing: ".1em" }}>{label}</figcaption>
  </figure>;
}

function Misuse({ children, label }: { children: ReactNode; label: string }) {
  return <figure style={{ margin: 0, background: PAPER, minHeight: 84, display: "grid", placeItems: "center", position: "relative" }}><div style={{ opacity: .55 }}>{children}</div><div style={{ position: "absolute", width: "75%", height: 2, background: SIGNAL, transform: "rotate(-24deg)" }} /><figcaption style={{ color: MUTED, fontSize: 7, letterSpacing: ".08em", position: "absolute", bottom: 5 }}>{label}</figcaption></figure>;
}

export default function EmberUsageRules() {
  return (
    <main style={{ minHeight: "100dvh", width: "100%", boxSizing: "border-box", background: PAPER, color: INK, padding: "30px 0 22px", fontFamily: MONO }}>
      <header style={{ padding: "0 34px", display: "flex", justifyContent: "space-between", color: MUTED, fontSize: 10, letterSpacing: ".15em" }}><span>ARCANUM BRAND — EMBER USAGE RULES</span><span>PLATE 02/04</span></header>
      <section style={{ padding: "22px 34px 10px", borderBottom: `1px solid ${HAIRLINE}` }}><div style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: 32, letterSpacing: "-.045em" }}>Keep the core intact.</div><div style={{ marginTop: 5, color: MUTED, fontSize: 10, letterSpacing: ".08em" }}>The Ember carries its contrast. Never make the theme carry it.</div></section>
      <section style={{ padding: "12px 34px 16px" }}><div style={{ color: UMBER, fontSize: 9, letterSpacing: ".14em", marginBottom: 8 }}>CORRECT USE / THE IDENTICAL ASSET</div><div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1, background: HAIRLINE }}><Swatch ground={PAPER} label="PAPER" /><Swatch ground={FOUNDRY} label="FOUNDRY" /><Swatch ground={PAPER} label="1-COLOR" oneColor /><Swatch ground={UMBER} label="PHOTO FIELD" photo /><Swatch ground={SIGNAL} label="ORANGE FIELD" orange /></div></section>
      <section style={{ padding: "0 34px 16px" }}><div style={{ color: UMBER, fontSize: 9, letterSpacing: ".14em", marginBottom: 8 }}>MISUSE / NEVER ALTER THE MASTER</div><div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 1, background: HAIRLINE }}><Misuse label="NO RECOLOR"><EmberMark size={48} /></Misuse><Misuse label="NO STRETCH"><div style={{ transform: "scaleX(1.5)" }}><EmberMark size={48} /></div></Misuse><Misuse label="NO ROTATE"><div style={{ transform: "rotate(25deg)" }}><EmberMark size={48} /></div></Misuse><Misuse label="NO LETTER-ADDING"><div style={{ display: "flex" }}><EmberMark size={42} /><span style={{ fontFamily: '"Fraunces", Georgia, serif', fontSize: 24 }}>A</span></div></Misuse><Misuse label="NO THEME SWAP"><div style={{ background: INK }}><EmberMark size={48} /></div></Misuse><Misuse label="NO SHADOW"><div style={{ filter: "drop-shadow(5px 5px 2px #655d56)" }}><EmberMark size={48} /></div></Misuse></div></section>
      <section style={{ borderTop: `1px solid ${HAIRLINE}`, padding: "12px 34px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}><div><div style={{ color: UMBER, fontSize: 9, letterSpacing: ".14em", marginBottom: 8 }}>PLACEMENT / DO</div><div style={{ border: `1px solid ${HAIRLINE}`, padding: 22, textAlign: "center" }}><EmberMark size={70} /><div style={{ marginTop: 8, color: MUTED, fontSize: 8 }}>1× MARK WIDTH CLEARSPACE · LIVE CORE FACES UP</div></div></div><div><div style={{ color: SIGNAL, fontSize: 9, letterSpacing: ".14em", marginBottom: 8 }}>PLACEMENT / DON'T</div><div style={{ border: `1px solid ${SIGNAL}`, padding: 22, textAlign: "center", background: "#f2ebe5" }}><div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}><span style={{ color: MUTED, fontSize: 18 }}>TEXT</span><EmberMark size={70} /><span style={{ color: MUTED, fontSize: 18 }}>TEXT</span></div><div style={{ marginTop: 8, color: SIGNAL, fontSize: 8 }}>CROWDED EDGE / BROKEN CLEARSPACE</div></div></div></section>
      <p style={{ padding: "16px 34px 0", margin: 0, color: MUTED, fontSize: 9, letterSpacing: ".11em", textTransform: "uppercase" }}>PROTECT THE PROPORTIONS. PROTECT THE PAPER. PROTECT THE SIGNAL.</p>
    </main>
  );
}