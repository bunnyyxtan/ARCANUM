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

function KeystoneMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      viewBox="0 0 340 340"
      role="img"
      aria-label="Arcanum keystone monogram"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Arcanum Keystone Monogram</title>
      <path
        fill={ink}
        fillRule="evenodd"
        d="M56 286 137 58V34h66v24l81 228h-58l-17-58h-78l-17 58H56Zm91-109h48l-24-84-24 84Z"
      />
      <path
        fill={signal}
        d="M137 34h66v31h-23l-10 10-10-10h-23V34Z"
      />
    </svg>
  );
}

export default function KeystoneSolid() {
  return (
    <main style={plateStyle}>
      <KeystoneMark
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
        ARCANUM — STUDY 17 · KEYSTONE MONOGRAM
      </div>
    </main>
  );
}