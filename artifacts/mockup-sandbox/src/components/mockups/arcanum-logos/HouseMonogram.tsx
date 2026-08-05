const paper = "#faf6f1";
const ink = "#292522";
const signal = "#ff3c00";

export default function HouseMonogram() {
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
        aria-labelledby="house-monogram-title house-monogram-desc"
        style={{ width: "min(88vw, 420px)", height: "auto", display: "block" }}
      >
        <title id="house-monogram-title">Arcanum house monogram</title>
        <desc id="house-monogram-desc">
          A bespoke, heavy serif A with a signal-colored cut at the crossbar joint.
        </desc>
        <path
          fill={ink}
          fillRule="evenodd"
          d="
            M220 54
            C213.6 54 208.6 59.4 204.3 68.9
            L82 343.3
            L85 359.5
            L96 370
            L110.5 370
            L127.5 356
            L150.7 301.2
            L289.3 301.2
            L312.5 356
            L329.5 370
            L344 370
            L355 359.5
            L358 343.3
            L235.7 68.9
            C231.4 59.4 226.4 54 220 54
            Z

            M220 119.3
            C217.8 119.3 216 122.1 213.8 127.8
            L166.8 263.7
            L273.2 263.7
            L226.2 127.8
            C224 122.1 222.2 119.3 220 119.3
            Z
          "
        />
        {/*
          Optical corrections: the apex is held 6px proud of the cap-height guide;
          both feet overshoot the crossbar's visual baseline by 4px. The flat,
          sheared terminals avoid a soft capsule ending. The inner
          counter is not a mathematically centered triangle: its shoulder is
          pulled inward to compensate for the dark diagonal joints.
        */}
        <path
          fill={ink}
          d="
            M145 260
            L295 260
            L295 304
            L145 304
            Z
          "
        />
        {/*
          Solid crossbar: it overlaps both diagonals by 5px on each side, so
          there is no hairline seam or outlined-box artifact at the joins.
        */}
        <path
          fill={paper}
          d="M274 271 L290 271 L290 287 L274 287 Z"
        />
        {/*
          Signal counter: the paper punch is fully contained inside the ink
          crossbar, with a signal square nested inside it. This is one integrated
          period-like cut, never a floating accent.
        */}
        <path
          fill={signal}
          d="
            M278 275
            L286 275
            L286 283
            L278 283
            Z
          "
        />
        {/*
          Ink-trap correction: the counter's 2px paper reveal keeps the signal
          square from visually merging into the right diagonal at app-icon size.
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
        ARCANUM — STUDY 23/26 · HOUSE MONOGRAM
      </div>
    </main>
  );
}