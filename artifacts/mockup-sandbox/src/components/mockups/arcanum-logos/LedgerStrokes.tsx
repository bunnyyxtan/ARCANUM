export default function LedgerStrokes() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        background: "#faf6f1",
        color: "#292522",
        boxSizing: "border-box",
        padding: "32px 24px 58px",
      }}
    >
      <svg
        viewBox="0 0 420 420"
        role="img"
        aria-labelledby="ledger-strokes-title ledger-strokes-description"
        style={{
          width: "min(66vw, 420px)",
          height: "auto",
          display: "block",
          flex: "0 0 auto",
        }}
      >
        <title id="ledger-strokes-title">ARCANUM Ledger Strokes mark</title>
        <desc id="ledger-strokes-description">
          Three heavy geometric strokes compose an abstract letter A. The
          orange ruled crossbar is the human countersign.
        </desc>
        <g shapeRendering="geometricPrecision">
          <path
            d="M62 337L151 73H204L135 337H62Z"
            fill="#292522"
          />
          <path
            d="M216 73H269L358 337H285L216 73Z"
            fill="#292522"
          />
          <path
            d="M112 217H309V260H112V217Z"
            fill="#ff3c00"
          />
        </g>
      </svg>
      <p
        style={{
          position: "absolute",
          bottom: "24px",
          left: "24px",
          right: "24px",
          margin: 0,
          textAlign: "center",
          color: "#9b9289",
          fontFamily: '"IBM Plex Mono", "Courier New", monospace',
          fontSize: "10px",
          fontWeight: 400,
          lineHeight: 1.2,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        ARCANUM — STUDY 22 · LEDGER STROKES
      </p>
    </main>
  );
}