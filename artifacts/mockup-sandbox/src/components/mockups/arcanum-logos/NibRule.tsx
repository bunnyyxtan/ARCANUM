const PAPER = "#faf6f1";
const INK = "#292522";
const SIGNAL = "#ff3c00";

export default function NibRule() {
  return (
    <main
      className="min-h-screen w-full flex flex-col items-center justify-center"
      style={{
        minHeight: "100dvh",
        background: PAPER,
        color: INK,
        padding: "32px 20px 28px",
        boxSizing: "border-box",
      }}
    >
      <svg
        viewBox="0 0 480 480"
        width="420"
        height="420"
        role="img"
        aria-labelledby="nib-title nib-desc"
        style={{ width: "min(84vw, 420px)", height: "auto", display: "block" }}
      >
        <title id="nib-title">Arcanum Nib and Rule</title>
        <desc id="nib-desc">
          A modulated architectural A whose left stem resolves into a pen nib.
        </desc>

        {/* Optical correction: the apex is proud of the cap line; the left
            shoulder enters with a slightly lighter curve to equalize the
            heavier nib terminal. Diagonal ends are crisp, not rounded. */}
        <path
          fill={INK}
          fillRule="evenodd"
          d="M237 64
             C246 64 252 73 257 85
             L397 384
             L386 407
             L367 397
             L304 260
             L273 260
             L269 253
             L278 225
             L245 150
             C242 143 240 140 238 140
             C235 140 233 145 230 153
             L193 258
             L164 323
             L132 396
             L124 408
             L112 414
             L103 386
             L219 85
             C224 72 229 64 237 64 Z
             M238 143
             C236 143 234 148 231 156
             L197 252
             L280 252
             L246 156
             C243 148 241 143 238 143 Z"
        />

        {/* One clean counter only; all other decorative notches are removed. */}
        <path
          fill={PAPER}
          d="M198 249 L280 249 L286 266 L192 266 Z"
        />

        {/* Crossbar rule: a precisely weighted rule, fully contained by the
            diagonals. Its signal square is part of the terminal, never a nub. */}
        <path
          fill={INK}
          d="M151 250 L322 250 L326 267 L322 284 L158 284 L154 267 Z"
        />

        {/* Signal square: the right terminal stops inside the right diagonal's
            silhouette and shares the rule's exact baseline. */}
        <path
          fill={SIGNAL}
          d="M306 250 L322 250 L326 267 L322 284 L306 284 Z"
        />

        {/* The left foot resolves into a recognizable pen nib: the parent
            stroke itself ends in a pointed terminal. Only one slit and one
            vent hole are cut into it; both are deliberate counters. */}
        <path
          fill={PAPER}
          d="M113 398
             C115 401 116 405 115 409
             L112 412
             L111 403 Z"
        />
        <path
          fill={PAPER}
          d="M113 394
             C116 393 119 395 119 398
             C118 400 115 400 113 398
             C112 397 112 395 113 394 Z"
        />
      </svg>

      <p
        style={{
          margin: "18px 0 0",
          color: "#9b9289",
          fontFamily: '"IBM Plex Mono", "DM Mono", monospace',
          fontSize: "10px",
          lineHeight: 1.2,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        ARCANUM — STUDY 26/26 · NIB &amp; RULE
      </p>
    </main>
  );
}