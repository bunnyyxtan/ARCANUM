import React from "react";

const palette = {
  paper: "#faf6f1",
  ink: "#292522",
  oxblood: "#8c2f1b",
  ember: "#d63200",
  signal: "#ff3c00",
  gold: "#c9871f",
  green: "#3f653e",
};

export default function MagnumOpus() {
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
        aria-label="Magnum Opus: an ascending A made from alchemical strata"
        style={{ display: "block", flex: "0 0 auto" }}
      >
        {/* Each stepped band is a recorded stage: raw machine matter becoming trusted value. */}
        <path d="M81 420h338v-35h-59l-34-97H174l-34 97H81v35Z" fill={palette.ink} />
        <path d="M112 385h276l-14-42H126l-14 42Z" fill={palette.oxblood} />
        <path d="m143 343 214 0-17-47H160l-17 47Z" fill={palette.ember} />
        <path d="m169 296 162 0-16-44H185l-16 44Z" fill={palette.signal} />
        <path d="m195 252 110 0-18-57h-74l-18 57Z" fill={palette.gold} />
        {/* apex is an A, not a generic mountain: the cut is the human policy boundary */}
        <path d="M221 195 250 95l29 100h-20l-9-31-9 31h-20Z" fill={palette.gold} />
        <path d="M243 174h14l-7-24-7 24Z" fill={palette.paper} />
        {/* A's crossbar / signed approval, deliberately offset like an ink stamp */}
        <path d="M205 247h90v15h-90z" fill={palette.ink} />
        <path d="M226 247h48v6h-48z" fill={palette.paper} />
        {/* verified state: a small green seal locked into the final band */}
        <circle cx="369" cy="367" r="13" fill={palette.green} />
        <path
          d="m363 367 4 4 8-9"
          fill="none"
          stroke={palette.paper}
          strokeWidth="3"
          strokeLinecap="square"
          strokeLinejoin="miter"
        />
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
        ARCANUM — STUDY 16/16 · MAGNUM OPUS
      </div>
    </main>
  );
}