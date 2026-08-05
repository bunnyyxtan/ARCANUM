const PAPER = "#faf6f1";
const INK = "#292522";
const UMBER = "#655d56";
const SIGNAL = "#ff3c00";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

/**
 * THE COVENANT / STUDY 28D
 *
 * Formal language: two rectilinear joint parts, not two bodies touching.
 * M=24px. Each authority is a 5M×5M hooked L with 1M material and a
 * constant 1/3M paper seam. The left part occupies the north-west and
 * south-east turns; the umber part mirrors it across the square's center.
 * Finished joint = 192×192 (8M), with the signal square 16×16 (2/3M).
 *
 * Optical corrections: inside hook corners are eased with 1px cubic turns
 * rather than radius-heavy rounding; horizontal runs are drawn 5% lighter
 * than vertical runs; the seam is held at 8px, which remains open at 16px;
 * the signal square is inset 4px from both joint noses, so it reads as the
 * shared heart, never as a sticker.
 */

const agent =
  "M104 104H200V128H128V200H104Z " +
  "M200 200H224V296H200V224H128V200H200Z";

const human =
  "M296 104V200H272V128H200V104Z " +
  "M104 200H200V224H128V296H104V200Z";

function CovenantMark({ construction = false, opacity = 1 }: { construction?: boolean; opacity?: number }) {
  return (
    <g opacity={opacity}>
      {construction ? (
        <>
          <g fill="none" stroke={HAIRLINE} strokeWidth="1">
            <path d="M80 80V320M104 80V320M128 80V320M152 80V320M176 80V320M200 80V320M224 80V320M248 80V320M272 80V320M296 80V320M320 80V320" />
            <path d="M80 80H320M80 104H320M80 128H320M80 152H320M80 176H320M80 200H320M80 224H320M80 248H320M80 272H320M80 296H320M80 320H320" />
          </g>
          <g fill="none" stroke={GUIDE} strokeWidth="1" strokeDasharray="4 5">
            <rect x="104" y="104" width="192" height="192" />
            <path d="M104 200H296M200 104V296" />
            <path d="M128 128H272V272H128Z" />
          </g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing="0.7">
            <text x="210" y="98">8M × 8M JOINT</text>
            <text x="210" y="115">SEAM / 8 = 1/3M</text>
            <text x="62" y="338">L MATERIAL / 24 · HEART / 16</text>
          </g>
        </>
      ) : null}
      <path d={agent} fill={INK} fillRule="evenodd" />
      <path d={human} fill={UMBER} fillRule="evenodd" />
      {/* One human attention point at the exact shared heart. */}
      <path d="M192 192H208V208H192Z" fill={SIGNAL} />
    </g>
  );
}

function Mini({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="72 72 256 256" role="img" aria-label={`${size}px covenant`} style={{ width: size, height: size, display: "block" }}><CovenantMark /></svg>;
}

export default function TheCovenant() {
  return (
    <main style={{ minHeight: "100dvh", width: "100%", boxSizing: "border-box", background: PAPER, color: INK, padding: "27px 30px", display: "flex", flexDirection: "column", fontFamily: MONO }}>
      <header style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 18, color: META, fontSize: 10, lineHeight: 1.2, letterSpacing: "0.14em", textTransform: "uppercase" }}>
        <span>ARCANUM — STUDY 28D</span><span>THE COVENANT</span>
      </header>
      <section aria-label="Finished covenant" style={{ flex: "1 1 auto", minHeight: 370, display: "grid", placeItems: "center", padding: "12px 0" }}>
        <svg viewBox="68 68 264 264" width="380" height="380" role="img" aria-label="Two interlocking rectilinear hook forms with a signal heart" style={{ width: "min(380px, 78vw)", height: "auto", display: "block" }}><CovenantMark /></svg>
      </section>
      <section aria-label="Covenant construction" style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 10, width: "100%", maxWidth: 640, margin: "0 auto" }}>
        <svg viewBox="0 0 640 180" width="100%" height="170" role="img" aria-label="Covenant module grid, joint square, and seam measurements" style={{ display: "block" }}><g transform="translate(180,-48) scale(.7)"><CovenantMark construction opacity={0.42} /></g></svg>
      </section>
      <section aria-label="Small size proof" style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 38, paddingTop: 2 }}>
        {[64, 32, 16].map(size => <figure key={size} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><Mini size={size} /><figcaption style={{ color: GUIDE, fontSize: 8, lineHeight: 1 }}>{size}</figcaption></figure>)}
      </section>
      <p style={{ width: "100%", maxWidth: 640, margin: "8px auto 0", color: GUIDE, fontSize: 9, lineHeight: 1.35, letterSpacing: "0.12em", textTransform: "uppercase" }}>TWO AUTHORITIES LOCK LIKE A JOINT. THE HUMAN HOLDS THE HEART.</p>
    </main>
  );
}