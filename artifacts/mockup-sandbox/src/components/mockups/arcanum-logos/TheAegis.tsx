const paper = "#faf6f1";
const ink = "#292522";
const umber = "#655d56";
const signal = "#ff3c00";
const hairline = "#ded7d0";
const guide = "#9b9289";

/*
 * AEGIS / precision system
 * Live shield bounds: 216 × 288 = 3:4, centered on x=200.
 * Crown y=70, shoulder datum y=198 (44.4% of the 288px height),
 * lower tension datum y=258, optical base y=356.
 * The seam is the central 0.500 width ratio rather than a golden split:
 * heraldic bilateral balance is the stronger trust signal here. Its 6px
 * paper clearance is 3× the 2px structure stroke, preserving separation at 16px.
 * Horizontal crown strokes are drawn 5% lighter than vertical structure so
 * they read as equal weight after optical contrast compensation.
 */
const aegisOutline =
  "M 92 70 Q 91.5 70 91.5 72 L 91.5 198 " +
  "C 91.5 241 103 280 127 311 C 145 334 169 349 200 356 " +
  "C 231 349 255 334 273 311 C 297 280 308.5 241 308.5 198 L 308.5 72 " +
  "Q 308.5 70 308 70 C 252 68 148 68 92 70 Z";

const leftFacet =
  "M 92 70 C 128 68.7 166 68.7 197 69.8 L 197 353.8 " +
  "C 169 347 145 333 127 311 C 103 280 92 241 92 198 L 92 72 Q 92 70 92 70 Z";

const rightFacet =
  "M 203 69.8 C 238 68.7 277 68.7 308 70 Q 308 70 308 72 L 308 198 " +
  "C 308 241 297 280 273 311 C 255 333 231 347 203 353.8 Z";

const seamCenter = "M 200 70 L 200 356";
const countersign =
  "M 200 244 C 207.2 244 213 249.8 213 257 C 213 264.2 207.2 270 200 270 C 192.8 270 187 264.2 187 257 C 187 249.8 192.8 244 200 244 Z";
const modules = Array.from({ length: 9 }, (_, index) => 72 + index * 32);

function ConstructionBand() {
  return (
    <svg viewBox="0 0 400 240" role="img" aria-label="Aegis construction system" className="construction-svg">
      <g fill="none" stroke={guide} strokeWidth="1" opacity="0.76">
        <path d="M 92 32 V 222 M 308 32 V 222 M 200 24 V 230" />
        <path d="M 84 56 H 316 M 84 142 H 316 M 84 198 H 316 M 84 222 H 316" />
        <path d={aegisOutline} />
        <path d={seamCenter} strokeDasharray="4 4" />
        <path d="M 190 70 H 210 M 190 356 H 210" />
      </g>
      <g fill={guide} fontFamily='"IBM Plex Mono", monospace' fontSize="8" letterSpacing=".08em">
        <text x="316" y="58">3:4 LIVE BOUNDS</text>
        <text x="316" y="145">44.4% SHOULDER</text>
        <text x="316" y="201">3× CLEARANCE</text>
        <text x="208" y="232">0.500 AXIS SEAM</text>
      </g>
      <g stroke={guide} strokeWidth="1" opacity="0.64">
        {modules.map((x) => <path key={`module-x-${x}`} d={`M ${x} 18 V 28`} />)}
        {modules.map((y) => <path key={`module-y-${y}`} d={`M 78 ${y} H 88`} />)}
      </g>
      <path d={leftFacet} fill={ink} opacity="0.18" />
      <path d={rightFacet} fill={umber} opacity="0.25" />
      <path d={seamCenter} stroke={paper} strokeWidth="6" opacity="0.95" />
      <path d={countersign} fill={signal} opacity="0.74" />
    </svg>
  );
}

function ScaleRow() {
  return (
    <div className="scale-row" aria-label="Aegis scale survival row">
      {[64, 32, 16].map((size) => (
        <div className="scale-cell" key={size}>
          <svg viewBox="0 0 400 400" aria-hidden="true" style={{ width: size, height: size }}>
            <path d={leftFacet} fill={ink} />
            <path d={rightFacet} fill={umber} />
            <path d={seamCenter} stroke={paper} strokeWidth="6" />
            <path d={countersign} fill={signal} />
          </svg>
          <span>{size}px</span>
        </div>
      ))}
    </div>
  );
}

export default function TheAegis() {
  return (
    <main className="precision-plate aegis-plate">
      <style>{`
        .precision-plate {
          min-height: 100vh;
          width: 100%;
          box-sizing: border-box;
          padding: 30px 34px 26px;
          background: ${paper};
          color: ${ink};
          display: flex;
          flex-direction: column;
          font-family: "IBM Plex Mono", "Courier New", monospace;
        }
        .precision-meta {
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
        .precision-meta span:last-child { text-align: right; }
        .aegis-hero {
          flex: 1 1 auto;
          min-height: 414px;
          display: grid;
          place-items: center;
        }
        .hero-svg { width: min(380px, 76vw); height: auto; display: block; }
        .construction {
          border-top: 1px solid ${hairline};
          min-height: 174px;
          display: grid;
          place-items: center;
        }
        .construction-svg { width: min(480px, 92vw); height: 168px; display: block; }
        .scale-row {
          display: flex;
          align-items: end;
          justify-content: center;
          gap: 24px;
          padding-top: 8px;
          color: #9b9289;
          font-size: 8px;
          letter-spacing: .08em;
          text-transform: uppercase;
        }
        .scale-cell { display: flex; flex-direction: column; align-items: center; gap: 5px; }
        .scale-cell svg { display: block; }
        .precision-rationale {
          margin: 15px 0 0;
          color: #9b9289;
          font-size: 9px;
          line-height: 1.4;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        @media (max-width: 520px) {
          .precision-plate { padding: 25px 22px 20px; }
          .aegis-hero { min-height: 368px; }
          .construction { min-height: 158px; }
          .construction-svg { height: 150px; }
          .scale-row { gap: 18px; }
        }
      `}</style>
      <header className="precision-meta">
        <span>ARCANUM — STUDY 43/45</span>
        <span>THE AEGIS</span>
      </header>
      <section className="aegis-hero" aria-label="Finished Aegis shield symbol">
        <svg viewBox="0 0 400 400" role="img" aria-label="Split shield with paper seam and human countersign" className="hero-svg">
          {/* Two solid facets only: no internal icon, no decorative device. */}
          <path d={leftFacet} fill={ink} />
          <path d={rightFacet} fill={umber} />
          {/* The seam is a 6px paper cut: three structure-stroke units, parallel and uninterrupted. */}
          <path d={seamCenter} stroke={paper} strokeWidth="6" />
          {/* One signal element, centered on the seam at y=257: the two authorities countersign here. */}
          <path d={countersign} fill={signal} />
        </svg>
      </section>
      <section className="construction" aria-label="Aegis construction and ratio callouts">
        <ConstructionBand />
      </section>
      <ScaleRow />
      <p className="precision-rationale">TWO GOVERNED FACETS, ONE PAPER SEAM, ONE HUMAN COUNTERSIGN.</p>
    </main>
  );
}