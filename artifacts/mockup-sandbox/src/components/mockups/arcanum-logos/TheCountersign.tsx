const PAPER = "#faf6f1";
const INK = "#292522";
const SIGNAL = "#ff3c00";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

/**
 * THE COUNTERSIGN / final construction
 *
 * Grid: M = 24px. The finished glyph occupies x=52..308 and y=54..348.
 * The long edges are set on a 24° family, with an intentional 1° entasis
 * in each cubic edge. At the crossbar datum y=226, the measured mean stem
 * is W=48px. The signal period is D=40px (D/W = 0.83), leaving air on
 * both sides of the aperture instead of touching either agent stem.
 *
 * Optical corrections:
 * - apex compensation: both terminals lift 6px above the geometric cap line,
 *   preventing the acute join from reading heavy at small sizes;
 * - overshoot: the foot plane descends 4px beyond the M×14 baseline;
 * - joint thinning: the two apex cuts are kept to 25–27px before the stems
 *   expand, avoiding a dark knot where the structure changes direction;
 * - foot shear: terminal cuts are 8° off horizontal, so the feet feel cut,
 *   not rounded or extruded.
 */

const bezierCircle = (cx: number, cy: number, r: number) => {
  const k = 0.5522847498;
  const d = r * k;
  return [
    `M ${cx} ${cy - r}`,
    `C ${cx + d} ${cy - r} ${cx + r} ${cy - d} ${cx + r} ${cy}`,
    `C ${cx + r} ${cy + d} ${cx + d} ${cy + r} ${cx} ${cy + r}`,
    `C ${cx - d} ${cy + r} ${cx - r} ${cy + d} ${cx - r} ${cy}`,
    `C ${cx - r} ${cy - d} ${cx - d} ${cy - r} ${cx} ${cy - r} Z`,
  ].join(" ");
};

function CountersignGlyph({
  opacity = 1,
  showConstruction = false,
}: {
  opacity?: number;
  showConstruction?: boolean;
}) {
  // The datum is lowered 8px from the geometric midpoint. The aperture
  // opens as it descends, so this gives the period a more generous, calmer
  // lock. x=188 is the optical center: a hair left of the aperture midpoint,
  // while the smaller 40px diameter leaves approximately 9px of paper to
  // each stem at the datum.
  const datumY = 226;
  const periodR = 20;

  return (
    <g opacity={opacity}>
      {showConstruction ? (
        <>
          {/* Construction grid is the same M=24 system the glyph was drawn on. */}
          <g fill="none" stroke={HAIRLINE} strokeWidth="1">
            <path d="M52 42V360M76 42V360M100 42V360M124 42V360M148 42V360M172 42V360M196 42V360M220 42V360M244 42V360M268 42V360M292 42V360M316 42V360" />
            <path d="M28 54H332M28 78H332M28 102H332M28 126H332M28 150H332M28 174H332M28 198H332M28 222H332M28 246H332M28 270H332M28 294H332M28 318H332M28 342H332" />
          </g>
          <g fill="none" stroke={GUIDE} strokeWidth="1" strokeDasharray="4 5">
            {/* Actual stem axes and the real absent crossbar datum. */}
            <path d="M61 348L184 58M286 348L187 58" />
            <path d="M44 226H316" />
            <path d="M168 226H208" />
            <path d="M180 42V360" />
          </g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing="0.8">
            <text x="202" y="219">M×9 + 2 / CROSSBAR DATUM</text>
            <text x="210" y="125">24°</text>
            <text x="72" y="125">24° + 1° ENTASIS</text>
            <text x="204" y="48">APEX +6</text>
            <text x="54" y="365">M = 24 / GRID</text>
            <text x="210" y="259">D / W = 0.83</text>
          </g>
          <g fill={GUIDE}>
            <path d="M48 222L48 230L56 226Z" />
            <path d="M312 222L312 230L304 226Z" />
            <path d="M176 40L184 40L180 48Z" />
          </g>
        </>
      ) : null}

      {/* Left agent stem: deliberately thinner, with a barely perceptible
          inward entasis so its edge carries type-foundry tension. */}
      <path
        fill={INK}
        d="M52 348
           L99 348
           C110 310 122 264 135 214
           C148 164 160 111 173 60
           L198 66
           C187 113 176 164 163 215
           C150 267 139 312 129 348
           L78 348 Z"
      />

      {/* Right agent stem: heavier by construction; its outer cubic eases
          1° toward vertical at the datum, keeping the mark alive rather
          than mechanically extruded. */}
      <path
        fill={INK}
        d="M173 60
           L199 54
           C220 105 239 159 257 211
           C276 266 294 316 308 348
           L257 348
           C244 308 229 258 214 209
           C198 158 184 108 173 60 Z"
      />

      {/* One and only one twist: the human period completes the letter.
          It is a true bezier circle, not a decorative dot or floating badge. */}
      <path fill={SIGNAL} d={bezierCircle(188, datumY, periodR)} />
    </g>
  );
}

function MarkSvg({
  size,
  construction = false,
  label,
}: {
  size: number;
  construction?: boolean;
  label: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 360 400"
      role="img"
      aria-label={label}
      style={{ display: "block", width: size, height: size }}
    >
      <CountersignGlyph showConstruction={construction} />
    </svg>
  );
}

export default function TheCountersign() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        width: "100%",
        boxSizing: "border-box",
        background: PAPER,
        color: INK,
        padding: "28px 30px 26px",
        display: "flex",
        flexDirection: "column",
        fontFamily: MONO,
      }}
    >
      <header
        style={{
          width: "100%",
          maxWidth: 660,
          margin: "0 auto",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 20,
          color: META,
          fontSize: 10,
          lineHeight: 1.2,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        <span>ARCANUM — THE COUNTERSIGN</span>
        <span style={{ textAlign: "right" }}>FINAL MARK</span>
      </header>

      <section
        aria-label="Final mark"
        style={{
          flex: "1 1 auto",
          minHeight: 390,
          display: "grid",
          placeItems: "center",
          padding: "16px 0 12px",
        }}
      >
        <MarkSvg
          size={410}
          label="The Countersign: a bespoke A completed by a signal-orange period"
        />
      </section>

      <section
        aria-label="Construction system"
        style={{
          width: "100%",
          maxWidth: 660,
          margin: "0 auto",
          borderTop: `1px solid ${HAIRLINE}`,
          paddingTop: 14,
        }}
      >
        <svg
          width="100%"
          height="214"
          viewBox="0 0 660 214"
          role="img"
          aria-label="Construction grid, datum, stem angles, and stroke ratio"
          style={{ display: "block", overflow: "visible" }}
        >
          <g transform="translate(150,-55) scale(.6)">
            <CountersignGlyph opacity={0.3} showConstruction />
          </g>
        </svg>
      </section>

      <section
        aria-label="Small-scale proof"
        style={{
          width: "100%",
          maxWidth: 660,
          margin: "2px auto 0",
          padding: "7px 0 4px",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 42,
        }}
      >
        {[64, 32, 16].map((size) => (
          <figure
            key={size}
            style={{
              margin: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            <MarkSvg
              size={size}
              label={`The Countersign at ${size} pixels`}
            />
            <figcaption
              style={{
                color: GUIDE,
                fontSize: 8,
                lineHeight: 1,
                letterSpacing: "0.1em",
              }}
            >
              {size}
            </figcaption>
          </figure>
        ))}
      </section>

      <p
        style={{
          width: "100%",
          maxWidth: 660,
          margin: "9px auto 0",
          color: GUIDE,
          fontSize: 9,
          lineHeight: 1.35,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        THE AGENT BUILDS THE LETTER. THE HUMAN COMPLETES IT.
      </p>
    </main>
  );
}