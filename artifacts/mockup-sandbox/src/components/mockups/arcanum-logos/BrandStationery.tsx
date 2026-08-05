import { ArchwayCoinMark } from "./ArchwayCoinMark";

const PAPER = "#faf6f1";
const INK = "#292522";
const SIGNAL = "#ff3c00";
const UMBER = "#655d56";
const HAIRLINE = "#ded7d0";
const MUTED = "#837a72";
const MONO = '"DM Mono", "IBM Plex Mono", monospace';
const DISPLAY = '"Fraunces", Georgia, serif';
const BODY = '"Schibsted Grotesk", system-ui, sans-serif';

const paperShadow = "0 12px 25px rgba(41,37,34,.10), 0 2px 4px rgba(41,37,34,.08)";
function Meta({ children }: { children: string }) { return <span style={{ color: MUTED, fontFamily: MONO, fontSize: 8, letterSpacing: ".13em", textTransform: "uppercase" }}>{children}</span>; }

function CardFront() {
  return <div style={{ position: "absolute", left: 0, top: 36, width: 360, height: 210, padding: 20, background: PAPER, boxShadow: paperShadow, border: `1px solid ${HAIRLINE}`, zIndex: 2 }}><ArchwayCoinMark size={38} /><div style={{ position: "absolute", left: 20, bottom: 19 }}><div style={{ fontFamily: DISPLAY, fontSize: 18, letterSpacing: "-.02em" }}>TANMAY …</div><Meta>FOUNDER · ARCANUM</Meta></div><div style={{ position: "absolute", right: 20, bottom: 20, textAlign: "right" }}><Meta>tanmay@arcanum.systems</Meta><br /><Meta>ARC TESTNET / 46C</Meta></div></div>;
}
function CardBack() {
  return <div style={{ position: "absolute", left: 115, top: 0, width: 360, height: 210, padding: 20, background: INK, boxShadow: paperShadow, zIndex: 1, display: "grid", placeItems: "center" }}><ArchwayCoinMark size={86} /></div>;
}

export default function BrandStationery() {
  return (
    <main style={{ minHeight: "100dvh", boxSizing: "border-box", background: PAPER, color: INK, padding: "30px 38px 34px", fontFamily: BODY }}>
      <header style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${HAIRLINE}`, paddingBottom: 14, color: MUTED, fontFamily: MONO, fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase" }}><span>ARCANUM BRAND — STATIONERY</span><span>PLATE 03 / 03 · PRINT APPLICATIONS</span></header>
      <section style={{ display: "grid", gridTemplateColumns: "1.35fr 1fr", gap: 44, paddingTop: 30 }}>
        <div><Meta>01 / Business card · front + back</Meta><div style={{ position: "relative", height: 278, marginTop: 14 }}><CardBack /><CardFront /></div><p style={{ margin: 0, color: MUTED, fontFamily: MONO, fontSize: 9, lineHeight: 1.5, letterSpacing: ".08em" }}>85 × 55MM · 350GSM UNCOATED STOCK<br />INK FIELD / REVERSED COIN · 0.5 COIN-W CLEARSPACE</p></div>
        <div><Meta>02 / Letterhead · A4</Meta><div style={{ width: 272, height: 350, marginTop: 14, padding: "19px 20px", background: "#fbf8f4", border: `1px solid ${HAIRLINE}`, boxShadow: paperShadow, display: "flex", flexDirection: "column" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}><ArchwayCoinMark size={35} /><Meta>ARCANUM / 01</Meta></div><div style={{ marginTop: 58, color: UMBER, fontFamily: DISPLAY, fontSize: 18, lineHeight: 1.1 }}>The governed<br />gate, on paper.</div><div style={{ marginTop: "auto", borderTop: `1px solid ${HAIRLINE}`, paddingTop: 8, color: MUTED, fontFamily: MONO, fontSize: 7, letterSpacing: ".12em" }}>ARCANUM.SYSTEMS · FOUNDRY 46C</div></div><p style={{ margin: "12px 0 0", color: MUTED, fontFamily: MONO, fontSize: 9, lineHeight: 1.5, letterSpacing: ".08em" }}>210 × 297MM · 90GSM NATURAL PAPER<br />24PX INNER MARGIN · HAIRLINE FOOTER</p></div>
      </section>
      <section style={{ marginTop: 28, paddingTop: 21, borderTop: `1px solid ${HAIRLINE}`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 34, alignItems: "start" }}>
        <div><Meta>03 / Compliment slip</Meta><div style={{ width: 255, height: 170, marginTop: 13, padding: 18, background: PAPER, border: `1px solid ${HAIRLINE}`, boxShadow: paperShadow, display: "flex", flexDirection: "column", justifyContent: "space-between" }}><div style={{ display: "flex", justifyContent: "space-between" }}><ArchwayCoinMark size={31} /><Meta>WITH COMPLIMENTS</Meta></div><div style={{ fontFamily: DISPLAY, color: INK, fontSize: 22, letterSpacing: "-.03em" }}>Keep the gate.</div><Meta>ARCANUM / GOVERNED SPEND</Meta></div></div>
        <div style={{ alignSelf: "end", paddingBottom: 1 }}><p style={{ margin: 0, color: UMBER, fontFamily: DISPLAY, fontSize: 26, lineHeight: 1.03, letterSpacing: "-.03em" }}>A small mark.<br />A serious threshold.</p><div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 16 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: SIGNAL }} /><Meta>MASTER GEOMETRY / EXACT 46C</Meta></div></div>
      </section>
    </main>
  );
}