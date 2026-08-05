import EmberMark from "./EmberMark";

const PAPER = "#faf6f1";
const INK = "#292522";
const FOUNDRY = "#1d1a18";
const SIGNAL = "#ff3c00";
const HAIRLINE = "#ded7d0";
const MUTED = "#837a72";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";
const DISPLAY = 'Fraunces, Georgia, serif';

function TinyProof({ size, dark = false }: { size: number; dark?: boolean }) {
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 4 }}>
      <div style={{ width: size + 18, height: size + 18, background: dark ? FOUNDRY : PAPER, display: "grid", placeItems: "center", border: `1px solid ${dark ? "#332e2a" : HAIRLINE}` }}><EmberMark size={size} /></div>
      <span style={{ fontFamily: MONO, fontSize: 8, color: MUTED }}>{size}</span>
    </div>
  );
}

function Browser({ dark = false }: { dark?: boolean }) {
  return (
    <div style={{ width: 220, border: `1px solid ${dark ? "#514842" : HAIRLINE}`, background: dark ? FOUNDRY : PAPER, color: dark ? PAPER : INK }}>
      <div style={{ height: 20, borderBottom: `1px solid ${dark ? "#514842" : HAIRLINE}`, padding: "0 8px", display: "flex", gap: 4, alignItems: "center" }}><i style={{ width: 5, height: 5, borderRadius: "50%", background: SIGNAL }} /><i style={{ width: 5, height: 5, borderRadius: "50%", background: dark ? "#837a72" : "#c9c0b7" }} /><span style={{ marginLeft: 6, fontFamily: MONO, fontSize: 7, color: MUTED }}>thearcanum.in</span></div>
      <div style={{ height: 108, display: "grid", placeItems: "center" }}><EmberMark size={68} /></div>
    </div>
  );
}

export default function EmberDigitalKit() {
  return (
    <main style={{ minHeight: "100dvh", boxSizing: "border-box", background: PAPER, color: INK, padding: "30px 34px", fontFamily: '"Schibsted Grotesk", ui-sans-serif, system-ui, sans-serif' }}>
      <header style={{ maxWidth: 880, margin: "0 auto", display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 10, letterSpacing: ".14em", color: MUTED }}>
        <span>ARCANUM BRAND — DIGITAL KIT</span><span>PLATE 04/04</span>
      </header>
      <section style={{ maxWidth: 880, margin: "32px auto 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ minHeight: 290, background: PAPER, border: `1px solid ${HAIRLINE}`, display: "grid", placeItems: "center" }}><EmberMark size={240} /></div>
        <div style={{ minHeight: 290, background: FOUNDRY, display: "grid", placeItems: "center" }}><EmberMark size={240} /></div>
      </section>
      <div style={{ maxWidth: 880, margin: "8px auto 0", display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 8, color: MUTED, letterSpacing: ".12em" }}><span>LIGHT FIELD / EXACT ASSET</span><span>DARK FIELD / EXACT ASSET</span></div>
      <section style={{ maxWidth: 880, margin: "30px auto 0", borderTop: `1px solid ${HAIRLINE}`, paddingTop: 16 }}>
        <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: ".14em" }}>01 / FAVICON ROW · SAME SVG, SAME COLORS</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-around", alignItems: "end" }}>{[16, 32, 64, 180].map(size => <TinyProof key={size} size={size} />)}</div>
          <div style={{ background: FOUNDRY, display: "flex", justifyContent: "space-around", alignItems: "end" }}>{[16, 32, 64, 180].map(size => <TinyProof key={size} size={size} dark />)}</div>
        </div>
      </section>
      <section style={{ maxWidth: 880, margin: "28px auto 0", borderTop: `1px solid ${HAIRLINE}`, paddingTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 38 }}>
        <div><div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: ".14em" }}>02 / BROWSER TAB LOCKUP</div><div style={{ display: "flex", gap: 14, marginTop: 14 }}><Browser /><Browser dark /></div></div>
        <div><div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: ".14em" }}>03 / APP HEADER LOCKUP</div><div style={{ marginTop: 14, height: 58, background: FOUNDRY, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", color: PAPER }}><EmberMark size={29} /><span style={{ fontFamily: DISPLAY, fontSize: 21 }}>ARCANUM</span><span style={{ marginLeft: "auto", fontFamily: MONO, fontSize: 8, color: "#a99f97" }}>ARC TESTNET</span></div><div style={{ marginTop: 7, fontFamily: MONO, fontSize: 8, color: MUTED }}>MARK 29U · WORDMARK 21PX · GAP 8U</div></div>
      </section>
      <section style={{ maxWidth: 880, margin: "28px auto 0", background: FOUNDRY, color: PAPER, minHeight: 155, padding: "18px 24px", display: "grid", gridTemplateColumns: "130px 1fr", alignItems: "center" }}>
        <EmberMark size={110} />
        <div><div style={{ fontFamily: DISPLAY, fontSize: 33 }}>ARCANUM</div><div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".12em", color: "#aaa19a", marginTop: 5 }}>MONEY WITH A POLICY LAYER.</div><div style={{ fontFamily: MONO, fontSize: 8, color: "#716861", marginTop: 20 }}>OG / 1200 × 630 · FOUNDRY FIELD · SINGLE EMBER ASSET</div></div>
      </section>
    </main>
  );
}