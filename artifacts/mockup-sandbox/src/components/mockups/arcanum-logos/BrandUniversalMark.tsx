import { ArchwayCoinMark } from "./ArchwayCoinMark";

const PAPER = "#faf6f1";
const INK = "#292522";
const UMBER = "#655d56";
const SIGNAL = "#ff3c00";
const FOUNDARY = "#121419";
const HAIRLINE = "#ded7d0";
const MUTED = "#837a72";
const GUIDE = "#9b9289";
const MONO = '"DM Mono", "IBM Plex Mono", monospace';
const DISPLAY = '"Fraunces", Georgia, serif';

function Ground({ label, background, texture = false }: { label: string; background: string; texture?: boolean }) {
  return (
    <div style={{ border: `1px solid ${background === PAPER ? HAIRLINE : "#3d3b39"}`, background, minHeight: 155, padding: "14px 16px", position: "relative", overflow: "hidden" }}>
      {texture && <div aria-hidden="true" style={{ position: "absolute", inset: 0, opacity: .28, backgroundImage: "repeating-linear-gradient(117deg, transparent 0 7px, rgba(250,246,241,.28) 8px 9px), repeating-linear-gradient(23deg, transparent 0 13px, rgba(41,37,34,.25) 14px 15px), radial-gradient(circle at 20% 25%, #8b8075 0 1px, transparent 2px), radial-gradient(circle at 72% 70%, #aaa094 0 1px, transparent 2px)" }} />}
      <div style={{ position: "relative", height: 106, display: "grid", placeItems: "center" }}><ArchwayCoinMark size={92} /></div>
      <div style={{ position: "relative", borderTop: `1px solid ${background === PAPER ? HAIRLINE : "#4d4a47"}`, paddingTop: 9, color: background === PAPER ? MUTED : "#b3aaa2", fontFamily: MONO, fontSize: 8, letterSpacing: ".12em" }}>{label}</div>
    </div>
  );
}

function FaviconRow({ dark = false }: { dark?: boolean }) {
  return <div style={{ background: dark ? FOUNDARY : PAPER, border: `1px solid ${dark ? "#282c34" : HAIRLINE}`, padding: "12px 18px", display: "flex", alignItems: "end", gap: 24 }}><span style={{ color: dark ? "#aab0b9" : MUTED, fontFamily: MONO, fontSize: 8, letterSpacing: ".12em", marginRight: 8 }}>SAME MASTER</span>{[16, 32, 64].map(size => <div key={size} style={{ textAlign: "center", color: dark ? "#8a909b" : GUIDE, fontFamily: MONO, fontSize: 8 }}><div style={{ height: 70, display: "grid", placeItems: "end center" }}><ArchwayCoinMark size={size} /></div><div style={{ marginTop: 5 }}>{size}px</div></div>)}</div>;
}

export default function BrandUniversalMark() {
  return (
    <main style={{ minHeight: "100dvh", boxSizing: "border-box", background: PAPER, color: INK, padding: "30px 38px 34px", fontFamily: '"Schibsted Grotesk", system-ui, sans-serif' }}>
      <header style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${HAIRLINE}`, paddingBottom: 14, color: MUTED, fontFamily: MONO, fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase" }}><span>ARCANUM BRAND — UNIVERSAL MARK</span><span>PLATE 04 / 04 · MASTER GEOMETRY</span></header>
      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 42, alignItems: "center", padding: "24px 0 22px", borderBottom: `1px solid ${HAIRLINE}` }}>
        <div><div style={{ color: SIGNAL, fontFamily: MONO, fontSize: 9, letterSpacing: ".15em" }}>THE DECISION</div><h1 style={{ margin: "10px 0 13px", color: INK, fontFamily: DISPLAY, fontSize: 42, fontWeight: 500, lineHeight: .98, letterSpacing: "-.035em" }}>One mark.<br />Every surface.</h1><p style={{ maxWidth: 330, margin: 0, color: UMBER, fontSize: 13, lineHeight: 1.5 }}>The coin carries its own ground. A lowered masonry spring, threshold bands, crown joinery, and interior depth lines make the negative space read as a real entrance — never trousers.</p><div style={{ marginTop: 13, color: GUIDE, fontFamily: MONO, fontSize: 8, lineHeight: 1.5, letterSpacing: ".1em" }}>DETAIL SWITCH: 32PX THRESHOLD + KEYSTONE · 48PX DEPTH DATUMS<br />16PX: SIMPLIFIED SILHOUETTE + SIGNAL ONLY</div></div>
        <div style={{ display: "grid", placeItems: "center", minHeight: 228 }}><ArchwayCoinMark size={220} /></div>
      </section>
      <section style={{ padding: "19px 0 21px", borderBottom: `1px solid ${HAIRLINE}` }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}><div style={{ color: MUTED, fontFamily: MONO, fontSize: 9, letterSpacing: ".14em" }}>01 / SIX-GROUND PROOF</div><div style={{ color: GUIDE, fontFamily: MONO, fontSize: 8, letterSpacing: ".11em" }}>IDENTICAL SVG · GATE DETAIL SURVIVES 32PX</div></div><div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}><Ground label="PAPER / #FAF6F1" background={PAPER} /><Ground label="DARK FOUNDRY / #121419" background={FOUNDARY} /><Ground label="INK / #292522" background={INK} /><Ground label="UMBER / #655D56" background={UMBER} /><Ground label="SIGNAL / #FF3C00" background={SIGNAL} /><Ground label="TEXTURE / BUSY DARK" background="#514b47" texture /></div></section>
      <section style={{ paddingTop: 18 }}><div style={{ background: INK, color: PAPER, padding: "17px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}><div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".13em" }}>ONE MARK. NO THEME VARIANTS.</div><div style={{ color: "#e8dfd7", fontFamily: MONO, fontSize: 9, letterSpacing: ".1em" }}>THE COIN CARRIES ITS OWN GROUND.</div></div><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}><div><div style={{ color: MUTED, fontFamily: MONO, fontSize: 9, letterSpacing: ".14em", marginBottom: 8 }}>02 / FAVICON PROOF · LIGHT</div><FaviconRow /></div><div><div style={{ color: MUTED, fontFamily: MONO, fontSize: 9, letterSpacing: ".14em", marginBottom: 8 }}>02 / FAVICON PROOF · DARK</div><FaviconRow dark /></div></div></section>
      <footer style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18, paddingTop: 13, borderTop: `1px solid ${HAIRLINE}`, color: MUTED, fontFamily: MONO, fontSize: 8, letterSpacing: ".12em" }}><span style={{ color: SIGNAL }}>PRINT FALLBACK</span><span>ONLY PERMITTED EXCEPTION: 1-COLOR INK FOR PRINT / ENGRAVING.</span><span style={{ marginLeft: "auto" }}>SOURCE: ARCHWAY COIN / EXACT MASTER SVG</span></footer>
    </main>
  );
}