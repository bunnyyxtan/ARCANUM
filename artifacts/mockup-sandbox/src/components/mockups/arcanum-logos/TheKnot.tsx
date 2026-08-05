const PAPER = "#faf6f1";
const INK = "#292522";
const SIGNAL = "#ff3c00";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

/**
 * THE KNOT / STUDY 48
 *
 * A single closed band, 20px wide on an M=20 nautical diagram grid. Its
 * paired cubic lobes make an overhand/carrick-like lock without ornament.
 * Crossings use deliberate 9px paper lifts: the gap is a construction rule,
 * not a shadow. Optical correction: the upper lobe is pulled 3px inward to
 * keep the center void visually centered once the lower crossing is lifted.
 */
const KNOT = "M102 145 C137 113 177 126 200 166 C223 126 263 113 298 145 C327 172 315 207 283 218 C250 229 223 206 200 181 C177 206 150 229 117 218 C85 207 73 172 102 145 Z";

function Mark({ construction = false, opacity = 1 }: { construction?: boolean; opacity?: number }) {
  return (
    <g opacity={opacity}>
      {construction ? (
        <>
          <g fill="none" stroke={HAIRLINE} strokeWidth="1">
            <path d="M80 80V320M100 80V320M120 80V320M140 80V320M160 80V320M180 80V320M200 80V320M220 80V320M240 80V320M260 80V320M280 80V320M300 80V320M320 80V320" />
            <path d="M80 80H320M80 100H320M80 120H320M80 140H320M80 160H320M80 180H320M80 200H320M80 220H320M80 240H320M80 260H320M80 280H320M80 300H320M80 320H320" />
          </g>
          <g fill="none" stroke={GUIDE} strokeWidth="1" strokeDasharray="4 5">
            <path d="M102 145C137 113 177 126 200 166C223 126 263 113 298 145" />
            <path d="M117 218C150 229 177 206 200 181C223 206 250 229 283 218" />
            <path d="M200 120V250M90 200H310" />
          </g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing=".7">
            <text x="205" y="106">20M BAND · 9PX LIFT</text>
            <text x="205" y="264">CENTER VOID / 1.4M</text>
            <text x="82" y="340">ONE CLOSED PATH · CROSSINGS DECLARED, NOT DECORATED</text>
          </g>
        </>
      ) : null}
      <path d={KNOT} fill="none" stroke={INK} strokeWidth="20" strokeLinecap="round" strokeLinejoin="round" />
      {/* Crossing lifts keep the topology legible while preserving one band. */}
      <path d="M184 154L216 178" stroke={PAPER} strokeWidth="9" strokeLinecap="butt" />
      <path d="M184 222L216 198" stroke={PAPER} strokeWidth="9" strokeLinecap="butt" />
      <circle cx="200" cy="190" r="6.5" fill={SIGNAL} />
    </g>
  );
}

function Mini({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="68 92 264 170" role="img" aria-label={`${size}px knot`} style={{ width: size, height: size, display: "block" }}><Mark /></svg>;
}

export default function TheKnot() {
  return (
    <main style={{ minHeight: "100dvh", boxSizing: "border-box", background: PAPER, color: INK, padding: "27px 30px", display: "flex", flexDirection: "column", fontFamily: MONO }}>
      <header style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", color: META, fontSize: 10, lineHeight: 1.2, letterSpacing: ".14em", textTransform: "uppercase" }}><span>ARCANUM — STUDY 48/55</span><span>THE KNOT</span></header>
      <section style={{ flex: "1 1 auto", minHeight: 370, display: "grid", placeItems: "center", padding: "12px 0" }} aria-label="Finished knot"><svg viewBox="68 92 264 170" width="380" height="280" role="img" aria-label="Single continuous band knot" style={{ width: "min(380px, 84vw)", height: "auto", display: "block" }}><Mark /></svg></section>
      <section style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 10, width: "100%", maxWidth: 640, margin: "0 auto" }} aria-label="Knot construction"><svg viewBox="0 0 640 180" width="100%" height="170" role="img" aria-label="Knot nautical construction" style={{ display: "block" }}><g transform="translate(180,-48) scale(.7)"><Mark construction opacity={.42} /></g></svg></section>
      <section style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 38, paddingTop: 2 }} aria-label="Small size proof">{[64, 32, 16].map(size => <figure key={size} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><Mini size={size} /><figcaption style={{ color: GUIDE, fontSize: 8 }}>{size}</figcaption></figure>)}</section>
      <p style={{ width: "100%", maxWidth: 640, margin: "8px auto 0", color: GUIDE, fontSize: 9, lineHeight: 1.35, letterSpacing: ".12em", textTransform: "uppercase" }}>ONE BAND, TWO CROSSINGS, NO LOOSE END — AGREEMENT HOLDS.</p>
    </main>
  );
}