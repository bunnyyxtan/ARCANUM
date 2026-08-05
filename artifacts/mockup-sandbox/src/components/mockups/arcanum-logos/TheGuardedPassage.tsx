const PAPER = "#faf6f1";
const INK = "#292522";
const SIGNAL = "#ff3c00";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

/**
 * THE GUARDED PASSAGE / STUDY 37
 *
 * Construction: M = 24px. Shield shoulder span = 240px, guard height = 312px.
 * The current channel sits at 62.5% of the guard height (datum y=235);
 * channel height = 40px (5M/3), checkpoint = 24px (M), centered on the
 * current axis. The negative channel is the only opening in the shield.
 *
 * Optical corrections: shoulder arch rises 5px above the underlying cap
 * circle; the channel stops 11px inside each curved side, preserving one
 * uninterrupted shield edge while still reading as an interior flow band;
 * checkpoint is inset 4px from each channel edge so it reads as an eye in
 * the passage without touching the guard.
 */

const shield =
  "M 60 64 " +
  "C 92 44 134 40 180 40 " +
  "C 226 40 268 44 300 64 " +
  "L 291 232 " +
  "C 287 290 254 334 180 370 " +
  "C 106 334 73 290 69 232 Z";

function GuardedPassageMark({
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
            <path d="M48 235H312" />
            <path d="M180 32V380" />
            <path d="M80 215H280M80 255H280" />
          </g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing="0.7">
            <text x="208" y="228">FLOW DATUM / 62.5%</text>
            <text x="208" y="247">CHANNEL / 200 × 40</text>
            <text x="208" y="266">CHECKPOINT / M</text>
            <text x="52" y="392">M = 24 · THROUGH-CUT OVERSHOOT / 6</text>
          </g>
        </>
      ) : null}
      {/* A single shield silhouette with an interior through-flow slot. The
          compound path keeps the channel genuinely negative space, while the
          80..280 endpoints stay inside the silhouette so no dark rail can
          protrude beyond the guard edge. */}
      <path
        fill={INK}
        fillRule="evenodd"
        d={`${shield} M 80 215 L 280 215 L 280 255 L 80 255 Z`}
      />
      {/* The human checkpoint is one solid, inset point inside the permitted
          passage. Its four flat faces preserve 16px recognition. */}
      <path fill={SIGNAL} d="M 168 235 L 180 223 L 192 235 L 180 247 Z" />
    </g>
  );
}

export default function TheGuardedPassage() {
  return (
    <main style={{ minHeight: "100dvh", width: "100%", boxSizing: "border-box", background: PAPER, color: INK, padding: "27px 30px 28px", display: "flex", flexDirection: "column", fontFamily: MONO }}>
      <header style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 18, color: META, fontSize: 10, lineHeight: 1.2, letterSpacing: "0.14em", textTransform: "uppercase" }}>
        <span>ARCANUM — STUDY 37/38</span>
        <span style={{ textAlign: "right" }}>THE GUARDED PASSAGE</span>
      </header>
      <section aria-label="Finished guarded passage" style={{ flex: "1 1 auto", minHeight: 385, display: "grid", placeItems: "center", padding: "17px 0 13px" }}>
        <svg width="370" height="370" viewBox="35 24 290 370" role="img" aria-label="A flat shield with one horizontal passage and an orange checkpoint" style={{ width: "min(370px, 78vw)", height: "auto", display: "block" }}>
          <GuardedPassageMark />
        </svg>
      </section>
      <section aria-label="Guarded passage construction" style={{ width: "100%", maxWidth: 640, margin: "0 auto", borderTop: `1px solid ${HAIRLINE}`, paddingTop: 14 }}>
        <svg width="100%" height="190" viewBox="0 0 640 220" role="img" aria-label="Actual shield construction with modular grid, flow datum, channel, and checkpoint measurements" style={{ display: "block", overflow: "visible" }}>
          <g transform="translate(155,-7) scale(.82)"><GuardedPassageMark opacity={0.3} construction /></g>
        </svg>
      </section>
      <p style={{ width: "100%", maxWidth: 640, margin: "12px auto 0", color: GUIDE, fontSize: 9, lineHeight: 1.35, letterSpacing: "0.12em", textTransform: "uppercase" }}>
        MONEY MOVES THROUGH THE GUARD. THE ORANGE CHECKPOINT IS HUMAN ATTENTION.
      </p>
    </main>
  );
}