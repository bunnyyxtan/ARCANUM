const paper = "#faf6f1";
const ink = "#292522";
const umber = "#655d56";
const fine = "#9b9289";
const signal = "#ff3c00";

const chainLink =
  "M -9 -2 C -7 -7 7 -7 9 -2 C 11 3 6 7 0 7 C -6 7 -11 3 -9 -2 Z";
const keyPath =
  "M 206 386 L 206 124 M 218 386 L 218 124 " +
  "M 206 126 L 222 126 L 222 116 L 230 116 L 230 105 L 220 105 L 220 94 " +
  "L 208 94 L 208 105 L 198 105 L 198 116 L 206 116 Z";
const bowPath =
  "M 214 94 C 192 94 180 78 180 58 C 180 37 196 22 214 22 C 232 22 248 37 248 58 " +
  "C 248 78 236 94 214 94 Z M 214 82 C 201 82 192 72 192 58 C 192 45 201 35 214 35 " +
  "C 227 35 236 45 236 58 C 236 72 227 82 214 82 Z";
const keyScroll =
  "M 207 44 C 198 48 198 60 207 64 C 215 68 221 60 217 54 C 214 49 208 50 206 54";
const keyTeeth =
  "M 206 342 L 194 342 L 194 354 L 206 354 L 206 366 L 194 366 L 194 386 " +
  "M 218 342 L 230 342 L 230 354 L 218 354 L 218 366 L 230 366 L 230 386";
const covenantShield =
  "M 198 226 L 222 226 L 224 230 L 224 246 C 224 256 218 264 210 270 C 202 264 196 256 196 246 L 196 230 Z";
const keyHatch = Array.from({ length: 6 }, (_, index) => index * 2.6);
const chainAngles = Array.from({ length: 48 }, (_, index) => index * 7.5);

function Key({ mirror = false }: { mirror?: boolean }) {
  return (
    <g transform={mirror ? "rotate(135 210 250)" : "rotate(-45 210 250)"}>
      <path d={keyPath} fill="none" stroke={ink} strokeWidth="2.1" strokeLinejoin="miter" />
      <path d={bowPath} fill="none" stroke={ink} strokeWidth="1.9" />
      <path d={keyScroll} fill="none" stroke={umber} strokeWidth="1.2" />
      {keyHatch.map((offset) => <path key={offset} d={`M ${192 + offset} 40 L ${204 + offset} 80`} stroke={fine} strokeWidth="0.95" fill="none" />)}
      {/* Wards continue beyond the center crossing: each key is full-length, not a V arm. */}
      <path d={keyTeeth} fill="none" stroke={ink} strokeWidth="1.5" />
      <path d="M 210 126 L 218 126 M 210 134 L 218 134 M 210 142 L 218 142" stroke={umber} strokeWidth="1" />
    </g>
  );
}

export default function TheVaultKeys() {
  return (
    <main className="luxury-plate vault-keys-plate">
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
        .keys-svg { width: min(420px, 78vw); height: auto; display: block; }
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
        <span>ARCANUM — STUDY 41/42</span>
        <span>THE VAULT KEYS</span>
      </header>
      <section className="luxury-hero" aria-label="Engraved Vault Keys emblem">
        <svg viewBox="0 0 420 500" role="img" aria-label="Two crossed engraved keys inside a chain border" className="keys-svg">
          {/* Double-rule seal plus a mapped touching rope: unlike floating dots, each link belongs to the border. */}
          <circle cx="210" cy="250" r="199" fill="none" stroke={umber} strokeWidth="1.1" />
          <circle cx="210" cy="250" r="190" fill="none" stroke={ink} strokeWidth="1.25" />
          <g transform="translate(210 250)">
            {chainAngles.map((angle) => (
              <use key={angle} href="#vault-link" transform={`rotate(${angle}) translate(0 -195)`} />
            ))}
          </g>
          <Key />
          <g transform="rotate(90 210 250)"><Key /></g>
          <g>
            <path d={covenantShield} fill={paper} stroke={ink} strokeWidth="1.8" />
            <path d="M 204 239 L 216 239 L 216 246 C 216 250 214 253 210 256 C 206 253 204 250 204 246 Z" fill={signal} stroke={signal} strokeWidth="0.8" />
          </g>
          <circle cx="210" cy="250" r="30" fill="none" stroke={umber} strokeWidth="1" />
        </svg>
        <svg width="0" height="0" aria-hidden="true">
          <defs><path id="vault-link" d={chainLink} fill="none" stroke={umber} strokeWidth="1.35" /></defs>
        </svg>
      </section>
      <section className="detail-band" aria-label="Two-times engraving detail">
        <svg viewBox="170 205 110 110" role="img" aria-label="Enlarged key crossing and covenant detail" className="detail-svg" preserveAspectRatio="xMidYMid meet">
          <path d={keyPath} fill="none" stroke={ink} strokeWidth="2.1" transform="rotate(-45 210 250)" />
          <path d={keyPath} fill="none" stroke={ink} strokeWidth="2.1" transform="rotate(45 210 250)" />
          <path d={covenantShield} fill={paper} stroke={ink} strokeWidth="1.8" />
          <path d="M 204 239 L 216 239 L 216 246 C 216 250 214 253 210 256 C 206 253 204 250 204 246 Z" fill={signal} stroke={signal} strokeWidth="0.8" />
          {Array.from({ length: 7 }, (_, index) => <path key={index} d={`M ${181 + index * 7} 214 L ${205 + index * 5} 286`} stroke={fine} strokeWidth="1" fill="none" opacity="0.8" />)}
        </svg>
      </section>
      <p className="luxury-rationale">TWO KEYS GUARD ONE COVENANT: AUTONOMOUS CUSTODY WAITS FOR THE COUNTERSIGN.</p>
    </main>
  );
}