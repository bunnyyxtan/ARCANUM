const PAPER = "#faf6f1";
const INK = "#292522";
const SIGNAL = "#ff3c00";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

/**
 * THE GATE / STUDY 33
 *
 * M = 24px. Current rail height = 56px (7M/3), threshold width = 64px
 * (8M/3), and the permitted signal aperture = 32px (4M/3). The opening is
 * one-half of the threshold width and exactly centered on the current axis.
 *
 * Optical corrections:
 * - the gate is 4px wider than a literal 3M module so it survives reduction;
 * - the signal aperture is inset 2px optically from the threshold's side
 *   edges, keeping its orange plane inside the ink structure;
 * - all terminal faces are flat and sheared by 6°, making the current feel
 *   cut with authority rather than rounded like an interface icon.
 */

function GateMark({
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
            <path d="M36 36V220M60 36V220M84 36V220M108 36V220M132 36V220M156 36V220M180 36V220M204 36V220M228 36V220M252 36V220M276 36V220M300 36V220M324 36V220" />
            <path d="M36 36H324M36 60H324M36 84H324M36 108H324M36 132H324M36 156H324M36 180H324M36 204H324" />
          </g>
          <g fill="none" stroke={GUIDE} strokeWidth="1" strokeDasharray="4 5">
            <path d="M36 120H324" />
            <path d="M148 36V204M212 36V204" />
            <path d="M164 74H196M164 166H196" />
          </g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing="0.7">
            <text x="218" y="112">CURRENT AXIS</text>
            <text x="218" y="129">THRESHOLD / 64</text>
            <text x="218" y="146">APERTURE / 32</text>
            <text x="54" y="218">RAIL / 56 · M = 24</text>
          </g>
        </>
      ) : null}

      {/* One filled silhouette: the current runs into a solid threshold. The
          central notch is the only place money can pass. */}
      <path
        fill={INK}
        fillRule="nonzero"
        d="M48 92
           L148 92 L148 42 L212 42 L212 92 L312 92
           L312 148 L212 148 L212 198 L148 198 L148 148 L48 148 Z"
      />

      {/* Human-controlled aperture: flush with both current terminals and
          therefore integrated, never a floating mark or protruding badge. */}
      <path
        fill={SIGNAL}
        d="M164 92 L196 92 L196 148 L164 148 Z"
      />
    </g>
  );
}

export default function TheGate() {
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
        <span>ARCANUM — STUDY 33/34</span>
        <span style={{ textAlign: "right" }}>THE GATE</span>
      </header>

      <section
        aria-label="Finished gate"
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
          viewBox="25 25 310 190"
          role="img"
          aria-label="A bold horizontal current interrupted by a threshold and signal aperture"
          style={{ width: "min(390px, 80vw)", height: "auto", display: "block" }}
        >
          <GateMark />
        </svg>
      </section>

      <section
        aria-label="Gate construction system"
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
          aria-label="Actual gate construction with grid, current axis, threshold, and aperture ratios"
          style={{ display: "block", overflow: "visible" }}
        >
          <g transform="translate(155,-10) scale(.82)">
            <GateMark opacity={0.3} construction />
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
        MONEY PASSES THROUGH THE CHECK. THE APERTURE IS THE HUMAN DECISION.
      </p>
    </main>
  );
}