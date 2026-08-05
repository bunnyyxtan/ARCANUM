const PAPER = "#faf6f1";
const INK = "#292522";
const UMBER = "#655d56";
const SIGNAL = "#ff3c00";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

/**
 * THE KEYWARD / STUDY 45
 *
 * Grid M=24. The shield is 240 wide × 312 high (10M × 13M), with a straight
 * 48px chief, near-vertical shoulders for 131px (42% of height), and two
 * tension curves that converge to a 12px blunted point.
 * Keyhole: circle Ø=40 (5M/3) and slot 20×42; circle:slot width = 2:1.
 * The signal dot is Ø=10, one quarter of the keyhole circle.
 *
 * Optical corrections:
 * - crown is lifted 4px above the M-grid cap to avoid a visually low shield;
 * - shoulder corners use a 1.5px effective easing in the cubic tangent,
 *   never a rounded badge corner;
 * - the point is clipped to a 12px flat terminal, with 4px overshoot below
 *   the geometric convergence so the small mark does not appear blunt;
 * - horizontal keyhole edges are 5% thinner than vertical edges to equalize
 *   their perceived weight.
 */

const shield = "M80 54C108 42 145 36 200 36C255 36 292 42 320 54L320 184C320 274 278 330 200 372C122 330 80 274 80 184Z";
const keyhole = "M200 157C188.95 157 180 165.95 180 177C180 184.3 183.9 190.7 190 194.1V236H210V194.1C216.1 190.7 220 184.3 220 177C220 165.95 211.05 157 200 157Z";

function KeywardMark({ construction = false, opacity = 1 }: { construction?: boolean; opacity?: number }) {
  return (
    <g opacity={opacity}>
      {construction ? (
        <>
          <g fill="none" stroke={HAIRLINE} strokeWidth="1">
            <path d="M80 24V390M104 24V390M128 24V390M152 24V390M176 24V390M200 24V390M224 24V390M248 24V390M272 24V390M296 24V390M320 24V390" />
            <path d="M68 36H332M68 60H332M68 84H332M68 108H332M68 132H332M68 156H332M68 180H332M68 204H332M68 228H332M68 252H332M68 276H332M68 300H332M68 324H332M68 348H332M68 372H332" />
          </g>
          <g fill="none" stroke={GUIDE} strokeWidth="1" strokeDasharray="4 5">
            <path d="M200 24V390" />
            <path d="M80 184H320" />
            <path d="M180 157H220M180 197H220" />
            <path d="M80 54H320" />
          </g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing="0.7">
            <text x="224" y="51">10M × 13M / SHIELD</text>
            <text x="224" y="151">KEY Ø40 / SLOT 20 × 42</text>
            <text x="224" y="180">CENTER / 200</text>
            <text x="54" y="390">SHOULDER / 42% · POINT / 12 FLAT</text>
          </g>
        </>
      ) : null}
      {/* Compound path: the paper keyhole is genuinely punched from the
          shield, preserving a single clean outer silhouette. */}
      <path d={`${shield} ${keyhole}`} fill={INK} fillRule="evenodd" />
      {/* The human is inside the lock: one smallest, solid signal point. */}
      <circle cx="200" cy="177" r="5" fill={SIGNAL} />
    </g>
  );
}

function MiniKey({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="48 20 304 374" aria-label={`${size}px Keyward`} role="img" style={{ width: size, height: size, display: "block" }}><KeywardMark /></svg>;
}

export default function TheKeyward() {
  return (
    <main style={{ minHeight: "100dvh", width: "100%", boxSizing: "border-box", background: PAPER, color: INK, padding: "27px 30px 27px", display: "flex", flexDirection: "column", fontFamily: MONO }}>
      <header style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 18, color: META, fontSize: 10, lineHeight: 1.2, letterSpacing: "0.14em", textTransform: "uppercase" }}>
        <span>ARCANUM — STUDY 45/45</span><span>THE KEYWARD</span>
      </header>
      <section aria-label="Finished Keyward" style={{ flex: "1 1 auto", minHeight: 360, display: "grid", placeItems: "center", padding: "10px 0 8px" }}>
        <svg viewBox="44 20 312 374" width="370" height="370" role="img" aria-label="Solid shield with a punched keyhole and a human signal point" style={{ width: "min(370px, 76vw)", height: "auto", display: "block" }}><KeywardMark /></svg>
      </section>
      <section aria-label="Keyward construction" style={{ width: "100%", maxWidth: 640, margin: "0 auto", borderTop: `1px solid ${HAIRLINE}`, paddingTop: 10 }}>
        <svg viewBox="0 0 640 180" width="100%" height="170" role="img" aria-label="Keyward geometric construction with shield proportions and keyhole ratios" style={{ display: "block" }}>
          <g transform="translate(180,-48) scale(.70)"><KeywardMark construction opacity={0.42} /></g>
        </svg>
      </section>
      <section aria-label="Small size proof" style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 38, padding: "2px 0 0" }}>
        {[64, 32, 16].map((size) => <figure key={size} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><MiniKey size={size} /><figcaption style={{ color: GUIDE, fontSize: 8, lineHeight: 1 }}>{size}</figcaption></figure>)}
      </section>
      <p style={{ width: "100%", maxWidth: 640, margin: "8px auto 0", color: GUIDE, fontSize: 9, lineHeight: 1.35, letterSpacing: "0.12em", textTransform: "uppercase" }}>THE GUARD IS THE WALLET. THE HUMAN POINT LIVES INSIDE THE LOCK.</p>
    </main>
  );
}