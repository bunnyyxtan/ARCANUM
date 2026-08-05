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
 * THE COUNTERCHANGE / STUDY 60/63
 *
 * A single 8M × 8M rounded field, with 0.55M corner radii and a 31° stepped
 * ledger divide. The divide is deliberately diagonal, but its two short
 * 4px landings keep it from reading as a slash or a letterform. The lower
 * field is permanently PAPER and the upper field permanently INK; the mark
 * never recolors itself for a theme.
 *
 * The containment stroke is 0.08M / 2px at the 300px hero size. It uses
 * #ded7d0 only where PAPER meets a PAPER ground, so the paper field does not
 * vanish. It is the same stroke on the dark half: no theme-specific redraw.
 * The one 0.45M signal point is centered exactly on the divide, with its
 * center 0.06M into the upper field: smallest element, highest consequence.
 *
 * Squint checks: not a shield, coin, arch, seal, bracket, signet, ingot,
 * balance, letter, flag, or split monogram. The squared landings and equal
 * fields make it read as a controlled counterchange plate, not a heraldic
 * badge. At 16px the two-tone body, dividing line, and signal survive; for
 * one-color engraving the paper field becomes substrate and the signal drops.
 */
const FIELD =
  "M104 72 Q104 64 112 64 H288 Q296 64 296 72 " +
  "V248 Q296 256 288 256 H112 Q104 256 104 248 Z";
const DIVIDE = "M92 137 H108 L292 240 H308";
const PAPER_FIELD = "M104 137 H108 L292 240 H296 V248 Q296 256 288 256 H112 Q104 256 104 248 Z";
const SIGNAL_X = 198;
const SIGNAL_Y = 197;

function Mark({ construction = false, opacity = 1, small = false }: { construction?: boolean; opacity?: number; small?: boolean }) {
  return (
    <g opacity={opacity}>
      {construction ? (
        <>
          <g fill="none" stroke={HAIRLINE} strokeWidth="1">
            <path d="M64 48V272M80 48V272M96 48V272M112 48V272M128 48V272M144 48V272M160 48V272M176 48V272M192 48V272M208 48V272M224 48V272M240 48V272M256 48V272M272 48V272M288 48V272M304 48V272M320 48V272" />
            <path d="M64 48H320M64 64H320M64 80H320M64 96H320M64 112H320M64 128H320M64 144H320M64 160H320M64 176H320M64 192H320M64 208H320M64 224H320M64 240H320M64 256H320M64 272H320" />
          </g>
          <g fill="none" stroke={UMBER} strokeWidth="1" strokeDasharray="4 5">
            <path d={FIELD} />
            <path d={DIVIDE} />
            <path d="M104 64H296M104 256H296M200 48V272" />
          </g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing=".7">
            <text x="202" y="56">8M × 8M · R .55M</text>
            <text x="202" y="132">DIVIDE / 31° · LANDINGS 0.2M</text>
            <text x="202" y="269">CONTAINMENT / .08M · SIGNAL / .45M</text>
          </g>
        </>
      ) : null}
      <path d={FIELD} fill={INK} stroke={HAIRLINE} strokeWidth="2" />
      <path d={PAPER_FIELD} fill={PAPER} stroke={HAIRLINE} strokeWidth="2" />
      {!small ? <path d={DIVIDE} fill="none" stroke={HAIRLINE} strokeWidth="2" /> : null}
      <circle cx={SIGNAL_X} cy={SIGNAL_Y} r={small ? 6 : 7} fill={SIGNAL} />
    </g>
  );
}

function MarkSvg({ size, ground }: { size: number; ground: string }) {
  return (
    <div style={{ width: size, height: size, display: "grid", placeItems: "center", background: ground }}>
      <svg viewBox="78 42 244 236" width={size} height={size} role="img" aria-label={`${size}px counterchange mark`} style={{ width: size, height: size, display: "block" }}>
        <Mark small={size < 32} />
      </svg>
    </div>
  );
}

function Construction() {
  return (
    <section style={{ borderTop: `1px solid ${HAIRLINE}`, padding: "9px 30px 0", background: PAPER }}>
      <svg viewBox="0 0 700 164" width="100%" height="164" role="img" aria-label="Counterchange module grid and diagonal divide construction" style={{ display: "block" }}>
        <g transform="translate(218,-48) scale(.7)">
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

export default function TheCounterchange() {
  return (
    <main style={{ minHeight: "100dvh", boxSizing: "border-box", background: PAPER, color: INK, padding: "27px 0 14px", display: "flex", flexDirection: "column", fontFamily: MONO }}>
      <header style={{ width: "100%", padding: "0 30px", boxSizing: "border-box", display: "flex", justifyContent: "space-between", color: META, fontSize: 10, lineHeight: 1.2, letterSpacing: ".14em", textTransform: "uppercase" }}><span>ARCANUM — STUDY 60/63</span><span>THE COUNTERCHANGE</span></header>
      <section style={{ flex: "1 1 auto", minHeight: 365, marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1, background: HAIRLINE }} aria-label="Identical counterchange mark on light and dark grounds">
        {[PAPER, FOUNDRY].map((ground, index) => <div key={ground} style={{ minHeight: 365, background: ground, display: "grid", placeItems: "center" }}><svg viewBox="78 42 244 236" width="300" height="300" role="img" aria-label={`Counterchange mark on ${index === 0 ? "paper" : "foundry dark"} ground`} style={{ width: "min(300px, 40vw)", height: "min(300px, 40vw)", display: "block" }}><Mark /></svg></div>)}
      </section>
      <Construction />
      <ProofRow />
      <p style={{ padding: "8px 30px 0", margin: 0, color: GUIDE, fontSize: 9, lineHeight: 1.35, letterSpacing: ".12em", textTransform: "uppercase" }}>ONE MARK, TWO GROUNDS: POLICY HOLDS ITS CONTRAST — IT DOES NOT ASK THE THEME TO CHANGE.</p>
    </main>
  );
}
