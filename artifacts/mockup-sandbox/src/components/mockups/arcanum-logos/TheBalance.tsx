const PAPER = "#faf6f1";
const INK = "#292522";
const SIGNAL = "#ff3c00";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = '"DM Mono", "IBM Plex Mono", monospace';

/**
 * THE BALANCE / STUDY 57/59
 *
 * Four elements only: one precise beam, one off-center fulcrum triangle, one
 * machine square, one human signal point. Beam datum is a 7M arm on the long
 * side and 3M on the short side; the fulcrum sits at x=230 rather than center.
 * The square is 2.5M × 2.5M and touches the short-side beam, while the signal
 * floats over the long side at the policy datum.
 *
 * Construction story: mass × arm. The square carries 4M of visual mass at a
 * 3M arm; the signal is 1M at a 7M arm — a small human counterweight with
 * disproportionate leverage. The result is intentionally not scales-of-justice:
 * no bowls, no paired hangers, no symmetry, just a tense instrument.
 * Optical correction: the beam is lowered 3px toward the square to prevent the
 * signal side from feeling visually heavy. Squint check: no letterform, cross,
 * or justice-scale silhouette; the single square and asymmetric datum read as
 * judgment.
 *
 * At 16px the beam/fulcrum/square remain; the signal is the only accent and
 * stays visible. One-color fallback changes the signal to ink for engraving.
 */
const BEAM = "M92 154 L300 179";
const FULCRUM = "M230 172 L206 242 H254 Z";
const SQUARE = "M256 174 H306 V224 H256 Z";

function Mark({ construction = false, opacity = 1 }: { construction?: boolean; opacity?: number }) {
  return (
    <g opacity={opacity}>
      {construction ? (
        <>
          <g fill="none" stroke={HAIRLINE} strokeWidth="1">
            <path d="M80 80V280M100 80V280M120 80V280M140 80V280M160 80V280M180 80V280M200 80V280M220 80V280M240 80V280M260 80V280M280 80V280M300 80V280M320 80V280" />
            <path d="M80 80H320M80 100H320M80 120H320M80 140H320M80 160H320M80 180H320M80 200H320M80 220H320M80 240H320M80 260H320M80 280H320" />
          </g>
          <g fill="none" stroke={GUIDE} strokeWidth="1" strokeDasharray="4 5">
            <path d={BEAM} />
            <path d={FULCRUM} />
            <path d={SQUARE} />
            <path d="M230 130V250M92 154H230M230 179H300" />
          </g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing=".7">
            <text x="84" y="140">7M LONG ARM</text>
            <text x="248" y="166">3M SHORT ARM</text>
            <text x="84" y="264">M × ARM · 4M × 3M ≈ 1M × 7M LEVERAGE</text>
          </g>
        </>
      ) : null}
      <path d={BEAM} fill="none" stroke={INK} strokeWidth="8" strokeLinecap="square" />
      <path d={FULCRUM} fill={INK} />
      <path d={SQUARE} fill={INK} />
      <circle cx="132" cy="159" r="7" fill={SIGNAL} />
    </g>
  );
}

function Mini({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="72 112 248 164" role="img" aria-label={`${size}px balance mark`} style={{ width: size, height: size, display: "block" }}><Mark /></svg>;
}

export default function TheBalance() {
  return (
    <main style={{ minHeight: "100dvh", boxSizing: "border-box", background: PAPER, color: INK, padding: "27px 30px", display: "flex", flexDirection: "column", fontFamily: MONO }}>
      <header style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", color: META, fontSize: 10, lineHeight: 1.2, letterSpacing: ".14em", textTransform: "uppercase" }}><span>ARCANUM — STUDY 57/59</span><span>THE BALANCE</span></header>
      <section style={{ flex: "1 1 auto", minHeight: 370, display: "grid", placeItems: "center", padding: "12px 0" }} aria-label="Finished balance"><svg viewBox="72 112 248 164" width="380" height="280" role="img" aria-label="Asymmetric balance with square and signal point" style={{ width: "min(380px, 84vw)", height: "auto", display: "block" }}><Mark /></svg></section>
      <section style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 10, width: "100%", maxWidth: 640, margin: "0 auto" }} aria-label="Balance construction"><svg viewBox="0 0 640 180" width="100%" height="170" role="img" aria-label="Balance moment equation construction" style={{ display: "block" }}><g transform="translate(180,-48) scale(.7)"><Mark construction opacity={.42} /></g></svg></section>
      <section style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 38, paddingTop: 2 }} aria-label="Small size proof">{[64, 32, 16].map(size => <figure key={size} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><Mini size={size} /><figcaption style={{ color: GUIDE, fontSize: 8 }}>{size}</figcaption></figure>)}</section>
      <p style={{ width: "100%", maxWidth: 640, margin: "8px auto 0", color: GUIDE, fontSize: 9, lineHeight: 1.35, letterSpacing: ".12em", textTransform: "uppercase" }}>A SMALL HUMAN SIGNAL HAS LEVERAGE — POLICY WEIGHS EVERY MOVE.</p>
    </main>
  );
}
