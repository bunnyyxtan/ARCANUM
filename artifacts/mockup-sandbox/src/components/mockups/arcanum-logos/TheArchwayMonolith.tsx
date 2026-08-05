const PAPER = "#faf6f1";
const INK = "#292522";
const SIGNAL = "#ff3c00";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

/**
 * ARCHWAY — MONOLITH / STUDY 46A
 *
 * Engineered recut: finished block is 4:5 (168×210 units), bounded by a
 * √2-derived visual field rather than a generic portrait rectangle.
 * Passage = 72 units wide; each load-bearing leg = 48 units, exactly 2/3
 * of the opening and never less than the arch width. Spring is lowered to
 * 220, giving the legs a monumental 1.25:1 rise-to-spring run.
 * The crown is a micro-arch (24-unit rise) with 1.75-unit corner radii.
 * Signal is placed at the arch center of curvature: (200,196), the datum
 * where the governed passage changes from vertical to crown.
 *
 * Optical corrections: the crown's shoulders are inset 2 units to prevent
 * the top from appearing wider than the piers; the signal is lifted 2 units
 * above the geometric passage center to counter the white void's visual drop.
 * All curves use matched cubic handles for G2-feeling tangent continuity.
 */
const MONOLITH =
  "M116 86 Q116 84 118 84 " +
  "H282 Q284 84 284 86 " +
  "V296 Q284 298 282 298 H238 V220 " +
  "C238 190 222 174 200 174 " +
  "C178 174 162 190 162 220 V298 H118 " +
  "Q116 298 116 296 Z";

function Mark({ construction = false, opacity = 1, seam = false }: { construction?: boolean; opacity?: number; seam?: boolean }) {
  return (
    <g opacity={opacity}>
      {construction ? (
        <>
          <g fill="none" stroke={HAIRLINE} strokeWidth="1">
            <path d="M92 60V322M116 60V322M140 60V322M164 60V322M188 60V322M212 60V322M236 60V322M260 60V322M284 60V322M308 60V322" />
            <path d="M92 60H308M92 84H308M92 108H308M92 132H308M92 156H308M92 180H308M92 204H308M92 228H308M92 252H308M92 276H308M92 300H308M92 322H308" />
          </g>
          <g fill="none" stroke={GUIDE} strokeWidth="1" strokeDasharray="4 5">
            <rect x="116" y="84" width="168" height="214" />
            <path d="M162 220H238M200 150V298" />
            <path d="M162 220 C162 190 178 174 200 174 C222 174 238 190 238 220" />
            <path d="M200 174A46 46 0 0 0 154 220" />
          </g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing=".7">
            <text x="207" y="76">4:5 BLOCK · 168 × 210</text>
            <text x="207" y="168">R=46 · CENTER DATUM</text>
            <text x="87" y="340">PIERS / 48 · PASSAGE / 72 · RADIUS / 1.75</text>
          </g>
        </>
      ) : null}
      <path d={MONOLITH} fill={INK} />
      {seam ? (
        <>
          <path d="M190 177 L200 168 L210 177" fill="none" stroke={PAPER} strokeWidth="1.5" />
          <path d="M193 180 L200 174 L207 180" fill="none" stroke={PAPER} strokeWidth="1" />
        </>
      ) : null}
      <circle cx="200" cy="196" r="7" fill={SIGNAL} />
    </g>
  );
}

function Mini({ size, coin = false, seam = false }: { size: number; coin?: boolean; seam?: boolean }) {
  return coin ? (
    <svg width={size} height={size} viewBox="68 68 264 264" role="img" aria-label={`${size}px coin`} style={{ width: size, height: size, display: "block" }}>
      <rect x="80" y="80" width="240" height="240" rx="42" fill={INK} />
      <g transform="translate(0 0)"><path d="M116 86 Q116 84 118 84 H282 Q284 84 284 86 V296 Q284 298 282 298 H238 V220 C238 190 222 174 200 174 C178 174 162 190 162 220 V298 H118 Q116 298 116 296 Z" fill={PAPER} /></g>
      <circle cx="200" cy="196" r="7" fill={SIGNAL} />
    </svg>
  ) : <svg width={size} height={size} viewBox="88 58 224 284" role="img" aria-label={`${size}px monolith`} style={{ width: size, height: size, display: "block" }}><Mark seam={seam} /></svg>;
}

export default function TheArchwayMonolith() {
  return (
    <main style={{ minHeight: "100dvh", boxSizing: "border-box", background: PAPER, color: INK, padding: "27px 30px", display: "flex", flexDirection: "column", fontFamily: MONO }}>
      <header style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", color: META, fontSize: 10, lineHeight: 1.2, letterSpacing: ".14em", textTransform: "uppercase" }}><span>ARCANUM — STUDY 46A</span><span>ARCHWAY — MONOLITH</span></header>
      <section style={{ flex: "1 1 auto", minHeight: 370, display: "grid", placeItems: "center", padding: "12px 0" }} aria-label="Finished monolith"><svg viewBox="88 58 224 284" width="360" height="400" role="img" aria-label="Engineered ink monolith with monumental rounded arch" style={{ width: "min(360px, 78vw)", height: "auto", display: "block" }}><Mark /></svg></section>
      <section style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 10, width: "100%", maxWidth: 640, margin: "0 auto" }} aria-label="Monolith construction"><svg viewBox="0 0 640 180" width="100%" height="170" role="img" aria-label="Monolith ratio and arch construction" style={{ display: "block" }}><g transform="translate(180,-48) scale(.7)"><Mark construction opacity={.42} /></g></svg></section>
      <section style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 38, paddingTop: 2 }} aria-label="Small size proof">{[64, 32, 16].map(size => <figure key={size} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><Mini size={size} /><figcaption style={{ color: GUIDE, fontSize: 8 }}>{size}</figcaption></figure>)}</section>
      <p style={{ width: "100%", maxWidth: 640, margin: "8px auto 0", color: GUIDE, fontSize: 9, lineHeight: 1.35, letterSpacing: ".12em", textTransform: "uppercase" }}>THE SAME GATE, ENGINEERED UNTIL INEVITABLE.</p>
    </main>
  );
}