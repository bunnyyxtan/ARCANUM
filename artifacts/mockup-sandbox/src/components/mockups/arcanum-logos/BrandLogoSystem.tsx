import type { CSSProperties } from "react";
import { ArchwayCoinMark } from "./ArchwayCoinMark";

const PAPER = "#faf6f1";
const INK = "#292522";
const UMBER = "#655d56";
const SIGNAL = "#ff3c00";
const HAIRLINE = "#ded7d0";
const MUTED = "#837a72";
const GUIDE = "#9b9289";
const MONO = '"DM Mono", "IBM Plex Mono", monospace';
const DISPLAY = '"Fraunces", Georgia, serif';
const BODY = '"Schibsted Grotesk", system-ui, sans-serif';

function Label({ children }: { children: string }) {
  return <div style={{ color: MUTED, fontFamily: MONO, fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase" }}>{children}</div>;
}

function Lockup({ stacked = false, reversed = false }: { stacked?: boolean; reversed?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: stacked ? "column" : "row", alignItems: stacked ? "flex-start" : "center", gap: stacked ? 10 : 14, color: reversed ? PAPER : INK }}>
      <ArchwayCoinMark size={stacked ? 62 : 42} mode={reversed ? "reversed" : "full"} />
      <span style={{ fontFamily: DISPLAY, fontSize: stacked ? 34 : 29, fontWeight: 600, letterSpacing: "-.025em", lineHeight: .92 }}>ARCANUM<span style={{ color: reversed ? PAPER : SIGNAL }}>.</span></span>
    </div>
  );
}

export default function BrandLogoSystem() {
  const panel: CSSProperties = { border: `1px solid ${HAIRLINE}`, padding: "18px 20px", background: "#fbf8f4" };
  return (
    <main style={{ minHeight: "100dvh", boxSizing: "border-box", background: PAPER, color: INK, padding: "30px 38px 34px", fontFamily: BODY }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${HAIRLINE}`, paddingBottom: 14, color: MUTED, fontFamily: MONO, fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase" }}><span>ARCANUM BRAND — LOGO SYSTEM</span><span>PLATE 01 / 03 · GRID 12 × 12</span></header>
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1.35fr", gap: 34, padding: "30px 0 26px", borderBottom: `1px solid ${HAIRLINE}` }}>
        <div><Label>01 / Primary mark</Label><div style={{ padding: "22px 0 16px" }}><ArchwayCoinMark size={205} /></div><p style={{ margin: 0, color: UMBER, fontSize: 12, lineHeight: 1.5, maxWidth: 290 }}>The Archway Coin: a governed entrance held inside a carryable field. Exact source geometry: 240 coin / R42 / 4:5 negative arch / signal datum 200,196.</p></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={panel}><Label>Horizontal lockup</Label><div style={{ padding: "38px 0 22px" }}><Lockup /></div><div style={{ color: GUIDE, fontFamily: MONO, fontSize: 8 }}>MARK = 1.0W · GAP = .33W</div></div>
          <div style={panel}><Label>Stacked lockup</Label><div style={{ padding: "22px 0 15px" }}><Lockup stacked /></div><div style={{ color: GUIDE, fontFamily: MONO, fontSize: 8 }}>MARK = 1.0W · GAP = .16W</div></div>
          <div style={{ ...panel, gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 24 }}><div><Label>Clearspace</Label><div style={{ position: "relative", marginTop: 14, padding: 18, border: `1px dashed ${GUIDE}` }}><ArchwayCoinMark size={68} /><i style={{ position: "absolute", inset: -18, border: `1px solid ${HAIRLINE}` }} /></div></div><p style={{ margin: 0, color: GUIDE, fontFamily: MONO, fontSize: 9, lineHeight: 1.55, maxWidth: 250 }}>EXCLUSION ZONE = 0.5 COIN-WIDTH ON ALL SIDES. No type, edge, or signal may enter the field.</p></div>
        </div>
      </section>
      <section style={{ padding: "22px 0 24px", borderBottom: `1px solid ${HAIRLINE}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}><Label>02 / Color architecture</Label><span style={{ color: GUIDE, fontFamily: MONO, fontSize: 8 }}>SIGNAL IS ALWAYS THE SMALLEST FOCAL ELEMENT</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            { name: "FULL-COLOR / PAPER", bg: PAPER, mode: "full" as const, note: "#292522 + #ff3c00" },
            { name: "FULL-COLOR / FOUNDRY", bg: "#121419", mode: "dark" as const, note: "#edf0f3 + #ff5a1f" },
            { name: "1-COLOR / INK", bg: PAPER, mode: "ink" as const, note: "#292522 only" },
            { name: "1-COLOR / REVERSED", bg: INK, mode: "reversed" as const, note: "#faf6f1 only" },
          ].map(item => <div key={item.name} style={{ background: item.bg, border: `1px solid ${item.bg === PAPER ? HAIRLINE : "#282c34"}`, padding: 14, minHeight: 122 }}><ArchwayCoinMark size={62} mode={item.mode} /><div style={{ marginTop: 11, color: item.bg === PAPER ? MUTED : "#aab0b9", fontFamily: MONO, fontSize: 8, lineHeight: 1.35, letterSpacing: ".11em" }}>{item.name}<br /><span style={{ letterSpacing: ".04em" }}>{item.note}</span></div></div>)}
        </div>
      </section>
      <section style={{ display: "flex", alignItems: "center", gap: 42, paddingTop: 22 }}><Label>03 / Minimum size</Label><div style={{ display: "flex", alignItems: "end", gap: 26 }}><div style={{ textAlign: "center" }}><ArchwayCoinMark size={16} /><span style={{ display: "block", marginTop: 5, color: GUIDE, fontFamily: MONO, fontSize: 8 }}>MARK / 16PX</span></div><div style={{ textAlign: "center" }}><Lockup /><span style={{ display: "block", marginTop: 5, color: GUIDE, fontFamily: MONO, fontSize: 8 }}>LOCKUP / 120PX</span></div></div><span style={{ marginLeft: "auto", color: GUIDE, fontFamily: MONO, fontSize: 8, letterSpacing: ".12em" }}>12-COLUMN MASTER GRID · 24PX UNIT</span></section>
    </main>
  );
}
