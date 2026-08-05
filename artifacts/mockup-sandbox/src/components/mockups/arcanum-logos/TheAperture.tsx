const PAPER = "#faf6f1";
const INK = "#292522";
const FOUNDRY = "#1d1a18";
const SIGNAL = "#ff3c00";
const UMBER = "#655d56";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = '"DM Mono", "IBM Plex Mono", monospace';

/**
 * THE APERTURE / STUDY 61/63
 *
 * Two concentric rounded forms, engineered as an 8M × 8M aperture. The
 * outer foundry ring is 1.25M thick, with a .8M corner radius. Its base is
 * deliberately a 3.5M flattened chord, lifted .35M above the circular datum:
 * that ownership cue keeps this from becoming a generic donut.
 * The inner PAPER core is 5.5M × 5.5M, radius 1.15M. Both fields are baked
 * into the mark: the same SVG is placed on paper and foundry dark grounds.
 * The one .38M signal point sits dead center and is always the smallest
 * focal element. Hairline containment is 0.08M / 2px.
 *
 * Squint checks: not a coin, eye, target, ring, arch, shield, seal, letter,
 * or keyhole. The flattened base and rounded-square opening read as a
 * controlled vault aperture. At 16px the ink wall, paper core, flat datum,
 * and signal remain. One-color engraving drops signal and uses the wall/core.
 */
const OUTER = "M200 52 C282 52 332 108 332 176 C332 194 326 211 314 224 L86 224 C74 211 68 194 68 176 C68 108 118 52 200 52 Z";
const CORE = "M200 96 C244 96 274 126 274 166 C274 180 270 190 263 198 H137 C130 190 126 180 126 166 C126 126 156 96 200 96 Z";

function Mark({ construction = false, opacity = 1, small = false }: { construction?: boolean; opacity?: number; small?: boolean }) {
  return (
    <g opacity={opacity}>
      {construction ? (
        <>
          <g fill="none" stroke={HAIRLINE} strokeWidth="1">
            <path d="M52 36V244M68 36V244M84 36V244M100 36V244M116 36V244M132 36V244M148 36V244M164 36V244M180 36V244M196 36V244M212 36V244M228 36V244M244 36V244M260 36V244M276 36V244M292 36V244M308 36V244M324 36V244M340 36V244" />
            <path d="M52 36H340M52 52H340M52 68H340M52 84H340M52 100H340M52 116H340M52 132H340M52 148H340M52 164H340M52 180H340M52 196H340M52 212H340M52 228H340M52 244H340" />
          </g>
          <g fill="none" stroke={UMBER} strokeWidth="1" strokeDasharray="4 5">
            <path d={OUTER} />
            <path d={CORE} />
            <circle cx="200" cy="166" r="2" />
            <path d="M68 224H332M200 36V244" />
          </g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing=".7">
            <text x="202" y="47">OUTER / 8M · R .8M · WALL 1.25M</text>
            <text x="202" y="91">CORE / 5.5M · R 1.15M</text>
            <text x="202" y="238">FLAT CHORD / 3.5M · +.35M · SIGNAL / .38M</text>
          </g>
        </>
      ) : null}
      <path d={OUTER} fill={INK} stroke={HAIRLINE} strokeWidth="2" />
      <path d={CORE} fill={PAPER} stroke={HAIRLINE} strokeWidth="2" />
      <circle cx="200" cy="166" r={small ? 6 : 7} fill={SIGNAL} />
    </g>
  );
}

function MarkSvg({ size, ground }: { size: number; ground: string }) {
  return (
    <div style={{ width: size, height: size, display: "grid", placeItems: "center", background: ground }}>
      <svg viewBox="54 38 292 210" width={size} height={size} role="img" aria-label={`${size}px aperture mark`} style={{ width: size, height: size, display: "block" }}>
        <Mark small={size < 32} />
      </svg>
    </div>
  );
}

function Construction() {
  return (
    <section style={{ borderTop: `1px solid ${HAIRLINE}`, padding: "9px 30px 0", background: PAPER }}>
      <svg viewBox="0 0 700 164" width="100%" height="164" role="img" aria-label="Aperture module grid and flattened chord construction" style={{ display: "block" }}>
        <g transform="translate(218,-42) scale(.7)">
          <Mark construction opacity={0.52} />
        </g>
      </svg>
    </section>
  );
}

function ProofRow() {
  return (
    <section style={{ padding: "4px 30px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: HAIRLINE }} aria-label="Theme proof at small sizes">
      {[[PAPER, "PAPER GROUND"], [FOUNDRY, "FOUNDRY DARK"]].map(([ground, label]) => (
        <div key={label} style={{ minHeight: 94, background: ground, display: "flex", alignItems: "center", justifyContent: "center", gap: 27, position: "relative" }}>
          {[64, 32, 16].map(size => <figure key={size} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><MarkSvg size={size} ground={ground} /><figcaption style={{ color: ground === PAPER ? GUIDE : HAIRLINE, fontSize: 8 }}>{size}</figcaption></figure>)}
          <span style={{ position: "absolute", left: 9, top: 7, color: ground === PAPER ? META : HAIRLINE, fontSize: 8, letterSpacing: ".12em" }}>{label}</span>
        </div>
      ))}
    </section>
  );
}

export default function TheAperture() {
  return (
    <main style={{ minHeight: "100dvh", boxSizing: "border-box", background: PAPER, color: INK, padding: "27px 0 14px", display: "flex", flexDirection: "column", fontFamily: MONO }}>
      <header style={{ width: "100%", padding: "0 30px", boxSizing: "border-box", display: "flex", justifyContent: "space-between", color: META, fontSize: 10, lineHeight: 1.2, letterSpacing: ".14em", textTransform: "uppercase" }}><span>ARCANUM — STUDY 61/63</span><span>THE APERTURE</span></header>
      <section style={{ flex: "1 1 auto", minHeight: 365, marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: HAIRLINE }} aria-label="Identical aperture mark on light and dark grounds">
        {[PAPER, FOUNDRY].map((ground, index) => <div key={ground} style={{ minHeight: 365, background: ground, display: "grid", placeItems: "center" }}><svg viewBox="54 38 292 210" width="300" height="300" role="img" aria-label={`Aperture mark on ${index === 0 ? "paper" : "foundry dark"} ground`} style={{ width: "min(300px, 40vw)", height: "min(300px, 40vw)", display: "block" }}><Mark /></svg></div>)}
      </section>
      <Construction />
      <ProofRow />
      <p style={{ padding: "8px 30px 0", margin: 0, color: GUIDE, fontSize: 9, lineHeight: 1.35, letterSpacing: ".12em", textTransform: "uppercase" }}>A CONTROLLED OPENING FOR POLICY: THE SAME APERTURE HOLDS ITS CONTRAST IN EITHER THEME.</p>
    </main>
  );
}