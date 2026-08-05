const PAPER = "#faf6f1";
const INK = "#292522";
const UMBER = "#655d56";
const SIGNAL = "#ff3c00";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

/**
 * THE SPLIT SHIELD / STUDY 36
 *
 * Construction: M = 24px. Outer guard is 240px wide at the shoulder and
 * 312px tall. The facet seam is placed at 61.8% of the shoulder span
 * (x=204 from the left shoulder), then eases 4px toward the center at the
 * base. Machine = ink; human = umber. The signal node sits directly on the
 * seam at the governing datum y=204.
 *
 * Optical corrections: the top arch rises 5px above its circle-derived cap;
 * shoulder joins are thinned by 3px to avoid a heavy badge-like brow; the
 * base is blunted to a 12px flat turn and its point overshoots the nominal
 * baseline by 4px. All terminals are flat, with no ornamental rounding.
 */

const outer =
  "M 60 64 " +
  "C 92 44 134 40 180 40 " +
  "C 226 40 268 44 300 64 " +
  "L 291 232 " +
  "C 287 290 254 334 180 370 " +
  "C 106 334 73 290 69 232 Z";

const leftFacet =
  "M 60 64 " +
  "C 92 44 134 40 180 40 " +
  "L 204 44 " +
  "C 201 108 198 164 194 216 " +
  "C 190 274 185 324 180 370 " +
  "C 106 334 73 290 69 232 Z";

const rightFacet =
  "M 180 40 " +
  "C 226 40 268 44 300 64 " +
  "L 291 232 " +
  "C 287 290 254 334 180 370 " +
  "C 185 324 190 274 194 216 " +
  "C 198 164 201 108 204 44 Z";

function SplitShieldMark({
  opacity = 1,
  construction = false,
}: {
  opacity?: number;
  construction?: boolean;
}) {
  return (
    <g opacity={opacity}>
      {construction ? (
        <>
          <g fill="none" stroke={HAIRLINE} strokeWidth="1">
            <path d="M60 32V380M84 32V380M108 32V380M132 32V380M156 32V380M180 32V380M204 32V380M228 32V380M252 32V380M276 32V380M300 32V380" />
            <path d="M48 40H312M48 64H312M48 88H312M48 112H312M48 136H312M48 160H312M48 184H312M48 208H312M48 232H312M48 256H312M48 280H312M48 304H312M48 328H312M48 352H312M48 376H312" />
          </g>
          <g fill="none" stroke={GUIDE} strokeWidth="1" strokeDasharray="4 5">
            <path d="M60 64H300" />
            <path d="M204 42C201 108 198 164 194 216C190 274 185 324 180 370" />
            <path d="M48 204H312" />
            <path d="M180 32V380" />
          </g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing="0.7">
            <text x="210" y="195">DATUM / M×8.5</text>
            <text x="208" y="54">SEAM / 0.618</text>
            <text x="52" y="392">M = 24 · SHOULDER / 10M · HEIGHT / 13M</text>
          </g>
        </>
      ) : null}
      {/* The two facet paths are the same measured outer silhouette; the
          single seam is their only internal division. */}
      <path d={leftFacet} fill={UMBER} />
      <path d={rightFacet} fill={INK} />
      {/* Human attention is the one signal element: a punched diamond node
          centered on the seam, fully contained by the guard. */}
      <path fill={SIGNAL} d="M 188 204 L 204 188 L 220 204 L 204 220 Z" />
    </g>
  );
}

export default function TheSplitShield() {
  return (
    <main style={{ minHeight: "100dvh", width: "100%", boxSizing: "border-box", background: PAPER, color: INK, padding: "27px 30px 28px", display: "flex", flexDirection: "column", fontFamily: MONO }}>
      <header style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 18, color: META, fontSize: 10, lineHeight: 1.2, letterSpacing: "0.14em", textTransform: "uppercase" }}>
        <span>ARCANUM — STUDY 36/38</span>
        <span style={{ textAlign: "right" }}>THE SPLIT SHIELD</span>
      </header>
      <section aria-label="Finished split shield" style={{ flex: "1 1 auto", minHeight: 385, display: "grid", placeItems: "center", padding: "17px 0 13px" }}>
        <svg width="370" height="370" viewBox="35 24 290 370" role="img" aria-label="A flat shield split into two precise authority facets with a signal seam node" style={{ width: "min(370px, 78vw)", height: "auto", display: "block" }}>
          <SplitShieldMark />
        </svg>
      </section>
      <section aria-label="Split shield construction" style={{ width: "100%", maxWidth: 640, margin: "0 auto", borderTop: `1px solid ${HAIRLINE}`, paddingTop: 14 }}>
        <svg width="100%" height="190" viewBox="0 0 640 220" role="img" aria-label="Actual shield construction with modular grid, seam ratio, and governing datum" style={{ display: "block", overflow: "visible" }}>
          <g transform="translate(155,-7) scale(.82)"><SplitShieldMark opacity={0.3} construction /></g>
        </svg>
      </section>
      <p style={{ width: "100%", maxWidth: 640, margin: "12px auto 0", color: GUIDE, fontSize: 9, lineHeight: 1.35, letterSpacing: "0.12em", textTransform: "uppercase" }}>
        TWO AUTHORITIES SHARE ONE GUARD. THE SEAM IS THE HUMAN COUNTERSIGN.
      </p>
    </main>
  );
}