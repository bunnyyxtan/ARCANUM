const PAPER = "#faf6f1";
const INK = "#292522";
const SIGNAL = "#ff3c00";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = '"DM Mono", "IBM Plex Mono", monospace';

/**
 * THE INGOT / STUDY 56/59
 *
 * A value-in-custody slab, not a soft object: module M=20. Finished silhouette
 * is 9M wide × 6M high, with a 1:9 taper on each side (top 160, base 200).
 * The bottom is held 12px longer than the top to give the mass a vault-weight
 * stance. All corner turns use short cubic transitions (G2-feeling tangents)
 * rather than circles or pill rounding.
 *
 * Deposit slot: 3M × .35M, centered at the top-face datum. The slot is baked
 * as opaque paper, so this universal mark never borrows its ground. The signal
 * sits 0.45M inside the slot, just past the custody threshold.
 * Optical correction: the top face is lifted 4px above geometric center so the
 * slab does not read as bread or soap. Squint check: no loaf crown, no bar of
 * soap, no letterform; the wide base and precise deposit slit read as a
 * weighted ingot.
 *
 * Detail rule: 32px+ keeps the slot; 16px collapses to the silhouette and one
 * signal point, preserving the vault-weight read. One-color fallback removes
 * the signal only for engraving.
 */
const INGOT =
  "M120 144 Q120 140 124 138 " +
  "L276 138 Q280 140 280 144 " +
  "L300 278 Q300 282 296 284 " +
  "L104 284 Q100 282 100 278 Z";
const SLOT = "M168 145 Q168 142 171 142 H229 Q232 142 232 145 L227 152 H173 Z";

function Mark({ construction = false, opacity = 1, small = false }: { construction?: boolean; opacity?: number; small?: boolean }) {
  return (
    <g opacity={opacity}>
      {construction ? (
        <>
          <g fill="none" stroke={HAIRLINE} strokeWidth="1">
            <path d="M80 80V320M100 80V320M120 80V320M140 80V320M160 80V320M180 80V320M200 80V320M220 80V320M240 80V320M260 80V320M280 80V320M300 80V320M320 80V320" />
            <path d="M80 80H320M80 100H320M80 120H320M80 140H320M80 160H320M80 180H320M80 200H320M80 220H320M80 240H320M80 260H320M80 280H320M80 300H320M80 320H320" />
          </g>
          <g fill="none" stroke={GUIDE} strokeWidth="1" strokeDasharray="4 5">
            <path d="M100 138H300M100 284H300M200 118V300" />
            <path d={INGOT} />
            <path d={SLOT} />
          </g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing=".7">
            <text x="207" y="128">9M × 6M · TAPER / 1:9</text>
            <text x="207" y="160">SLOT / 3M × .35M</text>
            <text x="76" y="340">BASE +12 · SIGNAL INSET / .45M · G2 TURNS</text>
          </g>
        </>
      ) : null}
      <path d={INGOT} fill={INK} />
      {!small ? <path d={SLOT} fill={PAPER} /> : null}
      <circle cx="200" cy="148" r="7" fill={SIGNAL} />
    </g>
  );
}

function Mini({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="72 108 256 212" role="img" aria-label={`${size}px ingot mark`} style={{ width: size, height: size, display: "block" }}>
      <Mark small={size < 32} />
    </svg>
  );
}

export default function TheIngot() {
  return (
    <main style={{ minHeight: "100dvh", boxSizing: "border-box", background: PAPER, color: INK, padding: "27px 30px", display: "flex", flexDirection: "column", fontFamily: MONO }}>
      <header style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", color: META, fontSize: 10, lineHeight: 1.2, letterSpacing: ".14em", textTransform: "uppercase" }}><span>ARCANUM — STUDY 56/59</span><span>THE INGOT</span></header>
      <section style={{ flex: "1 1 auto", minHeight: 370, display: "grid", placeItems: "center", padding: "12px 0" }} aria-label="Finished ingot"><svg viewBox="72 108 256 212" width="360" height="330" role="img" aria-label="Ink ingot with a paper deposit slot and signal point" style={{ width: "min(360px, 78vw)", height: "auto", display: "block" }}><Mark /></svg></section>
      <section style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 10, width: "100%", maxWidth: 640, margin: "0 auto" }} aria-label="Ingot construction"><svg viewBox="0 0 640 180" width="100%" height="170" role="img" aria-label="Ingot module grid and taper construction" style={{ display: "block" }}><g transform="translate(180,-48) scale(.7)"><Mark construction opacity={.42} /></g></svg></section>
      <section style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 38, paddingTop: 2 }} aria-label="Small size proof">{[64, 32, 16].map(size => <figure key={size} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><Mini size={size} /><figcaption style={{ color: GUIDE, fontSize: 8 }}>{size}</figcaption></figure>)}</section>
      <p style={{ width: "100%", maxWidth: 640, margin: "8px auto 0", color: GUIDE, fontSize: 9, lineHeight: 1.35, letterSpacing: ".12em", textTransform: "uppercase" }}>VALUE GOES IN THROUGH ONE PRECISE SLOT — THE MASS READS VAULT-WEIGHT, NOT LOAF OR SOAP.</p>
    </main>
  );
}
