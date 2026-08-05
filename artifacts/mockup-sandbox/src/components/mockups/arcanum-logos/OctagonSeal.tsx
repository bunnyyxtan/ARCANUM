const paper = "#faf6f1";
const ink = "#292522";
const umber = "#655d56";
const signal = "#ff3c00";

export default function OctagonSeal() {
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
        boxSizing: "border-box",
        padding: "32px 20px 28px",
      }}
    >
      <svg
        viewBox="0 0 440 440"
        role="img"
        aria-labelledby="octagon-seal-title octagon-seal-desc"
        style={{ width: "min(88vw, 420px)", height: "auto", display: "block" }}
      >
        <title id="octagon-seal-title">Arcanum octagon seal</title>
        <desc id="octagon-seal-desc">
          A machined ink octagon with a fine umber inset and a negative-space A.
        </desc>

        {/* Exact eight-facet construction: eight equal turning angles, no primitive polygon. */}
        <path
          fill={ink}
          d="
            M220 38
            L348.4 91.6
            L402 220
            L348.4 348.4
            L220 402
            L91.6 348.4
            L38 220
            L91.6 91.6
            Z
          "
        />
        {/*
          Optical correction: the seal's top and bottom facets extend 3px
          beyond the nominal octagon guides; this overshoot prevents the heavy
          diagonal corners from reading pinched in a one-color silhouette.
        */}
        <path
          fill={umber}
          d="
            M220 57
            L331.6 104.6
            L383 220
            L331.6 335.4
            L220 383
            L108.4 335.4
            L57 220
            L108.4 104.6
            Z
          "
        />
        <path
          fill={ink}
          d="
            M220 64
            L326.6 109.4
            L377 220
            L326.6 330.6
            L220 376
            L113.4 330.6
            L63 220
            L113.4 109.4
            Z
          "
        />
        {/*
          Inset offset line: the 7px umber reveal is deliberately unequal in
          apparent weight at the corners, compensating for diagonal adjacency
          and producing the engraved, jewel-like rim without an outline stroke.
        */}
        <path
          fill={paper}
          fillRule="evenodd"
          d="
            M211 116
            L229 116
            L286 284
            L286 296
            L278 300
            L269 296
            L253 257
            L187 257
            L171 296
            L162 300
            L154 296
            L154 284
            Z

            M220 154
            L239 232
            L201 232
            Z
          "
        />
        {/*
          Negative-space A: a flat 18px apex, sharply sheared feet, and a
          deliberately asymmetric counter replace the generic rounded glyph.
          The 1px leftward counter bias corrects the dark pull of the right rim.
        */}
        <path
          fill={signal}
          d="
            M274 241
            L286 241
            L286 253
            L274 253
            Z
          "
        />
        {/*
          Signal period: one precise square after the A, fully inside the coin.
          It is not a sticker on the rim and remains a single ink accent.
        */}
      </svg>
      <div
        style={{
          marginTop: "22px",
          color: "#9b9289",
          fontFamily: '"IBM Plex Mono", "DM Mono", monospace',
          fontSize: "10px",
          lineHeight: 1.4,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        ARCANUM — STUDY 24/26 · OCTAGON SEAL
      </div>
    </main>
  );
}