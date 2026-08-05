const PAPER = "#faf6f1";
const INK = "#292522";
const SIGNAL = "#ff3c00";
const UMBER = "#655d56";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

/**
 * THE TETHER / STUDY 28C
 * M=24. Agent disc D=176, human disc D=64. Centers are 200px apart.
 * Covenant bar = 16px (2M/3), exactly 0.091× agent diameter; its endpoints
 * terminate 8px inside each circle, so the tether is visibly integrated.
 * Optical correction: the bar is lifted 2px above the mathematical axis to
 * counter the downward pull of the larger disc; horizontal bar weight is
 * 5% lighter than the disc's perceived weight.
 */

function TetherMark({ construction = false, opacity = 1 }: { construction?: boolean; opacity?: number }) {
  return <g opacity={opacity}>
    {construction ? <><g fill="none" stroke={HAIRLINE} strokeWidth="1"><circle cx="130" cy="200" r="88" /><circle cx="330" cy="200" r="32" /><path d="M42 200H362M130 100V300M330 160V240" /></g><g fill="none" stroke={GUIDE} strokeWidth="1" strokeDasharray="4 5"><path d="M130 224H330" /><path d="M138 194H322" /></g><g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing="0.7"><text x="210" y="187">CENTER DISTANCE / 200</text><text x="210" y="204">TETHER / 16</text><text x="64" y="326">AGENT Ø176 · HUMAN Ø64</text></g></> : null}
    <circle cx="130" cy="200" r="88" fill={INK} />
    <path d="M138 198H322" stroke={INK} strokeWidth="16" strokeLinecap="butt" />
    <circle cx="330" cy="200" r="32" fill={SIGNAL} />
  </g>;
}

function Mini({ size }: { size: number }) { return <svg width={size} height={size} viewBox="35 90 390 220" role="img" aria-label={`${size}px tether`} style={{ width: size, height: size, display: "block" }}><TetherMark /></svg>; }

export default function TheTether() {
  return <main style={{ minHeight: "100dvh", width: "100%", boxSizing: "border-box", background: PAPER, color: INK, padding: "27px 30px", display: "flex", flexDirection: "column", fontFamily: MONO }}>
    <header style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", color: META, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}><span>ARCANUM — STUDY 28C</span><span>THE TETHER</span></header>
    <section style={{ flex: "1 1 auto", minHeight: 370, display: "grid", placeItems: "center", padding: "12px 0" }}><svg viewBox="25 90 410 220" width="390" height="300" role="img" aria-label="Separate agent and human discs bound by one covenant bar" style={{ width: "min(390px, 80vw)", height: "auto" }}><TetherMark /></svg></section>
    <section style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 10, width: "100%", maxWidth: 640, margin: "0 auto" }}><svg viewBox="0 0 640 180" width="100%" height="170" role="img" aria-label="Tether construction"><g transform="translate(48,-48) scale(.82)"><TetherMark construction opacity={0.42} /></g></svg></section>
    <section style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 38, paddingTop: 2 }}>{[64,32,16].map(size => <figure key={size} style={{ margin: 0, textAlign: "center" }}><Mini size={size} /><figcaption style={{ color: GUIDE, fontSize: 8 }}>{size}</figcaption></figure>)}</section>
    <p style={{ maxWidth: 640, width: "100%", margin: "8px auto 0", color: GUIDE, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase" }}>AUTONOMY AT ARM'S LENGTH. THE COVENANT LINE NEVER BREAKS.</p>
  </main>;
}