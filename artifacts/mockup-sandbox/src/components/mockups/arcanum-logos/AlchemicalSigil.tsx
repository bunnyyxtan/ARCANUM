import React from "react";

const paper = "#faf6f1";
const ink = "#292522";
const signal = "#ff3c00";
const gold = "#c9871f";
const verified = "#3f653e";

export default function AlchemicalSigil() {
  return (
    <main style={{ minHeight: "100vh", width: "100%", background: paper, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ width: "min(78vw, 500px)", aspectRatio: "1", display: "grid", placeItems: "center" }}>
        <svg viewBox="0 0 500 500" width="100%" height="100%" role="img" aria-label="Alchemical Sigil">
          <title>Alchemical Sigil</title>
          {/* The circle is the governed whole; the square is its ledger; the triangle is the agent's ascent. */}
          <circle cx="250" cy="250" r="164" fill={gold} />
          <path d="M250 52 L428 357 H72 Z" fill={signal} />
          <path d="M112 112 H388 V388 H112 Z" fill={verified} transform="rotate(45 250 250)" />
          {/* deliberate overprint intersections: flat inks, not transparency */}
          <path d="M250 92 A158 158 0 0 1 408 250 L344 250 A94 94 0 0 0 250 156Z" fill="#d67a1f" />
          <path d="M92 250 A158 158 0 0 1 250 92 L250 156 A94 94 0 0 0 156 250Z" fill="#c44824" />
          <path d="M250 408 A158 158 0 0 1 92 250 L156 250 A94 94 0 0 0 250 344Z" fill="#7c4930" />
          {/* square cuts back into the circle, leaving the hidden A as negative geometry */}
          <path d="M250 140 L356 326 H144 Z" fill={ink} />
          <path d="M250 177 L319 298 H181 Z" fill={paper} />
          <path d="M250 205 L300 292 H200 Z" fill={signal} />
          {/* human point: exactly one orange witness completes the operation */}
          <circle cx="250" cy="370" r="13" fill={paper} stroke={ink} strokeWidth="7" />
          <circle cx="250" cy="370" r="5" fill={signal} />
          {/* registration ticks make the mark feel constructed, not decorated */}
          <g stroke={ink} strokeWidth="7" strokeLinecap="square">
            <path d="M250 28V52" /><path d="M250 448V472" />
            <path d="M28 250H52" /><path d="M448 250H472" />
          </g>
        </svg>
      </div>
      <div style={{ marginTop: 26, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.14em", color: "#9b9289", textTransform: "uppercase" }}>
        ARCANUM — STUDY 09/16 · THE SIGIL
      </div>
    </main>
  );
}