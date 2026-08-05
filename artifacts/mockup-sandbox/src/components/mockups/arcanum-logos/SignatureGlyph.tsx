const paper = "#faf6f1";
const ink = "#292522";
const signal = "#ff3c00";
const hairline = "#ded7d0";
const guide = "#9b9289";

// A bespoke high-contrast A: wedge serifs, curved stress, and a deliberately tightened apex.
const glyphPath =
  "M 72 320 L 110 320 L 181 91 C 184 80 191 74 201 74 C 211 74 218 81 221 92 L 292 320 L 330 320 L 330 334 L 244 334 L 244 320 L 270 320 L 251 254 L 150 254 L 130 320 L 159 320 L 159 334 L 72 334 Z M 170 238 L 231 238 L 201 125 Z";

const periodPath =
  "M 347 317 C 352 317 356 321 356 326 C 356 331 352 335 347 335 C 342 335 338 331 338 326 C 338 321 342 317 347 317 Z";

function ConstructionSystem() {
  return (
    <svg
      viewBox="0 0 430 400"
      role="img"
      aria-label="Signature glyph with cap height, baseline, overshoot, and stress axis"
      className="construction-svg"
    >
      <g fill="none" stroke={guide} strokeWidth="1" opacity="0.65">
        {/* Real typographic guides used by the glyph: cap, baseline, overshoot, and serif floor. */}
        <path d="M 46 88 H 370 M 46 74 H 370 M 46 320 H 370 M 46 334 H 370" />
        {/* Circle grid: the apex bowl and counter are corrected against these radii, not eyeballed. */}
        <circle cx="201" cy="190" r="16" />
        <circle cx="201" cy="190" r="61" />
        <circle cx="201" cy="190" r="123" />
        {/* Stress axis follows the slight calligraphic lean of the thick downstroke. */}
        <path d="M 184 340 L 218 68" strokeDasharray="4 5" />
        <path d="M 150 254 L 251 254 M 170 238 L 231 238" />
        <path d="M 110 320 L 181 91 M 221 92 L 292 320" />
      </g>
      <g stroke={guide} strokeWidth="1" opacity="0.72">
        {/* 14px baseline modules establish the period's exact relationship to the serif floor. */}
        <path d="M 72 312 V 328 M 86 314 V 326 M 100 314 V 326 M 114 314 V 326 M 128 314 V 326 M 142 314 V 326 M 156 314 V 326 M 170 314 V 326 M 184 314 V 326 M 198 314 V 326 M 212 314 V 326 M 226 314 V 326 M 240 314 V 326 M 254 314 V 326 M 268 314 V 326 M 282 314 V 326 M 296 314 V 326 M 310 314 V 326 M 324 312 V 328 M 338 312 V 328 M 356 312 V 328" />
      </g>
      <path d={glyphPath} fill={ink} fillRule="evenodd" opacity="0.3" />
      <path d={periodPath} fill={signal} opacity="0.72" />
    </svg>
  );
}

export default function SignatureGlyph() {
  return (
    <main className="arcanum-plate glyph-plate">
      <style>{`
        .arcanum-plate {
          min-height: 100vh;
          width: 100%;
          box-sizing: border-box;
          padding: 30px 34px 28px;
          background: ${paper};
          color: ${ink};
          display: flex;
          flex-direction: column;
          font-family: "IBM Plex Mono", "Courier New", monospace;
        }
        .plate-meta {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          color: #837a72;
          font-size: 10px;
          line-height: 1.2;
          letter-spacing: .14em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .plate-meta span:last-child { text-align: right; }
        .plate-hero {
          flex: 1 1 auto;
          min-height: 422px;
          display: grid;
          place-items: center;
        }
        .hero-svg {
          width: min(410px, 76vw);
          height: auto;
          display: block;
        }
        .construction {
          border-top: 1px solid ${hairline};
          min-height: 216px;
          display: grid;
          place-items: center;
        }
        .construction-svg {
          width: min(205px, 48vw);
          height: auto;
          display: block;
        }
        .plate-rationale {
          margin: 19px 0 0;
          color: ${guide};
          font-size: 9px;
          line-height: 1.4;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        @media (max-width: 520px) {
          .arcanum-plate { padding: 25px 22px 22px; }
          .plate-hero { min-height: 372px; }
          .construction { min-height: 186px; }
          .plate-rationale { margin-top: 15px; }
        }
      `}</style>
      <header className="plate-meta">
        <span>ARCANUM — STUDY 30/30</span>
        <span>THE SIGNATURE GLYPH</span>
      </header>

      <section className="plate-hero" aria-label="Finished Signature Glyph mark">
        <svg viewBox="0 0 430 400" role="img" aria-label="Bespoke A signature glyph with signal period" className="hero-svg">
          {/* Optical correction: 14px overshoot above cap height prevents the apex from appearing short beside flat capitals. */}
          {/* Joint thinning: the counter pinches to a clean ink trap before opening into the crossbar. */}
          <path d={glyphPath} fill={ink} fillRule="evenodd" />
          {/* The human countersign is the only signal: a period locked to the baseline module. */}
          <path d={periodPath} fill={signal} />
        </svg>
      </section>

      <section className="construction" aria-label="Signature Glyph construction drawing">
        <ConstructionSystem />
      </section>

      <p className="plate-rationale">THE HUMAN PERIOD COMPLETES THE LETTER.</p>
    </main>
  );
}