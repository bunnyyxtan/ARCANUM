import React from "react";

const palette = {
  paper: "#faf6f1",
  ink: "#292522",
  gold: "#c9871f",
  amber: "#f2a03d",
  signal: "#ff3c00",
  green: "#3f653e",
};

export default function KeyOfA() {
  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: palette.paper,
        color: palette.ink,
        overflow: "hidden",
      }}
    >
      <svg
        width="min(78vw, 500px)"
        height="min(78vw, 500px)"
        viewBox="0 0 500 500"
        role="img"
        aria-label="Key of A: a key shaped like the letter A"
        style={{ display: "block", flex: "0 0 auto" }}
      >
        {/* The two legs are a single impossible-to-misread A, with a key bow at its crown. */}
        <path
          d="M108 407 188 144a73 73 0 0 1 124 0l80 263h-60l-17-61H185l-17 61h-60Zm91-113h102l-32-118a20 20 0 0 0-38 0l-32 118Z"
          fill={palette.gold}
        />
        {/* negative counter gives the mark its A silhouette and the shaft its authority */}
        <path d="M230 235h40l9 35h-58l9-35Z" fill={palette.paper} />
        {/* bow: a precise key ring, not an ornamental halo */}
        <circle cx="250" cy="111" r="59" fill={palette.ink} />
        <circle cx="250" cy="111" r="31" fill={palette.paper} />
        <path d="M224 132h52l18 27h-88l18-27Z" fill={palette.ink} />
        {/* the machine-side teeth; these are also the A's grounded foot */}
        <path d="M230 407h52v18h23v18h-23v18h-22v-18h-30v18h-22v-18h-22v-18h44v-18Z" fill={palette.ink} />
        {/* orange human-attention ward and verified green pin */}
        <circle cx="250" cy="111" r="12" fill={palette.signal} />
        <circle cx="250" cy="111" r="5" fill={palette.amber} />
        <path d="M337 252h17v17h-17z" fill={palette.green} />
      </svg>
      <div
        style={{
          marginTop: 28,
          fontFamily: '"IBM Plex Mono", "DM Mono", monospace',
          fontSize: 10,
          letterSpacing: "0.14em",
          lineHeight: 1.4,
          color: "#9b9289",
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        ARCANUM — STUDY 15/16 · KEY OF A
      </div>
    </main>
  );
}