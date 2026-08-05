import React from "react";

const paper = "#faf6f1";
const ink = "#292522";
const signal = "#ff3c00";
const ember = "#d63200";
const amber = "#f2a03d";
const gold = "#c9871f";
const verified = "#3f653e";

export default function VaultSun() {
  const rays = Array.from({ length: 16 }, (_, i) => {
    const angle = (i * 360) / 16 - 90;
    const a = (angle * Math.PI) / 180;
    const x1 = 250 + Math.cos(a) * 145;
    const y1 = 250 + Math.sin(a) * 145;
    const x2 = 250 + Math.cos(a) * 218;
    const y2 = 250 + Math.sin(a) * 218;
    const perp = { x: -Math.sin(a) * 11, y: Math.cos(a) * 11 };
    return <path key={i} d={`M${x1 + perp.x} ${y1 + perp.y} L${x2 + perp.x} ${y2 + perp.y} L${x2 - perp.x} ${y2 - perp.y} L${x1 - perp.x} ${y1 - perp.y}Z`} fill={i % 4 === 0 ? signal : i % 4 === 1 ? ember : i % 4 === 2 ? amber : gold} />;
  });

  return (
    <main style={{ minHeight: "100vh", width: "100%", background: ink, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <div style={{ width: "min(78vw, 500px)", aspectRatio: "1", display: "grid", placeItems: "center" }}>
        <svg viewBox="0 0 500 500" width="100%" height="100%" role="img" aria-label="Vault Sun">
          <title>Vault Sun</title>
          {/* stepped rays: each band carries the warm ledger from attention to reward */}
          <g>{rays}</g>
          <circle cx="250" cy="250" r="151" fill={gold} />
          <circle cx="250" cy="250" r="132" fill={amber} />
          <circle cx="250" cy="250" r="111" fill={signal} />
          {/* seal aperture: a keyhole and a precise A share one silhouette */}
          <path d="M250 151 C220 151 199 175 199 204 C199 226 211 242 229 250 L208 340 H292 L271 250 C289 242 301 226 301 204 C301 175 280 151 250 151Z" fill={ink} />
          <path d="M250 176 L216 311 H234 L241 280 H259 L266 311 H284 Z M245 260 L250 218 L255 260Z" fill={paper} />
          {/* the verified human signature: green, small, unmistakable */}
          <path d="M223 350 H277 V370 H223Z" fill={verified} />
          <path d="M236 350 V370 M264 350 V370" stroke={paper} strokeWidth="5" />
          <circle cx="250" cy="250" r="151" fill="none" stroke={ink} strokeWidth="8" />
        </svg>
      </div>
      <div style={{ marginTop: 26, fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, letterSpacing: "0.14em", color: "rgba(250,246,241,.55)", textTransform: "uppercase" }}>
        ARCANUM — STUDY 10/16 · VAULT SUN
      </div>
    </main>
  );
}