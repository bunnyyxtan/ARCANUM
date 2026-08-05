const paper = "#faf6f1";
const ink = "#292522";
const umber = "#655d56";
const fine = "#9b9289";
const signal = "#ff3c00";

const leafPath =
  "M 0 0 C 8 -15 24 -22 39 -19 C 28 -5 14 3 0 0 Z";
const leafVein = "M 1 -1 C 13 -7 25 -13 38 -18";
const crestShield =
  "M 158 140 L 262 140 L 270 149 L 270 234 C 270 279 248 316 210 344 C 172 316 150 279 150 234 L 150 149 Z";
const innerShield =
  "M 163 150 L 257 150 L 260 157 L 260 233 C 260 269 242 300 210 326 C 178 300 160 269 160 233 L 160 157 Z";

const leftLeaves = [
  { x: 128, y: 365, r: 18, s: 0.78 },
  { x: 108, y: 351, r: 24, s: 0.82 },
  { x: 91, y: 333, r: 30, s: 0.86 },
  { x: 77, y: 312, r: 37, s: 0.9 },
  { x: 66, y: 288, r: 44, s: 0.92 },
  { x: 59, y: 262, r: 51, s: 0.95 },
  { x: 56, y: 235, r: 58, s: 0.96 },
  { x: 58, y: 208, r: 66, s: 0.94 },
  { x: 65, y: 182, r: 74, s: 0.9 },
  { x: 76, y: 158, r: 82, s: 0.86 },
  { x: 91, y: 139, r: 90, s: 0.8 },
  { x: 108, y: 119, r: 98, s: 0.72 },
];
// Regular hatch family: every baseline is horizontal and spaced 12px;
// opacity fades upward in 0.035 steps, leaving the lower field richest.
const hatchRows = Array.from({ length: 12 }, (_, index) => 174 + index * 12);
const sunRays = Array.from({ length: 16 }, (_, index) => index * 22.5);

function LaurelSide({ mirror = false }: { mirror?: boolean }) {
  return (
    <g transform={mirror ? "translate(420 0) scale(-1 1)" : undefined}>
      <path d="M 128 375 C 79 339 47 283 53 222 C 57 178 79 142 108 119" fill="none" stroke={ink} strokeWidth="2.1" />
      <path d="M 124 374 C 80 337 52 281 58 224 C 62 181 83 147 108 119" fill="none" stroke={umber} strokeWidth="1.05" />
      {leftLeaves.map((leaf, index) => (
        <g key={`leaf-${index}`} transform={`translate(${leaf.x} ${leaf.y}) rotate(${leaf.r}) scale(${leaf.s})`}>
          <path d={leafPath} fill="none" stroke={ink} strokeWidth="1.8" />
          <path d={leafVein} fill="none" stroke={umber} strokeWidth="1.15" />
        </g>
      ))}
    </g>
  );
}

function EngravedShield({ detail = false }) {
  return (
    <g>
      <path d={crestShield} fill="none" stroke={ink} strokeWidth="2.35" />
      <path d={innerShield} fill="none" stroke={umber} strokeWidth="1.35" />
      <g clipPath="url(#crest-shield-clip)">
        {/* Engraving field: the ONLY interior detail is a level horizontal family.
            Rows are exactly 12px apart; opacity rises toward the lower rows so
            the upper field breathes without introducing a second geometry. */}
        {hatchRows.map((y, index) => (
          <path
            key={`hatch-${index}`}
            d={`M 153 ${y} H 267`}
            fill="none"
            stroke={index < 3 ? fine : umber}
            strokeWidth={index < 3 ? 1.05 : 1.25}
            opacity={index < 3 ? 0.36 : 0.78 - index * 0.035}
          />
        ))}
      </g>
      {detail && <path d="M 178 212 C 188 201 201 201 210 212 C 219 201 232 201 242 212" fill="none" stroke={umber} strokeWidth="1.25" />}
    </g>
  );
}

export default function TheLaurelCrest() {
  return (
    <main className="luxury-plate laurel-plate">
      <style>{`
        .luxury-plate {
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
        .luxury-meta {
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
        .luxury-meta span:last-child { text-align: right; }
        .luxury-hero {
          flex: 1 1 auto;
          min-height: 455px;
          display: grid;
          place-items: center;
        }
        .crest-svg { width: min(420px, 78vw); height: auto; display: block; }
        .detail-band {
          border-top: 1px solid #ded7d0;
          min-height: 194px;
          display: grid;
          place-items: center;
          overflow: hidden;
        }
        .detail-svg { width: min(420px, 84vw); height: 176px; display: block; }
        .luxury-rationale {
          margin: 18px 0 0;
          color: #837a72;
          font-size: 9px;
          line-height: 1.4;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        @media (max-width: 520px) {
          .luxury-plate { padding: 25px 22px 22px; }
          .luxury-hero { min-height: 404px; }
          .detail-band { min-height: 174px; }
          .detail-svg { height: 158px; }
          .luxury-rationale { margin-top: 15px; }
        }
      `}</style>
      <header className="luxury-meta">
        <span>ARCANUM — STUDY 39/42</span>
        <span>THE LAUREL CREST</span>
      </header>
      <section className="luxury-hero" aria-label="Engraved Laurel Crest emblem">
        <svg viewBox="0 0 420 500" role="img" aria-label="Symmetric engraved shield with laurel branches and radiant watch point" className="crest-svg">
          <defs>
            <clipPath id="crest-shield-clip"><path d={innerShield} /></clipPath>
          </defs>
          <LaurelSide />
          <LaurelSide mirror />
          <g transform="translate(210 92)">
            <circle r="5" fill={signal} stroke={signal} strokeWidth="1.3" />
            {sunRays.map((angle) => (
              <path key={`ray-${angle}`} d="M 0 -10 L 0 -18" stroke={umber} strokeWidth="1.1" transform={`rotate(${angle})`} />
            ))}
          </g>
          <EngravedShield />
          <g transform="translate(210 363)">
            <path d="M -20 0 C -11 -9 -4 -9 0 0 C 4 -9 11 -9 20 0 C 11 9 4 9 0 0 C -4 9 -11 9 -20 0 Z" fill="none" stroke={ink} strokeWidth="1.55" />
            <path d="M -9 -6 L -9 6 M 9 -6 L 9 6" stroke={umber} strokeWidth="1" />
          </g>
        </svg>
      </section>
      <section className="detail-band" aria-label="Two-times engraving detail">
        <svg viewBox="145 145 130 126" role="img" aria-label="Enlarged shield engraving detail" className="detail-svg" preserveAspectRatio="xMidYMid meet">
          <defs><clipPath id="crest-detail-clip"><path d="M 150 149 L 270 149 L 270 234 C 270 279 248 316 210 344 C 172 316 150 279 150 234 Z" /></clipPath></defs>
          <path d={crestShield} fill="none" stroke={ink} strokeWidth="2.35" />
          <path d={innerShield} fill="none" stroke={umber} strokeWidth="1.35" />
          <g clipPath="url(#crest-detail-clip)">
            {hatchRows.map((y, index) => <path key={`detail-hatch-${index}`} d={`M 146 ${y} H 274`} fill="none" stroke={index < 3 ? fine : umber} strokeWidth="1.2" opacity={index < 3 ? 0.55 : 0.82 - index * 0.035} />)}
          </g>
        </svg>
      </section>
      <p className="luxury-rationale">THE GUARDED SECRET STANDS UNDER A HUMAN WATCH, HELD BY THE LAUREL OF CUSTODY.</p>
    </main>
  );
}