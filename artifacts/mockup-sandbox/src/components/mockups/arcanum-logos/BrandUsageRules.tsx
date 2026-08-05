import type { ReactNode } from "react";
import { ArchwayCoinMark } from "./ArchwayCoinMark";

const PAPER = "#faf6f1";
const INK = "#292522";
const SIGNAL = "#ff3c00";
const UMBER = "#655d56";
const HAIRLINE = "#ded7d0";
const MUTED = "#837a72";
const MONO = '"DM Mono", "IBM Plex Mono", monospace';
const DISPLAY = '"Fraunces", Georgia, serif';

function Slash() {
  return <span aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}><i style={{ position: "absolute", width: "120%", height: 1, background: "#b3402a", top: "50%", left: "-10%", transform: "rotate(-28deg)" }} /><i style={{ position: "absolute", width: "120%", height: 1, background: "#b3402a", top: "50%", left: "-10%", transform: "rotate(28deg)" }} /></span>;
}

function Tile({ title, children, bad = false, bg = "#fbf8f4" }: { title: string; children: ReactNode; bad?: boolean; bg?: string }) {
  return <div style={{ position: "relative", minHeight: 142, border: `1px solid ${bad ? "#d8c6be" : HAIRLINE}`, background: bg, padding: "14px 15px" }}><div style={{ height: 90, display: "grid", placeItems: "center" }}>{children}</div><div style={{ borderTop: `1px solid ${bad ? "#e6d7d1" : HAIRLINE}`, paddingTop: 10, color: bad ? "#9e4f3c" : MUTED, fontFamily: MONO, fontSize: 9, letterSpacing: ".12em" }}>{bad ? "DON'T / " : "DO / "}{title}</div>{bad && <Slash />}</div>;
}

export default function BrandUsageRules() {
  return (
    <main style={{ minHeight: "100dvh", boxSizing: "border-box", background: PAPER, color: INK, padding: "30px 38px 34px", fontFamily: '"Schibsted Grotesk", system-ui, sans-serif' }}>
      <header style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${HAIRLINE}`, paddingBottom: 14, color: MUTED, fontFamily: MONO, fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase" }}><span>ARCANUM BRAND — USAGE RULES</span><span>PLATE 02 / 03 · 12 × 12 GRID</span></header>
      <section style={{ padding: "28px 0 22px", borderBottom: `1px solid ${HAIRLINE}` }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 14 }}><div><p style={{ margin: 0, color: SIGNAL, fontFamily: MONO, fontSize: 9, letterSpacing: ".15em" }}>THE MARK IN THE WILD</p><h1 style={{ margin: "8px 0 0", fontFamily: DISPLAY, fontSize: 34, fontWeight: 500, letterSpacing: "-.03em" }}>Protect the entrance.</h1></div><p style={{ maxWidth: 285, margin: 0, color: UMBER, fontSize: 12, lineHeight: 1.45 }}>The coin is a fixed piece of engineered geometry. Its authority comes from consistency, not decoration.</p></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <Tile title="PAPER / FULL-COLOR"><ArchwayCoinMark size={72} /></Tile>
          <Tile title="FOUNDRY / FULL-COLOR" bg="#121419"><ArchwayCoinMark size={72} mode="dark" /></Tile>
          <Tile title="PHOTO-DARK / REVERSED" bg="#383634"><ArchwayCoinMark size={72} mode="reversed" /></Tile>
        </div>
      </section>
      <section style={{ paddingTop: 22 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 13 }}><span style={{ color: SIGNAL, fontFamily: MONO, fontSize: 9, letterSpacing: ".15em" }}>NON-NEGOTIABLES</span><span style={{ color: MUTED, fontFamily: MONO, fontSize: 8, letterSpacing: ".12em" }}>SIGNAL ORANGE IS NEVER A SECOND LOGO</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
          <Tile bad title="ROTATE"><ArchwayCoinMark size={66} style={{ transform: "rotate(18deg)" }} /></Tile>
          <Tile bad title="RECOLOR"><ArchwayCoinMark size={66} style={{ filter: "hue-rotate(75deg) saturate(1.5)" }} /></Tile>
          <Tile bad title="STRETCH"><ArchwayCoinMark size={66} style={{ transform: "scaleX(1.45)" }} /></Tile>
          <Tile bad title="OUTLINE"><svg width="66" height="66" viewBox="56 56 288 288"><rect x="80" y="80" width="240" height="240" rx="42" fill="none" stroke={INK} strokeWidth="8" /><path d="M116 86 Q116 84 118 84 H282 Q284 84 284 86 V296 Q284 298 282 298 H238 V220 C238 190 222 174 200 174 C178 174 162 190 162 220 V298 H118 Q116 298 116 296 Z" fill="none" stroke={INK} strokeWidth="8" /></svg></Tile>
          <Tile bad title="MULTIPLY DOTS"><div style={{ position: "relative" }}><ArchwayCoinMark size={66} /><i style={{ position: "absolute", top: 31, left: 31, width: 10, height: 10, borderRadius: "50%", background: SIGNAL }} /></div></Tile>
        </div>
      </section>
      <footer style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 28, paddingTop: 15, borderTop: `1px solid ${HAIRLINE}`, color: MUTED, fontFamily: MONO, fontSize: 9, letterSpacing: ".12em" }}><span style={{ color: SIGNAL }}>46C</span><span>DO NOT MODIFY THE GEOMETRY</span><span style={{ marginLeft: "auto" }}>SOURCE: ARCHWAY COIN / MASTER SVG</span></footer>
    </main>
  );
}
