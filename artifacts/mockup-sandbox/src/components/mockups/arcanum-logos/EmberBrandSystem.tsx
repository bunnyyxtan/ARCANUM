import EmberMark from "./EmberMark";

const PAPER = "#faf6f1";
const INK = "#292522";
const FOUNDRY = "#1d1a18";
const SIGNAL = "#ff3c00";
const UMBER = "#655d56";
const HAIRLINE = "#ded7d0";
const MUTED = "#837a72";
const MONO = '"IBM Plex Mono", ui-monospace, monospace';
const FRAUNCES = '"Fraunces", Georgia, serif';

function Lockup({ stacked = false, ground = PAPER }: { stacked?: boolean; ground?: string }) {
  const light = ground === PAPER;
  return (
    <div style={{ background: ground, color: light ? INK : PAPER, minHeight: stacked ? 142 : 86, display: "flex", flexDirection: stacked ? "column" : "row", alignItems: "center", justifyContent: "center", gap: stacked ? 10 : 18, padding: 16, boxSizing: "border-box" }}>
      <EmberMark size={stacked ? 58 : 52} />
      <span style={{ fontFamily: FRAUNCES, fontSize: stacked ? 26 : 30, letterSpacing: "-.04em" }}>ARCANUM.</span>
    </div>
  );
}

function Construction() {
  return (
    <section style={{ borderTop: `1px solid ${HAIRLINE}`, padding: "10px 34px 0", display: "grid", gridTemplateColumns: "270px 1fr", gap: 22, minHeight: 220 }}>
      <div style={{ position: "relative" }}>
        <svg viewBox="0 0 260 190" width="260" height="190" role="img" aria-label="Ember master construction drawing" style={{ display: "block" }}>
          <g stroke={HAIRLINE} strokeWidth="1" fill="none" opacity=".75">
            <path d="M12 10V178M36 10V178M60 10V178M84 10V178M108 10V178M132 10V178M156 10V178M180 10V178M204 10V178M228 10V178M252 10V178M12 10H252M12 34H252M12 58H252M12 82H252M12 106H252M12 130H252M12 154H252M12 178H252" />
          </g>
          <g transform="translate(-26,-40) scale(.72)" fill="none" stroke={UMBER} strokeWidth="1" strokeDasharray="4 4"><path d="M132 286V140Q132 88 172 78Q206 69 240 78Q280 88 280 140V286H226L214 258Q206 246 198 258L186 286Z" /><path d="M151 274V144Q151 104 177 96Q206 87 235 96Q261 104 261 144V274H238L222 252Q206 230 190 252L174 274Z" /><path d="M206 84V316M142 200H308M197 219H215V237H197Z" /></g>
          <g fill={MUTED} fontFamily={MONO} fontSize="7" letterSpacing=".5"><text x="138" y="28">148 × 208U KEEP</text><text x="138" y="51">DOWN APERTURE / 40°</text><text x="138" y="74">LINING 9U / BACK 28U</text><text x="138" y="97">FEET 28→20U</text><text x="138" y="120">CORE 18U · BELOW CENTER</text><text x="138" y="164">CLEARSPACE / 1× MARK WIDTH</text></g>
        </svg>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 9, color: MUTED, lineHeight: 1.5, paddingTop: 10 }}>
        <div style={{ color: INK, letterSpacing: ".14em", fontSize: 10, marginBottom: 12 }}>MASTER SPECIFICATION</div>
        <div><span style={{ color: UMBER }}>MARK : GAP : WORDMARK</span><br />HORIZONTAL 1 : 0.35 : 2.9<br />STACKED 1 : 0.20 : 2.4</div>
        <div style={{ marginTop: 14 }}><span style={{ color: UMBER }}>EXCLUSION ZONE</span><br />1× MARK WIDTH on every side; no type, rule, image, or UI control enters the field.</div>
        <div style={{ marginTop: 14 }}><span style={{ color: UMBER }}>MINIMUMS</span><br />MARK 16px · LOCKUP 120px · never redraw or recolor the asset.</div>
      </div>
    </section>
  );
}

export default function EmberBrandSystem() {
  return (
    <main style={{ minHeight: "100dvh", width: "100%", boxSizing: "border-box", background: PAPER, color: INK, padding: "30px 0 22px", fontFamily: MONO }}>
      <header style={{ padding: "0 34px", display: "flex", justifyContent: "space-between", color: MUTED, fontSize: 10, letterSpacing: ".15em" }}><span>ARCANUM BRAND — EMBER SYSTEM</span><span>PLATE 01/04</span></header>
      <section style={{ minHeight: 310, marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", borderTop: `1px solid ${HAIRLINE}`, borderBottom: `1px solid ${HAIRLINE}` }}>
        {[PAPER, FOUNDRY].map((ground, index) => <div key={ground} style={{ background: ground, display: "grid", placeItems: "center" }}><div style={{ display: "flex", alignItems: "center", flexDirection: "column", gap: 12 }}><EmberMark size={210} /><span style={{ color: ground === PAPER ? MUTED : HAIRLINE, fontSize: 8, letterSpacing: ".12em" }}>{index === 0 ? "PAPER GROUND" : "FOUNDRY DARK"} · IDENTICAL ASSET</span></div></div>)}
      </section>
      <section style={{ padding: "15px 34px 12px" }}><div style={{ fontFamily: FRAUNCES, fontSize: 34, letterSpacing: "-.045em" }}>ARCANUM.</div><div style={{ color: MUTED, fontSize: 10, letterSpacing: ".1em", marginTop: 3 }}>THE SYSTEM KEEPS THE SPARK VISIBLE.</div></section>
      <section style={{ padding: "0 34px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: HAIRLINE }}><div><div style={{ background: PAPER, padding: "8px 0", color: MUTED, fontSize: 8, letterSpacing: ".13em", textAlign: "center" }}>HORIZONTAL / 1 : .35 : 2.9</div><Lockup ground={PAPER} /></div><div><div style={{ background: FOUNDRY, padding: "8px 0", color: HAIRLINE, fontSize: 8, letterSpacing: ".13em", textAlign: "center" }}>HORIZONTAL / 1 : .35 : 2.9</div><Lockup ground={FOUNDRY} /></div></section>
      <section style={{ padding: "0 34px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: HAIRLINE }}><div><div style={{ background: PAPER, padding: "8px 0", color: MUTED, fontSize: 8, letterSpacing: ".13em", textAlign: "center" }}>STACKED / 1 : .20 : 2.4</div><Lockup stacked ground={PAPER} /></div><div><div style={{ background: FOUNDRY, padding: "8px 0", color: HAIRLINE, fontSize: 8, letterSpacing: ".13em", textAlign: "center" }}>STACKED / 1 : .20 : 2.4</div><Lockup stacked ground={FOUNDRY} /></div></section>
      <Construction />
      <p style={{ padding: "0 34px", color: MUTED, fontSize: 9, letterSpacing: ".11em", textTransform: "uppercase" }}>ONE EMBER, ONE ASSET — THE GROUND CHANGES; THE MARK DOES NOT.</p>
    </main>
  );
}