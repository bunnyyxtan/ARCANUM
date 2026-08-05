import React from "react";

const paper = "#faf6f1";
const ink = "#292522";
const signal = "#ff3c00";
const ember = "#d63200";
const amber = "#f2a03d";
const green = "#3f653e";

function OuroborosMark() {
  return (
    <svg viewBox="0 0 520 520" width="min(78vw, 500px)" height="min(78vw, 500px)" role="img" aria-label="Ouroboros flow mark">
      <defs>
        <path id="ring" d="M260 76a184 184 0 1 1-130 54" />
      </defs>
      {/* machine half: an exact, heavy circular current */}
      <path d="M130 130A184 184 0 0 1 390 390" fill="none" stroke={ink} strokeWidth="58" strokeLinecap="butt" />
      {/* human half: warm attention closing the circuit */}
      <path d="M390 390A184 184 0 0 1 130 130" fill="none" stroke={signal} strokeWidth="58" strokeLinecap="butt" />
      {/* overprint seam: the shared decision, not a gap */}
      <path d="M130 130A184 184 0 0 1 390 390" fill="none" stroke={green} strokeWidth="58" strokeDasharray="9 12" strokeLinecap="butt" opacity=".92" />
      <path d="M130 130A184 184 0 0 1 390 390" fill="none" stroke={ink} strokeWidth="58" strokeDasharray="0 238 45 876" strokeLinecap="butt" />
      {/* geometric serpent head, pointed toward the countersign */}
      <path d="M93 111L153 96L137 157L115 141Z" fill={ink} />
      <path d="M93 111L121 119L115 141Z" fill={amber} />
      <path d="M100 110L111 107L107 119Z" fill={paper} />
      {/* signature nib where the human hand closes the loop */}
      <path d="M390 360L434 402L374 417Z" fill={amber} />
      <path d="M390 360L404 400L374 417Z" fill={ember} />
      <path d="M393 374L405 389L391 392Z" fill={paper} />
      {/* three ledger cuts: movement made legible */}
      <path d="M222 58h76" stroke={amber} strokeWidth="8" />
      <path d="M211 76h98" stroke={green} strokeWidth="5" />
      <path d="M201 91h118" stroke={ink} strokeWidth="3" />
      <circle cx="260" cy="260" r="85" fill={paper} />
      <path d="M260 202v116M202 260h116" stroke={ink} strokeWidth="10" />
      <path d="M233 260h54" stroke={signal} strokeWidth="10" />
      <circle cx="260" cy="260" r="13" fill={green} />
    </svg>
  );
}

export default function OuroborosFlow() {
  return (
    <main style={{ minHeight: "100dvh", width: "100%", background: paper, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxSizing: "border-box", padding: "28px 18px 22px" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
        <OuroborosMark />
      </div>
      <div style={{ color: "#9b9289", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", textAlign: "center" }}>
        ARCANUM — STUDY 13 · OUROBOROS
      </div>
    </main>
  );
}