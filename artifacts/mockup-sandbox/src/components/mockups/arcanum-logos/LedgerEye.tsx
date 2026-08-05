import React from "react";

const field = "#292522";
const ink = "#292522";
const paper = "#faf6f1";
const signal = "#ff3c00";
const ember = "#d63200";
const amber = "#f2a03d";
const gold = "#c9871f";
const green = "#3f653e";

function tickMarks(cx: number, cy: number, radius: number, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    const major = i % 3 === 0;
    const r1 = radius - (major ? 17 : 10);
    const r2 = radius + 1;
    return (
      <line
        key={i}
        x1={cx + Math.cos(angle) * r1}
        y1={cy + Math.sin(angle) * r1}
        x2={cx + Math.cos(angle) * r2}
        y2={cy + Math.sin(angle) * r2}
        stroke={major ? amber : gold}
        strokeWidth={major ? 5 : 2}
        strokeLinecap="square"
      />
    );
  });
}

export default function LedgerEye() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: field,
        color: paper,
        overflow: "hidden",
        boxSizing: "border-box",
        padding: "32px 24px 26px",
      }}
    >
      <svg
        aria-label="Ledger Eye, an eye with concentric ledger rings"
        viewBox="0 0 520 520"
        width="min(78vw, 500px)"
        height="min(78vw, 500px)"
        role="img"
        style={{ display: "block", flex: "0 0 auto" }}
      >
        {/* eye silhouette: two hard arcs, authority without pyramid cliché */}
        <path d="M34 260 Q260 58 486 260 Q260 462 34 260 Z" fill={paper} />
        <path d="M34 260 Q260 58 486 260 Q260 462 34 260 Z" fill={signal} transform="translate(0 12)" />
        <path d="M65 260 Q260 101 455 260 Q260 419 65 260 Z" fill={field} />
        <path d="M65 260 Q260 101 455 260 Q260 419 65 260 Z" fill={ember} transform="translate(0 9)" />
        <path d="M86 260 Q260 128 434 260 Q260 392 86 260 Z" fill={field} />
        {/* stepped rings: each is an auditable entry, not an ornamental gradient */}
        <circle cx="260" cy="260" r="129" fill="none" stroke={gold} strokeWidth="17" />
        <circle cx="260" cy="260" r="101" fill="none" stroke={amber} strokeWidth="15" />
        <circle cx="260" cy="260" r="74" fill="none" stroke={signal} strokeWidth="13" />
        {tickMarks(260, 260, 139, 24)}
        {tickMarks(260, 260, 108, 16)}
        {/* machine pupil, cut like a keyhole */}
        <circle cx="260" cy="260" r="49" fill={field} stroke={paper} strokeWidth="8" />
        <path d="M260 224 A22 22 0 1 0 260 268 L260 310 L282 310 L282 268 A22 22 0 0 0 260 224 Z" fill={ink} />
        {/* exactly one human decision / verified signal tick */}
        <path d="M260 88 L276 115 L260 143 L244 115 Z" fill={green} />
        <path d="M260 88 L260 143" stroke={paper} strokeWidth="4" />
        <circle cx="260" cy="260" r="11" fill={green} />
      </svg>
      <div
        style={{
          marginTop: "20px",
          fontFamily: '"IBM Plex Mono", "DM Mono", monospace',
          fontSize: "10px",
          letterSpacing: "0.14em",
          color: "rgba(250,246,241,.55)",
          textTransform: "uppercase",
          textAlign: "center",
          lineHeight: 1.4,
        }}
      >
        ARCANUM — STUDY 12/16 · LEDGER EYE
      </div>
    </main>
  );
}