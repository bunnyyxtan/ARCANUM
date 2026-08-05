export default function TwinPeaks() {
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
        aria-labelledby="twin-peaks-title twin-peaks-description"
        style={{
          width: "min(66vw, 420px)",
          height: "auto",
          display: "block",
          flex: "0 0 auto",
        }}
      >
        <title id="twin-peaks-title">ARCANUM Twin Peaks mark</title>
        <desc id="twin-peaks-description">
          Two solid, overlapping peaks form a weighty letter A. Their
          countersign is held in a single orange keystone.
        </desc>
        <g shapeRendering="geometricPrecision">
          <path
            d="M55 337L176 71H224L142 337H55Z"
            fill="#292522"
          />
          <path
            d="M196 71H244L365 337H278L196 71Z"
            fill="#292522"
          />
          <path
            d="M187 71H233L258 126L211 226L164 126L187 71Z"
            fill="#ff3c00"
          />
          <path
            d="M137 238H284L301 276H121L137 238Z"
            fill="#292522"
          />
          <path
            d="M183 71H229L211 111L193 71H183Z"
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
        ARCANUM — STUDY 21 · TWIN PEAKS
      </p>
    </main>
  );
}