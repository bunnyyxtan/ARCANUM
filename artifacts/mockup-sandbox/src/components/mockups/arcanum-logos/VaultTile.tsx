import React from "react";

const ink = "#292522";
const paper = "#faf6f1";
const signal = "#ff3c00";

export default function VaultTile() {
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
        aria-label="ARCANUM Vault Tile mark"
        role="img"
        viewBox="0 0 440 440"
        style={{
          display: "block",
          width: "min(420px, 74vw)",
          height: "auto",
          marginTop: "-1.5rem",
        }}
      >
        <rect x="38" y="38" width="364" height="364" rx="52" fill={ink} />
        <path
          fill={paper}
          fillRule="evenodd"
          d="M220 91 316 303h-48l-18-43h-60l-18 43h-48l96-212Zm0 63-25 67h50l-25-67Z"
        />
        <circle cx="315" cy="303" r="11" fill={signal} />
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
        ARCANUM — STUDY 20 · VAULT TILE
      </div>
    </main>
  );
}