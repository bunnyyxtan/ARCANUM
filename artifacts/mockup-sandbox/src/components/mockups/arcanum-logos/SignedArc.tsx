import type { CSSProperties, SVGProps } from "react";

const paper = "#faf6f1";
const ink = "#292522";
const signal = "#ff3c00";
const caption = "#9b9289";

const plateStyle: CSSProperties = {
  minHeight: "100dvh",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "34px",
  background: paper,
  color: ink,
  boxSizing: "border-box",
  padding: "28px",
};

function SignedArcMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 340 340"
      role="img"
      aria-label="Arcanum signed arc mark"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Arcanum Signed Arc</title>
      <path
        fill={ink}
        fillRule="evenodd"
        d="M210 39.5A126 126 0 1 0 266 101l-51.5 21.6a70 70 0 1 1-26.1-36.8L210 39.5Z"
      />
      <circle fill={signal} cx="226" cy="80" r="19" />
    </svg>
  );
}

export default function SignedArc() {
  return (
    <main style={plateStyle}>
      <SignedArcMark
        width="min(440px, 74vw)"
        height="min(440px, 74vw)"
        style={{ display: "block" }}
      />
      <div
        style={{
          color: caption,
          fontFamily: '"IBM Plex Mono", "Courier New", monospace',
          fontSize: "10px",
          fontWeight: 400,
          letterSpacing: "0.14em",
          lineHeight: 1.4,
          textAlign: "center",
          textTransform: "uppercase",
        }}
      >
        ARCANUM — STUDY 18 · SIGNED ARC
      </div>
    </main>
  );
}