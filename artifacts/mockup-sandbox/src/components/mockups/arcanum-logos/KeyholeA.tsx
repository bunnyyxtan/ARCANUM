import React from "react";

const ink = "#292522";
const paper = "#faf6f1";
const signal = "#ff3c00";

export default function KeyholeA() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        background: paper,
        color: ink,
      }}
    >
      <svg
        aria-label="ARCANUM Keyhole A mark"
        role="img"
        viewBox="0 0 440 440"
        style={{
          display: "block",
          width: "min(440px, 76vw)",
          height: "auto",
          marginTop: "-1.5rem",
        }}
      >
        <path
          fill={ink}
          d="M220 30 399 401h-82l-38-91h-118l-39 91H41L220 30Zm0 111-39 105h78l-39-105Z"
          fillRule="evenodd"
        />
        <path
          fill={paper}
          d="M220 135a47 47 0 1 0 47 47c0-18-10-34-25-42v-5h-44Z"
        />
        <path fill={paper} d="M194 183h52v112h-52z" />
        <circle cx="220" cy="299" r="8" fill={signal} />
      </svg>

      <div
        style={{
          position: "absolute",
          bottom: "28px",
          left: "24px",
          right: "24px",
          textAlign: "center",
          fontFamily: '"IBM Plex Mono", "SFMono-Regular", Consolas, monospace',
          fontSize: "10px",
          lineHeight: 1.2,
          letterSpacing: "0.14em",
          color: "#9b9289",
          textTransform: "uppercase",
        }}
      >
        ARCANUM — STUDY 19 · KEYHOLE A
      </div>
    </main>
  );
}