import React from "react";

const paper = "#faf6f1";
const ink = "#292522";
const signal = "#ff3c00";
const ember = "#d63200";
const green = "#3f653e";
const gold = "#c9871f";

export default function KeeperRaven() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: paper,
        color: ink,
        overflow: "hidden",
        boxSizing: "border-box",
        padding: "32px 24px 26px",
      }}
    >
      <svg
        aria-label="The Keeper, an angular raven guardian mark"
        viewBox="0 0 520 520"
        width="min(78vw, 500px)"
        height="min(78vw, 500px)"
        role="img"
        style={{ display: "block", flex: "0 0 auto" }}
      >
        {/* A raven assembled from three interlocking A planes. */}
        <path d="M260 28 L448 198 L407 454 L260 492 L113 454 L72 198 Z" fill={ink} />
        <path d="M260 28 L260 492 L113 454 L72 198 Z" fill={ember} />
        <path d="M260 28 L448 198 L407 454 L260 492 Z" fill={signal} />
        {/* crown / beak split: the keeper faces left, alert */}
        <path d="M260 28 L72 198 L170 184 L224 122 Z" fill={gold} />
        <path d="M72 198 L25 242 L153 244 L224 208 Z" fill={ink} />
        <path d="M25 242 L153 244 L114 286 L45 276 Z" fill={signal} />
        {/* negative A aperture, kept intentionally large for silhouette legibility */}
        <path d="M260 110 L357 392 L309 407 L279 320 L205 320 L176 407 L128 392 Z" fill={paper} />
        <path d="M222 268 L262 151 L300 268 Z" fill={ink} />
        <path d="M228 268 L262 169 L289 268 Z" fill={gold} />
        {/* one verified eye / signal aperture */}
        <path d="M185 185 L239 157 L281 185 L239 213 Z" fill={paper} />
        <circle cx="238" cy="185" r="17" fill={green} />
        <circle cx="238" cy="185" r="7" fill={paper} />
        <path d="M244 185 L271 185" stroke={paper} strokeWidth="5" />
        {/* ledger ticks as talons: record, don't decorate */}
        <path d="M141 407 L163 414 L152 449 L131 441 Z" fill={gold} />
        <path d="M174 416 L195 421 L191 457 L170 452 Z" fill={gold} />
        <path d="M325 416 L346 410 L360 444 L339 451 Z" fill={gold} />
        <path d="M293 421 L314 416 L326 451 L305 457 Z" fill={gold} />
        {/* neck seal, a keyhole cut into the machine side */}
        <path d="M355 235 L404 251 L383 303 L344 290 Z" fill={ember} />
        <path d="M371 255 A11 11 0 1 0 371 277 L371 288 L383 288 L383 271 A11 11 0 0 0 371 255 Z" fill={ink} />
      </svg>
      <div
        style={{
          marginTop: "20px",
          fontFamily: '"IBM Plex Mono", "DM Mono", monospace',
          fontSize: "10px",
          letterSpacing: "0.14em",
          color: "#9b9289",
          textTransform: "uppercase",
          textAlign: "center",
          lineHeight: 1.4,
        }}
      >
        ARCANUM — STUDY 11/16 · THE KEEPER
      </div>
    </main>
  );
}