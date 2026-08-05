const PAPER = "#faf6f1";
const INK = "#292522";
const UMBER = "#655d56";
const SIGNAL = "#ff3c00";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

/**
 * THE MINUTE SEAL / STUDY 44
 *
 * The construction has only three visible ideas:
 * 1. bezel ring: diameter 264, stroke 24 → diameter:ring = 11:1;
 * 2. N=24 machine-even oversight ticks, each 12px long, on a 120px radius;
 * 3. centered shield-dot, with the human signal point inside its lock.
 *
 * Optical corrections:
 * - the substantial ring is inset 4px from the nominal 140px circle so its
 *   outside edge survives small reduction without gaining visual size;
 * - horizontal tick strokes are 4% lighter than their radial companions,
 *   compensating for the eye's tendency to read horizontals dark;
 * - the central guard is 2px wider at its shoulder than a pure geometric
 *   construction, keeping the tiny silhouette from pinching at 16px.
 */

const polar = (cx: number, cy: number, r: number, angle: number) => [
  cx + Math.cos(angle) * r,
  cy + Math.sin(angle) * r,
];

function MinuteMark({ construction = false, opacity = 1 }: { construction?: boolean; opacity?: number }) {
  const ticks = Array.from({ length: 24 }, (_, i) => {
    const angle = (i / 24) * Math.PI * 2 - Math.PI / 2;
    const [x1, y1] = polar(200, 200, 118, angle);
    const [x2, y2] = polar(200, 200, 106, angle);
    return (
      <path
        key={`tick-${i}`}
        d={`M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`}
        stroke={i % 6 === 0 ? INK : UMBER}
        strokeWidth={i % 6 === 0 ? 1.7 : 1.25}
        strokeLinecap="butt"
      />
    );
  });

  return (
    <g opacity={opacity}>
      {construction ? (
        <>
          <g fill="none" stroke={HAIRLINE} strokeWidth="1">
            <circle cx="200" cy="200" r="140" />
            <circle cx="200" cy="200" r="118" />
            <circle cx="200" cy="200" r="106" />
            <path d="M52 200H348M200 52V348" />
            <path d="M101 101L299 299M299 101L101 299" />
          </g>
          <g fill="none" stroke={GUIDE} strokeWidth="1" strokeDasharray="4 5">
            <circle cx="200" cy="200" r="132" />
            <path d="M200 60V74M200 326V340" />
          </g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing="0.7">
            <text x="224" y="83">N = 24 / 15°</text>
            <text x="224" y="98">RING / Ø : W = 11 : 1</text>
            <text x="56" y="354">TICK BAND / 12 · CENTER / 200</text>
          </g>
        </>
      ) : null}
      <circle cx="200" cy="200" r="132" fill="none" stroke={INK} strokeWidth="24" />
      <g fill="none">{ticks}</g>
      {/* The guard is a deliberately quiet shield-dot: one continuous
          silhouette, with a tiny signal point as the human countersign. */}
      <path d="M200 166C185 166 175 169 168 174V201C168 223 180 239 200 251C220 239 232 223 232 201V174C225 169 215 166 200 166Z" fill={INK} />
      <circle cx="200" cy="192" r="5.5" fill={SIGNAL} />
    </g>
  );
}

function MiniMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="48 48 304 304" aria-label={`${size}px Minute Seal`} role="img" style={{ width: size, height: size, display: "block" }}>
      <MinuteMark />
    </svg>
  );
}

export default function TheMinuteSeal() {
  return (
    <main style={{ minHeight: "100dvh", width: "100%", boxSizing: "border-box", background: PAPER, color: INK, padding: "27px 30px 27px", display: "flex", flexDirection: "column", fontFamily: MONO }}>
      <header style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 18, color: META, fontSize: 10, lineHeight: 1.2, letterSpacing: "0.14em", textTransform: "uppercase" }}>
        <span>ARCANUM — STUDY 44/45</span><span>THE MINUTE SEAL</span>
      </header>
      <section aria-label="Finished Minute Seal" style={{ flex: "1 1 auto", minHeight: 360, display: "grid", placeItems: "center", padding: "10px 0 8px" }}>
        <svg viewBox="40 40 320 320" width="370" height="370" role="img" aria-label="Precision ring with twenty-four oversight ticks and a central shield dot" style={{ width: "min(370px, 76vw)", height: "auto", display: "block" }}><MinuteMark /></svg>
      </section>
      <section aria-label="Minute Seal construction" style={{ width: "100%", maxWidth: 640, margin: "0 auto", borderTop: `1px solid ${HAIRLINE}`, paddingTop: 10 }}>
        <svg viewBox="0 0 640 180" width="100%" height="170" role="img" aria-label="Minute Seal geometric construction with ring ratio and twenty-four tick system" style={{ display: "block" }}>
          <g transform="translate(180,-49) scale(.70)"><MinuteMark construction opacity={0.42} /></g>
        </svg>
      </section>
      <section aria-label="Small size proof" style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 38, padding: "2px 0 0" }}>
        {[64, 32, 16].map((size) => <figure key={size} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><MiniMark size={size} /><figcaption style={{ color: GUIDE, fontSize: 8, lineHeight: 1 }}>{size}</figcaption></figure>)}
      </section>
      <p style={{ width: "100%", maxWidth: 640, margin: "8px auto 0", color: GUIDE, fontSize: 9, lineHeight: 1.35, letterSpacing: "0.12em", textTransform: "uppercase" }}>EVERY MINUTE IS GOVERNED. THE HUMAN POINT HOLDS THE SEAL.</p>
    </main>
  );
}