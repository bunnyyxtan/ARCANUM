const PAPER = "#faf6f1";
const INK = "#292522";
const SIGNAL = "#ff3c00";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

/**
 * ARCHWAY — KEYSTONE / STUDY 46B
 *
 * Exact 46A geometry, with one restrained craft intervention: a 1.5px
 * paper seam on each side of the 20-unit tapered keystone voussoir. Seams
 * are inset 6 units from the crown and terminate before the curve's tangent
 * break, so they read as joinery at large scale and disappear at 16px.
 * Signal remains at the arch center-of-curvature datum (200,196).
 */
const MONOLITH =
  "M116 86 Q116 84 118 84 H282 Q284 84 284 86 V296 Q284 298 282 298 H238 V220 C238 190 222 174 200 174 C178 174 162 190 162 220 V298 H118 Q116 298 116 296 Z";

function Mark({ construction = false, opacity = 1 }: { construction?: boolean; opacity?: number }) {
  return (
    <g opacity={opacity}>
      {construction ? (
        <>
          <g fill="none" stroke={HAIRLINE} strokeWidth="1"><path d="M92 60V322M116 60V322M140 60V322M164 60V322M188 60V322M212 60V322M236 60V322M260 60V322M284 60V322M308 60V322" /><path d="M92 60H308M92 84H308M92 108H308M92 132H308M92 156H308M92 180H308M92 204H308M92 228H308M92 252H308M92 276H308M92 300H308M92 322H308" /></g>
          <g fill="none" stroke={GUIDE} strokeWidth="1" strokeDasharray="4 5"><rect x="116" y="84" width="168" height="214" /><path d="M162 220H238M200 150V298M162 220C162 190 178 174 200 174C222 174 238 190 238 220" /><path d="M188 183L200 172L212 183" /></g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing=".7"><text x="207" y="76">4:5 BLOCK · 168 × 210</text><text x="207" y="168">20 VOSSIER · SEAMS / 1.5PX</text><text x="87" y="340">SEAM INSET / 6 · SIGNAL / CENTER DATUM</text></g>
        </>
      ) : null}
      <path d={MONOLITH} fill={INK} />
      <path d="M188 183 L200 172 L212 183" fill="none" stroke={PAPER} strokeWidth="1.5" />
      <path d="M192 184 L200 177 L208 184" fill="none" stroke={PAPER} strokeWidth="1" />
      <circle cx="200" cy="196" r="7" fill={SIGNAL} />
    </g>
  );
}

function Mini({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="88 58 224 284" role="img" aria-label={`${size}px keystone`} style={{ width: size, height: size, display: "block" }}><Mark /></svg>;
}

export default function TheArchwayKeystone() {
  return (
    <main style={{ minHeight: "100dvh", boxSizing: "border-box", background: PAPER, color: INK, padding: "27px 30px", display: "flex", flexDirection: "column", fontFamily: MONO }}>
      <header style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", color: META, fontSize: 10, lineHeight: 1.2, letterSpacing: ".14em", textTransform: "uppercase" }}><span>ARCANUM — STUDY 46B</span><span>ARCHWAY — KEYSTONE</span></header>
      <section style={{ flex: "1 1 auto", minHeight: 370, display: "grid", placeItems: "center", padding: "12px 0" }} aria-label="Finished keystone"><svg viewBox="88 58 224 284" width="360" height="400" role="img" aria-label="Archway with quiet keystone seams" style={{ width: "min(360px, 78vw)", height: "auto", display: "block" }}><Mark /></svg></section>
      <section style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 10, width: "100%", maxWidth: 640, margin: "0 auto" }} aria-label="Keystone construction"><svg viewBox="0 0 640 180" width="100%" height="170" role="img" aria-label="Keystone seam construction" style={{ display: "block" }}><g transform="translate(180,-48) scale(.7)"><Mark construction opacity={.42} /></g></svg></section>
      <section style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 38, paddingTop: 2 }} aria-label="Small size proof">{[64, 32, 16].map(size => <figure key={size} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><Mini size={size} /><figcaption style={{ color: GUIDE, fontSize: 8 }}>{size}</figcaption></figure>)}</section>
      <p style={{ width: "100%", maxWidth: 640, margin: "8px auto 0", color: GUIDE, fontSize: 9, lineHeight: 1.35, letterSpacing: ".12em", textTransform: "uppercase" }}>ONE QUIET JOINT MARKS THE TRUST THAT HOLDS THE GATE.</p>
    </main>
  );
}