const paper = "#faf6f1";
const ink = "#292522";
const signal = "#ff3c00";
const hairline = "#ded7d0";
const guide = "#9b9289";

/*
 * Construction system: 32px module, core radius 42px, ribbon center radius 112px,
 * ribbon width 24px. The sweep is 286° around the core; the 74° gap is occupied
 * by the human checkpoint. Sheared terminals are parallel to the local tangent.
 */
const treasuryCore =
  "M 200 158 C 223.2 158 242 176.8 242 200 C 242 223.2 223.2 242 200 242 C 176.8 242 158 223.2 158 200 C 158 176.8 176.8 158 200 158 Z";
const orbitRibbon =
  "M 164.7 119.2 C 135.2 133.6 112.3 160.3 106.4 192.6 C 98.5 235.8 121.5 280.3 160.6 301.2 C 199.8 322.2 247.8 315.5 279.9 286.5 C 312.1 257.5 324.1 212.1 310.8 171.4 C 300.9 141.1 280.6 117.7 253.8 104.7 L 242.9 128.1 C 264.1 138.4 280.1 157.1 287.9 180.3 C 298.3 211.9 288.9 247.2 263.7 269.9 C 238.4 292.7 200.6 297.9 169.9 281.4 C 139.2 265 121.2 230.1 127.4 196.4 C 132 171.1 150 150.1 174.9 138 Z";
const checkpoint =
  "M 245 91 L 269 115 L 245 139 L 221 115 Z";

function ConstructionSystem() {
  return (
    <svg viewBox="0 0 400 400" role="img" aria-label="The Orbit construction system" className="construction-svg">
      <g fill="none" stroke={guide} strokeWidth="1" opacity="0.62">
        {/* Actual core and orbit radii: 42px treasury, 112px ribbon centerline, 124px outer edge. */}
        <circle cx="200" cy="200" r="42" />
        <circle cx="200" cy="200" r="112" />
        <circle cx="200" cy="200" r="124" />
        {/* The open arc's real tangent/checkpoint geometry, not decorative guidework. */}
        <path d="M 200 58 V 342 M 58 200 H 342" />
        <path d="M 164.7 119.2 L 174.9 138 M 253.8 104.7 L 242.9 128.1" />
        <path d="M 221 115 H 269 M 245 91 V 139" opacity="0.48" />
      </g>
      <g stroke={guide} strokeWidth="1" opacity="0.72">
        {/* 32px radial module marks establish the core-to-orbit proportion. */}
        <path d="M 76 194 V 206 M 108 194 V 206 M 140 194 V 206 M 172 194 V 206 M 204 194 V 206 M 236 194 V 206 M 268 194 V 206 M 300 194 V 206 M 332 194 V 206" />
        <path d="M 194 76 H 206 M 194 108 H 206 M 194 140 H 206 M 194 172 H 206 M 194 204 H 206 M 194 236 H 206 M 194 268 H 206 M 194 300 H 206 M 194 332 H 206" />
      </g>
      <path d={orbitRibbon} fill={ink} opacity="0.3" />
      <path d={treasuryCore} fill={ink} opacity="0.3" />
      <path d={checkpoint} fill={signal} opacity="0.72" />
    </svg>
  );
}

export default function TheOrbit() {
  return (
    <main className="arcanum-plate orbit-plate">
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
          width: min(186px, 44vw);
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
        <span>ARCANUM — STUDY 34/34</span>
        <span>THE ORBIT</span>
      </header>
      <section className="plate-hero" aria-label="Finished Orbit symbol">
        <svg viewBox="0 0 400 400" role="img" aria-label="Treasury core with orbit ribbon and human checkpoint" className="hero-svg">
          {/* One solid treasury core. Its slight Bézier rounding is optical, not a circle primitive. */}
          <path d={treasuryCore} fill={ink} />
          {/* Optical correction: the ribbon swells by 1px through the lower turn, countering visual thinning against paper. */}
          {/* A single filled ribbon keeps both terminals flat and sheared; no outline stroke is used. */}
          <path d={orbitRibbon} fill={ink} />
          {/* Joint thinning: the ribbon stops before this integrated signal diamond; the diamond pins, rather than decorates, the loop. */}
          <path d={checkpoint} fill={signal} />
        </svg>
      </section>
      <section className="construction" aria-label="Orbit construction drawing">
        <ConstructionSystem />
      </section>
      <p className="plate-rationale">THE AGENT CIRCLES THE TREASURY; THE HUMAN CHECKPOINT HOLDS THE LOOP.</p>
    </main>
  );
}