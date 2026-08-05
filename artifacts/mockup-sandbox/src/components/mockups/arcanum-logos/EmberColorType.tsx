import EmberMark from "./EmberMark";

const PAPER = "#faf6f1";
const INK = "#292522";
const UMBER = "#655d56";
const SIGNAL = "#ff3c00";
const HAIRLINE = "#ded7d0";
const MUTED = "#837a72";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";
const GROTESK = '"Schibsted Grotesk", ui-sans-serif, system-ui, sans-serif';
const DISPLAY = 'Fraunces, Georgia, serif';

function Swatch({ name, hex, role, color }: { name: string; hex: string; role: string; color: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: 10, alignItems: "center" }}>
      <span style={{ width: 36, height: 36, background: color, border: `1px solid ${color === PAPER ? HAIRLINE : "transparent"}`, display: "block" }} />
      <div>
        <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".12em" }}>{name} <span style={{ color: MUTED }}>{hex}</span></div>
        <div style={{ fontFamily: GROTESK, fontSize: 10, color: MUTED, marginTop: 2 }}>{role}</div>
      </div>
    </div>
  );
}

export default function EmberColorType() {
  return (
    <main style={{ minHeight: "100dvh", boxSizing: "border-box", background: PAPER, color: INK, padding: "30px 34px", fontFamily: GROTESK }}>
      <header style={{ maxWidth: 880, margin: "0 auto", display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 10, letterSpacing: ".14em", color: MUTED }}>
        <span>ARCANUM BRAND — COLOR + TYPE</span><span>PLATE 03/04</span>
      </header>
      <div style={{ maxWidth: 880, margin: "32px auto 0", display: "grid", gridTemplateColumns: "250px 1fr", gap: 52, alignItems: "center" }}>
        <div style={{ border: `1px solid ${HAIRLINE}`, padding: 18, background: PAPER }}>
          <EmberMark size={210} />
          <div style={{ marginTop: 12, fontFamily: MONO, fontSize: 9, color: MUTED, lineHeight: 1.55 }}>LOCKED ASSET / 148 × 208U KEEP<br />40° DOWNWARD APERTURE<br />ONE SIGNAL DATUM / 18U</div>
        </div>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10, color: SIGNAL, letterSpacing: ".16em" }}>WARM LEDGER / PALETTE ARCHITECTURE</div>
          <h1 style={{ fontFamily: DISPLAY, fontSize: 57, lineHeight: .95, fontWeight: 500, margin: "12px 0 16px", letterSpacing: "-.045em" }}>A mark that<br />keeps the spark.</h1>
          <p style={{ maxWidth: 440, color: UMBER, fontSize: 13, lineHeight: 1.55, margin: 0 }}>The Ember is the only live signal in the system. Everything else is structure: readable, quiet, and accountable.</p>
        </div>
      </div>
      <section style={{ maxWidth: 880, margin: "46px auto 0", borderTop: `1px solid ${HAIRLINE}`, paddingTop: 18 }}>
        <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".14em", color: MUTED, marginBottom: 16 }}>01 / COLOR ROLES · HEX VALUES ARE FIXED</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 18 }}>
          <Swatch name="INK" hex="#292522" role="primary structure / text" color={INK} />
          <Swatch name="PAPER" hex="#faf6f1" role="field / counterform / lining" color={PAPER} />
          <Swatch name="UMBER" hex="#655d56" role="annotation / secondary text" color={UMBER} />
          <Swatch name="SIGNAL" hex="#ff3c00" role="one focal datum only" color={SIGNAL} />
        </div>
      </section>
      <section style={{ maxWidth: 880, margin: "34px auto 0", borderTop: `1px solid ${HAIRLINE}`, paddingTop: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 60 }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".14em", color: MUTED }}>02 / TYPE SYSTEM</div>
          <div style={{ marginTop: 18, fontFamily: DISPLAY, fontSize: 39, lineHeight: 1 }}>Fraunces <span style={{ color: UMBER, fontSize: 14 }}>display / editorial</span></div>
          <div style={{ marginTop: 22, fontFamily: GROTESK, fontSize: 25 }}>Schibsted Grotesk <span style={{ color: UMBER, fontSize: 12 }}>UI / policy</span></div>
          <div style={{ marginTop: 22, fontFamily: MONO, fontSize: 17 }}>IBM Plex Mono <span style={{ color: UMBER, fontSize: 11 }}>data / dimensions</span></div>
        </div>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".14em", color: MUTED }}>03 / SIGNAL BEHAVIOUR</div>
          <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 12 }}><span style={{ width: 10, height: 10, background: SIGNAL, display: "block" }} /><span style={{ fontSize: 13 }}>ONE orange point. Never a wash, gradient, or accent field.</span></div>
          <div style={{ marginTop: 20, padding: "14px 16px", borderLeft: `2px solid ${SIGNAL}`, background: "#f1ebe4", fontSize: 12, lineHeight: 1.5, color: UMBER }}>The orange core is always the smallest focal element. If two signals compete, one of them is wrong.</div>
        </div>
      </section>
      <p style={{ maxWidth: 880, margin: "38px auto 0", fontFamily: MONO, fontSize: 9, color: MUTED, letterSpacing: ".1em", textTransform: "uppercase" }}>Warm Ledger is not decoration. It is a visual policy: structure holds, paper explains, one signal moves.</p>
    </main>
  );
}