import React from "react";

const paper = "#faf6f1";
const ink = "#292522";
const signal = "#ff3c00";
const amber = "#f2a03d";
const green = "#3f653e";
const oxblood = "#8c2f1b";

function CountersignMark() {
  return (
    <svg viewBox="0 0 520 520" width="min(78vw, 500px)" height="min(78vw, 500px)" role="img" aria-label="Countersign knot mark">
      {/* two ribbons make a single monumental A; flat over-under cells are the proof */}
      <path d="M93 405L212 106Q220 86 239 86Q258 86 266 106L384 405H320L244 206L168 405Z" fill={ink} />
      <path d="M128 405L232 151L259 216L180 405Z" fill={signal} />
      <path d="M291 405L245 286L280 286L350 405Z" fill={amber} />
      {/* crossbar / countersign bond */}
      <path d="M153 288H368L386 338H133Z" fill={green} />
      {/* overprint at the crossing: consent is neither ribbon alone */}
      <path d="M185 288H276L294 338H167Z" fill={oxblood} />
      <path d="M276 288H368L386 338H294Z" fill={ink} />
      {/* woven ends, deliberately squared like a seal */}
      <path d="M93 405h88l-24 31H76Z" fill={ink} />
      <path d="M350 405h34l24 31h-87Z" fill={amber} />
      <path d="M76 436h81l-13 18H63Z" fill={signal} />
      <path d="M301 436h87l14 18h-87Z" fill={green} />
      {/* aperture: an accountable interior, not empty negative space */}
      <path d="M239 174L214 252H265Z" fill={paper} />
      <path d="M214 252h51l10 28h-71Z" fill={paper} />
      {/* three small witness marks */}
      <rect x="205" y="62" width="18" height="8" fill={green} />
      <rect x="230" y="62" width="60" height="8" fill={amber} />
      <rect x="297" y="62" width="18" height="8" fill={signal} />
    </svg>
  );
}

export default function CountersignKnot() {
  return (
    <main style={{ minHeight: "100dvh", width: "100%", background: paper, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxSizing: "border-box", padding: "28px 18px 22px" }}>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
        <CountersignMark />
      </div>
      <div style={{ color: "#9b9289", fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", textAlign: "center" }}>
        ARCANUM — STUDY 14 · COUNTERSIGN KNOT
      </div>
    </main>
  );
}