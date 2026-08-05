const paper = "#faf6f1";
const ink = "#292522";
const umber = "#655d56";
const signal = "#ff3c00";
const hairline = "#ded7d0";
const guide = "#9b9289";

const ribbonPath =
  "M 92 314 L 179 74 L 201 74 L 288 314 L 252 314 L 225 231 L 155 231 L 128 314";

function ConstructionSystem() {
  return (
    <svg
      viewBox="0 0 400 400"
      role="img"
      aria-label="Continuous A with its circle, angle, and module construction system"
      className="construction-svg"
    >
      <g fill="none" stroke={guide} strokeWidth="1" opacity="0.58">
        {/* The 8 / 16 / 32 module circles are the actual radii used to correct the ribbon turns. */}
        <circle cx="190" cy="190" r="32" />
        <circle cx="190" cy="190" r="96" />
        <circle cx="190" cy="190" r="160" />
        {/* Actual apex and crossbar angle lines from the ribbon centerline. */}
        <path d="M 92 314 L 179 74 M 201 74 L 288 314 M 155 231 L 225 231" />
        <path d="M 92 314 H 288 M 128 314 H 252 M 155 231 H 225" opacity="0.48" />
        <path d="M 179 74 H 201 M 179 68 V 80 M 201 68 V 80" />
      </g>
      <g stroke={guide} strokeWidth="1" opacity="0.72">
        {/* 16px module ticks, aligned to the same baseline used by the final mark. */}
        <path d="M 92 306 V 322 M 108 310 V 318 M 124 310 V 318 M 140 310 V 318 M 156 310 V 318 M 172 310 V 318 M 188 310 V 318 M 204 310 V 318 M 220 310 V 318 M 236 310 V 318 M 252 310 V 318 M 268 310 V 318 M 284 306 V 322" />
      </g>
      <path d={ribbonPath} fill="none" stroke={ink} strokeWidth="26" strokeLinecap="butt" strokeLinejoin="miter" opacity="0.3" />
      {/* Optical correction: the apex is extended 6px past the nominal circle so it does not look blunt at small sizes. */}
      <path d="M 179 74 L 201 74 L 207 90 L 173 90 Z" fill={umber} opacity="0.7" />
      {/* Joint thinning: the inner crossbar turn is shaved to keep the fold from optically clogging. */}
      <path d="M 214 231 L 228 231 L 230 244 L 217 244 Z" fill={signal} opacity="0.78" />
    </svg>
  );
}

export default function ContinuousA() {
  return (
    <main className="arcanum-plate continuous-plate">
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
          width: min(390px, 72vw);
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
          width: min(190px, 45vw);
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
        <span>ARCANUM — STUDY 29/30</span>
        <span>CONTINUOUS A</span>
      </header>

      <section className="plate-hero" aria-label="Finished Continuous A mark">
        <svg viewBox="0 0 400 400" role="img" aria-label="Continuous A ribbon mark" className="hero-svg">
          {/* One unbroken centerline: a single flat ribbon enters, folds through the A, and closes at the inner left terminal. */}
          <path d={ribbonPath} fill="none" stroke={ink} strokeWidth="26" strokeLinecap="butt" strokeLinejoin="miter" />
          {/* Flat fold facets, not decoration: each facet is a physical turn in the same ribbon. */}
          <path d="M 179 74 L 201 74 L 207 90 L 173 90 Z" fill={umber} />
          <path d="M 214 231 L 228 231 L 230 244 L 217 244 Z" fill={signal} />
        </svg>
      </section>

      <section className="construction" aria-label="Continuous A construction drawing">
        <ConstructionSystem />
      </section>

      <p className="plate-rationale">ONE UNBROKEN LINE MAKES EVERY AUTONOMOUS SPEND AUDITABLE.</p>
    </main>
  );
}