const PAPER = "#faf6f1";
const INK = "#292522";
const SIGNAL = "#ff3c00";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

/**
 * THE SIGIL / STUDY 32
 *
 * M = 24px. The knot's four turning points sit on the M-grid. Its two lobes
 * share one center node and use a 45° crossing. Band = 28px, node = 24px.
 * The mark is one closed, self-crossing bezier path: the policy loops back
 * into itself and cannot be exited.
 *
 * Optical corrections:
 * - the upper lobe is lifted 4px and the lower lobe dropped 4px so the knot
 *   does not appear top-heavy when the crossing is opened;
 * - the central paper break is 7px, narrower than the band, preserving the
 *   sense of one continuous ribbon;
 * - the signal node is inset 2px inside the crossing, never protruding;
 * - flat butt/miter logic at the crossing keeps this a seal, not a soft icon.
 */

const knotPath =
  "M 180 120 " +
  "C 220 74 270 68 276 114 " +
  "C 282 160 236 190 180 120 " +
  "C 124 190 78 160 84 114 " +
  "C 90 68 140 74 180 120 Z";

function SigilMark({
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
            <path d="M60 48V204M84 48V204M108 48V204M132 48V204M156 48V204M180 48V204M204 48V204M228 48V204M252 48V204M276 48V204M300 48V204" />
            <path d="M60 48H300M60 72H300M60 96H300M60 120H300M60 144H300M60 168H300M60 192H300" />
          </g>
          <g fill="none" stroke={GUIDE} strokeWidth="1" strokeDasharray="4 5">
            <path d="M180 48V204" />
            <path d="M84 120H276" />
            <path d="M108 72L252 168" />
            <path d="M252 72L108 168" />
            <path d={knotPath} />
          </g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing="0.7">
            <text x="188" y="62">M / 24 GRID</text>
            <text x="194" y="111">45° CROSSING</text>
            <text x="194" y="131">NODE / 24</text>
            <text x="68" y="218">BAND / 28 · GAP / 7</text>
          </g>
        </>
      ) : null}

      {/* One continuous closed band. Stroke is used as the literal flat band
          of the path, never as a decorative outline. */}
      <path
        d={knotPath}
        fill="none"
        stroke={INK}
        strokeWidth="28"
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />

      {/* Clean over-under break: the paper slit lets one strand pass beneath
          the other. The orange node replaces the middle of that slit. */}
      <path
        d="M 162 102 L 198 138"
        fill="none"
        stroke={PAPER}
        strokeWidth="7"
        strokeLinecap="butt"
      />
      <path d="M180 108L192 120L180 132L168 120Z" fill={SIGNAL} />
    </g>
  );
}

export default function TheSigil() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        width: "100%",
        boxSizing: "border-box",
        background: PAPER,
        color: INK,
        padding: "27px 30px 28px",
        display: "flex",
        flexDirection: "column",
        fontFamily: MONO,
      }}
    >
      <header
        style={{
          width: "100%",
          maxWidth: 640,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          gap: 18,
          color: META,
          fontSize: 10,
          lineHeight: 1.2,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        <span>ARCANUM — STUDY 32/34</span>
        <span style={{ textAlign: "right" }}>THE SIGIL</span>
      </header>

      <section
        aria-label="Finished sigil"
        style={{
          flex: "1 1 auto",
          minHeight: 385,
          display: "grid",
          placeItems: "center",
          padding: "20px 0 14px",
        }}
      >
        <svg
          width="390"
          height="300"
          viewBox="40 35 280 185"
          role="img"
          aria-label="A closed geometric knot with one signal node at its crossing"
          style={{ width: "min(390px, 80vw)", height: "auto", display: "block" }}
        >
          <SigilMark />
        </svg>
      </section>

      <section
        aria-label="Sigil construction system"
        style={{
          width: "100%",
          maxWidth: 640,
          margin: "0 auto",
          borderTop: `1px solid ${HAIRLINE}`,
          paddingTop: 15,
        }}
      >
        <svg
          width="100%"
          height="190"
          viewBox="0 0 640 220"
          role="img"
          aria-label="Actual knot construction with grid, center axis, crossing angle, and band gap measurements"
          style={{ display: "block", overflow: "visible" }}
        >
          <g transform="translate(155,-6) scale(.82)">
            <SigilMark opacity={0.3} construction />
          </g>
        </svg>
      </section>

      <p
        style={{
          width: "100%",
          maxWidth: 640,
          margin: "12px auto 0",
          color: GUIDE,
          fontSize: 9,
          lineHeight: 1.35,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        A CLOSED KNOT: POLICY HOLDS. THE HUMAN NODE MAKES IT UNFORGEABLE.
      </p>
    </main>
  );
}