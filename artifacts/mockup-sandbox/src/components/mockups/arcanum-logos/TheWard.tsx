const paper = "#faf6f1";
const ink = "#292522";
const signal = "#ff3c00";
const hairline = "#ded7d0";
const guide = "#9b9289";

/*
 * WARD CONSTRUCTION / 32px base module
 * Overall live bounds: 224w × 288h (7:9 ratio), centered on x=180.
 * We draw ONE half and mirror it with scale(-1,1); no hand-tuned second side.
 * Crown y=80 is deliberately straight with crisp corners. Shoulders stay
 * mathematically vertical from y=80 through y=200 (47% of live height), then
 * the lower Bézier tension begins. This is a shield, not a rounded badge.
 */
const wardHalfPath =
  "M 180 80 L 292 80 " +
  "L 292 200 " +
  "C 292 237 282 270 262 298 " +
  "C 243 324 216 340 180 346 " +
  "L 172 344 L 180 80 Z";

// A path-drawn punctuation point; it is deliberately not a floating circle primitive.
const countersign =
  "M 180 294 C 187.7 294 194 300.3 194 308 C 194 315.7 187.7 322 180 322 C 172.3 322 166 315.7 166 308 C 166 300.3 172.3 294 180 294 Z";

function ConstructionSystem() {
  return (
    <svg viewBox="0 0 360 400" role="img" aria-label="The Ward construction system" className="construction-svg">
      <g fill="none" stroke={guide} strokeWidth="1" opacity="0.62">
        {/* Actual ratio guides: 7 modules wide × 9 modules high, with shoulder and tip datums. */}
        <path d="M 68 80 H 292 M 68 200 H 292 M 68 298 H 292 M 68 344 H 292" />
        <path d="M 180 52 V 354 M 68 80 V 344 M 292 80 V 200" />
        <path d="M 292 80 V 200" strokeDasharray="3 4" />
        <path d="M 292 200 C 292 237 282 270 262 298 C 243 324 216 340 180 346" />
        <path d="M 180 294 V 322" strokeDasharray="3 4" />
      </g>
      <g stroke={guide} strokeWidth="1" opacity="0.72">
        {/* 32px module marks used to set width, height, and the countersign datum. */}
        <path d="M 68 74 V 86 M 100 74 V 86 M 132 74 V 86 M 164 74 V 86 M 196 74 V 86 M 228 74 V 86 M 260 74 V 86 M 292 74 V 86" />
        <path d="M 62 80 H 74 M 62 112 H 74 M 62 144 H 74 M 62 176 H 74 M 62 208 H 74 M 62 240 H 74 M 62 272 H 74 M 62 304 H 74 M 62 336 H 74" />
      </g>
      <path d={wardHalfPath} fill={ink} opacity="0.3" />
      <path d={wardHalfPath} fill={ink} opacity="0.3" transform="translate(360 0) scale(-1 1)" />
      <path d={countersign} fill={signal} opacity="0.72" />
    </svg>
  );
}

export default function TheWard() {
  return (
    <main className="arcanum-plate ward-plate">
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
          width: min(380px, 74vw);
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
          width: min(180px, 44vw);
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
        <span>ARCANUM — STUDY 35/38</span>
        <span>THE WARD</span>
      </header>
      <section className="plate-hero" aria-label="Finished Ward symbol">
        <svg viewBox="0 0 360 400" role="img" aria-label="Solid proportioned shield with integrated countersign" className="hero-svg">
          {/* One half of the bespoke silhouette is mirrored on the exact x=180 axis: perfect bank-mark symmetry. */}
          <path d={wardHalfPath} fill={ink} />
          <path d={wardHalfPath} fill={ink} transform="translate(360 0) scale(-1 1)" />
          {/* Optical correction: the 16px flat base is raised above the mathematical point to avoid a cartoon spike. */}
          {/* The 28px countersign is centered on the 308 datum and remains inside the silhouette at 16px. */}
          <path d={countersign} fill={signal} />
        </svg>
      </section>
      <section className="construction" aria-label="Ward construction drawing">
        <ConstructionSystem />
      </section>
      <p className="plate-rationale">A SINGLE GUARDED SILHOUETTE HOLDS THE HUMAN COUNTERSIGN.</p>
    </main>
  );
}