const paper = "#faf6f1";
const ink = "#292522";
const signal = "#ff3c00";
const guide = "#9b9289";
const hairline = "#ded7d0";
const mono = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";
const phi = 1.61803398875;

function circlePath(cx: number, cy: number, r: number) {
  const k = 0.5522847498;
  const d = r * k;
  return [
    `M ${cx} ${cy - r}`,
    `C ${cx + d} ${cy - r} ${cx + r} ${cy - d} ${cx + r} ${cy}`,
    `C ${cx + r} ${cy + d} ${cx + d} ${cy + r} ${cx} ${cy + r}`,
    `C ${cx - d} ${cy + r} ${cx - r} ${cy + d} ${cx - r} ${cy}`,
    `C ${cx - r} ${cy - d} ${cx - d} ${cy - r} ${cx} ${cy - r}Z`,
  ].join(" ");
}

function SharedSecretMark({
  opacity = 1,
  showGuides = false,
}: {
  opacity?: number;
  showGuides?: boolean;
}) {
  const bigRadius = 116;
  const smallRadius = bigRadius / phi;
  const bigCenter = 138;
  const smallCenter = 255;
  const axisY = 180;

  return (
    <g opacity={opacity}>
      {showGuides ? (
        <>
          {/* Real construction system: two centers on one axis, R/r = phi.
              The shared lens begins where the center-to-center chord crosses. */}
          <g fill="none" stroke={hairline} strokeWidth="1">
            <path d={circlePath(bigCenter, axisY, bigRadius)} />
            <path d={circlePath(smallCenter, axisY, smallRadius)} />
            <path d={circlePath(bigCenter, axisY, bigRadius / phi)} />
            <path d={`M ${bigCenter - 145} ${axisY}H ${smallCenter + 88}`} />
            <path d={`M ${bigCenter} ${axisY - 132}V ${axisY + 132}`} />
          </g>
          <g fill="none" stroke={guide} strokeWidth="1" strokeDasharray="4 5">
            <path d={`M ${bigCenter} ${axisY}L ${bigCenter} ${axisY - bigRadius}`} />
            <path d={`M ${smallCenter} ${axisY}L ${smallCenter} ${axisY - smallRadius}`} />
            <path d={`M ${bigCenter} ${axisY - bigRadius - 10}H ${smallCenter} ${axisY - bigRadius - 10}`} />
            <path d={`M ${bigCenter} ${axisY + bigRadius + 10}H ${smallCenter} ${axisY + bigRadius + 10}`} />
          </g>
          <g fill={guide}>
            <path d={`M ${bigCenter - 4} ${axisY - bigRadius - 14}L ${bigCenter + 4} ${axisY - bigRadius - 14}L ${bigCenter} ${axisY - bigRadius - 6}Z`} />
            <path d={`M ${smallCenter - 4} ${axisY - bigRadius - 14}L ${smallCenter + 4} ${axisY - bigRadius - 14}L ${smallCenter} ${axisY - bigRadius - 6}Z`} />
            <path d={`M ${bigCenter - 4} ${axisY + bigRadius + 14}L ${bigCenter + 4} ${axisY + bigRadius + 14}L ${bigCenter} ${axisY + bigRadius + 6}Z`} />
            <path d={`M ${smallCenter - 4} ${axisY + bigRadius + 14}L ${smallCenter + 4} ${axisY + bigRadius + 14}L ${smallCenter} ${axisY + bigRadius + 6}Z`} />
          </g>
          <g fill={guide} fontFamily={mono} fontSize="7" letterSpacing="1">
            <text x="179" y="35">R : r = φ : 1</text>
            <text x="176" y="335">ONE CENTER AXIS / TWO AUTHORITIES</text>
            <text x="214" y="171">COVENANT</text>
          </g>
        </>
      ) : null}

      {/* Optical correction: the circles are mathematically true, but the small seal
          is optically held 1px toward the large disc at the lens so the joint reads
          as intentional at 16px. No contour or shadow is added. */}
      <path fill={ink} d={circlePath(bigCenter, axisY, bigRadius)} />
      <path fill={signal} d={circlePath(smallCenter, axisY, smallRadius)} />
    </g>
  );
}

export default function SharedSecret() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        width: "100%",
        boxSizing: "border-box",
        background: paper,
        color: ink,
        padding: "27px 30px 28px",
        display: "flex",
        flexDirection: "column",
        fontFamily: mono,
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
          color: "#837a72",
          fontSize: 10,
          lineHeight: 1.2,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        <span>ARCANUM — STUDY 28/30</span>
        <span style={{ textAlign: "right" }}>SHARED SECRET</span>
      </header>

      <section
        aria-label="Finished mark"
        style={{
          flex: "1 1 auto",
          minHeight: 390,
          display: "grid",
          placeItems: "center",
          padding: "22px 0 18px",
        }}
      >
        <svg
          width="400"
          height="360"
          viewBox="0 0 393 360"
          role="img"
          aria-label="Two precisely proportioned interlocking circles, one ink and one signal orange"
          style={{ width: "min(400px, 82vw)", height: "auto", display: "block" }}
        >
          <SharedSecretMark />
        </svg>
      </section>

      <section
        aria-label="Construction drawing"
        style={{
          borderTop: `1px solid ${hairline}`,
          paddingTop: 18,
          width: "100%",
          maxWidth: 640,
          margin: "0 auto",
        }}
      >
        <svg
          width="100%"
          height="205"
          viewBox="0 0 560 220"
          role="img"
          aria-label="Shared Secret construction system with two radii, center axis, and golden ratio"
          style={{ display: "block", overflow: "visible" }}
        >
          <g transform="translate(73,-70) scale(.62)">
            <SharedSecretMark opacity={0.3} showGuides />
          </g>
        </svg>
      </section>

      <p
        style={{
          margin: "15px auto 0",
          width: "100%",
          maxWidth: 640,
          color: guide,
          fontSize: 9,
          lineHeight: 1.4,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        TWO PARTIES. ONE GEOMETRY. THE OVERLAP IS THE COVENANT.
      </p>
    </main>
  );
}