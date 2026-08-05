const paper = "#faf6f1";
const ink = "#292522";
const signal = "#ff3c00";
const umber = "#655d56";
const hairline = "#ded7d0";
const guide = "#9b9289";
const mono = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

function CountersignMark({
  opacity = 1,
  showGuides = false,
}: {
  opacity?: number;
  showGuides?: boolean;
}) {
  return (
    <g opacity={opacity}>
      {showGuides ? (
        <>
          {/* Real construction system: 8px module, 214px crossbar datum, 24° leg angle. */}
          <g fill="none" stroke={hairline} strokeWidth="1">
            <path d="M52 302H306M72 278H286M92 254H266M112 230H246M132 206H226M152 182H206M172 158H186M192 134H196M212 110H216M232 86H236M252 62H256" />
            <path d="M60 318V38M84 318V38M108 318V38M132 318V38M156 318V38M180 318V38M204 318V38M228 318V38M252 318V38M276 318V38M300 318V38" />
          </g>
          <g fill="none" stroke={guide} strokeWidth="1" strokeDasharray="4 5">
            <path d="M98 214H236" />
            <path d="M78 302L148 54M280 302L196 54" />
            <path d="M120 214H232" />
          </g>
          <g fill={guide}>
            <path d="M98 210L98 218L106 214Z" />
            <path d="M236 210L236 218L228 214Z" />
            <path d="M143 54H201M172 42V66" />
          </g>
          <g fill={guide} fontFamily={mono} fontSize="7" letterSpacing="1">
            <text x="164" y="207">CROSSBAR DATUM / M27</text>
            <text x="176" y="35">APEX +6</text>
            <text x="70" y="328">8 PX MODULE</text>
          </g>
        </>
      ) : null}

      {/* Optical correction: the apex is lifted 6px and its joint is thinned by 2px
          so the dark overlap does not visually bulge. Flat sheared terminals overshoot
          the baseline by 4px, preserving weight at small sizes. */}
      <path
        fill={ink}
        fillRule="nonzero"
        d="M78 302L148 54L172 54L145 224L122 302L78 302Z"
      />
      <path
        fill={ink}
        fillRule="nonzero"
        d="M172 54L196 54L280 302L232 302L208 224L172 54Z"
      />
      {/* The human countersign is exactly one stroke-weight period on the absent datum. */}
      <path
        fill={signal}
        d="M164 214C164 207.373 169.373 202 176 202C182.627 202 188 207.373 188 214C188 220.627 182.627 226 176 226C169.373 226 164 220.627 164 214Z"
      />
    </g>
  );
}

export default function CountersignA() {
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
        <span>ARCANUM — STUDY 27/30</span>
        <span style={{ textAlign: "right" }}>COUNTERSIGN A</span>
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
          width="380"
          height="380"
          viewBox="0 0 360 360"
          role="img"
          aria-label="A geometric A with its crossbar replaced by an orange period"
          style={{ width: "min(380px, 76vw)", height: "auto", display: "block" }}
        >
          <CountersignMark />
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
          height="225"
          viewBox="0 0 560 220"
          role="img"
          aria-label="Countersign A construction system with crossbar datum and module grid"
          style={{ display: "block", overflow: "visible" }}
        >
          <g transform="translate(100,-48) scale(.7)">
            <CountersignMark opacity={0.3} showGuides />
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
        THE HUMAN PERIOD COMPLETES THE LETTER.
      </p>
    </main>
  );
}