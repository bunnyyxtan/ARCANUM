const paper = "#faf6f1";
const ink = "#292522";
const umber = "#655d56";
const signal = "#ff3c00";
const hairline = "#ded7d0";
const guide = "#9b9289";

/*
 * ROTOR GRID / 32px module. Live diameter 224px, hub radius 28px,
 * ring radii 84/68px. Four spokes at 0°, 90°, 180°, 270° deliberately
 * avoid the 5/6-spoke ship-wheel cadence and the 8-ray asterisk cadence.
 * Spoke bars are 14px wide; the 4px ring-to-hub clearance is exactly
 * 1/2 spoke width, enough to keep the mechanism legible at 16px.
 */
const ring = "M 200 88 A 112 112 0 1 1 200 312 A 112 112 0 1 1 200 88 Z M 200 104 A 96 96 0 1 0 200 296 A 96 96 0 1 0 200 104 Z";
const spoke = "M 193 112 L 207 112 L 207 178 L 193 178 Z";
const hub = "M 200 172 A 28 28 0 1 1 200 228 A 28 28 0 1 1 200 172 Z";
const signalPoint = "M 200 190 A 10 10 0 1 1 200 210 A 10 10 0 1 1 200 190 Z";

function Construction() {
  return <svg viewBox="0 0 400 240" className="construction-svg" role="img" aria-label="Rotor construction">
    <g fill="none" stroke={guide} strokeWidth="1" opacity=".75">
      <circle cx="200" cy="120" r="112" /><circle cx="200" cy="120" r="84" /><circle cx="200" cy="120" r="28" />
      <path d="M 72 120 H 328 M 200 0 V 240" />
      <path d="M 200 8 V 232 M 192 120 H 208" strokeDasharray="4 4" />
    </g>
    <g fill={guide} fontFamily='"IBM Plex Mono",monospace' fontSize="8" letterSpacing=".08em">
      <text x="330" y="39">Ø224 / Ø168 / Ø56</text><text x="330" y="122">4 × 90°</text><text x="208" y="112">4PX CLEAR</text>
    </g>
    <path d={ring} fill={ink} fillRule="evenodd" opacity=".2" transform="translate(0 -80)" />
    {[0, 90, 180, 270].map((angle) => <path key={angle} d={spoke} fill={ink} opacity=".2" transform={`rotate(${angle} 200 120)`} />)}
    <path d={hub} fill={umber} opacity=".25" transform="translate(0 -80)" /><path d={signalPoint} fill={signal} opacity=".7" transform="translate(0 -80)" />
  </svg>;
}

const style = `
  .precision-plate{min-height:100vh;width:100%;box-sizing:border-box;padding:30px 34px 26px;background:${paper};color:${ink};display:flex;flex-direction:column;font-family:"IBM Plex Mono","Courier New",monospace}
  .precision-meta{display:flex;justify-content:space-between;gap:24px;color:#837a72;font-size:10px;line-height:1.2;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap}.precision-meta span:last-child{text-align:right}
  .precision-hero{flex:1 1 auto;min-height:414px;display:grid;place-items:center}.hero-svg{width:min(380px,76vw);height:auto;display:block}
  .construction{border-top:1px solid ${hairline};min-height:174px;display:grid;place-items:center}.construction-svg{width:min(480px,92vw);height:168px;display:block}
  .scale-row{display:flex;justify-content:center;align-items:end;gap:24px;padding-top:8px;color:#9b9289;font-size:8px;letter-spacing:.08em;text-transform:uppercase}.scale-cell{display:flex;flex-direction:column;align-items:center;gap:5px}.scale-cell svg{display:block}
  .rationale{margin:15px 0 0;color:#9b9289;font-size:9px;line-height:1.4;letter-spacing:.1em;text-transform:uppercase}@media(max-width:520px){.precision-plate{padding:25px 22px 20px}.precision-hero{min-height:368px}.construction{min-height:158px}.construction-svg{height:150px}.scale-row{gap:18px}}
`;

export default function TheRotor() {
  return <main className="precision-plate"><style>{style}</style><header className="precision-meta"><span>ARCANUM — STUDY 51/55</span><span>THE ROTOR</span></header>
    <section className="precision-hero"><svg viewBox="0 0 400 400" className="hero-svg" role="img" aria-label="Four spoke bank vault rotor">
      <path d={ring} fill={ink} fillRule="evenodd" />
      {[0,90,180,270].map((angle) => <path key={angle} d={spoke} fill={ink} transform={`rotate(${angle} 200 200)`} />)}
      <path d={hub} fill={umber} /><path d={signalPoint} fill={signal} />
    </svg></section>
    <section className="construction"><Construction /></section>
    <div className="scale-row">{[64,32,16].map((size) => <div className="scale-cell" key={size}><svg viewBox="0 0 400 400" style={{width:size,height:size}}><path d={ring} fill={ink} fillRule="evenodd"/>{[0,90,180,270].map(a=><path key={a} d={spoke} fill={ink} transform={`rotate(${a} 200 200)`}/>)}<path d={hub} fill={umber}/><path d={signalPoint} fill={signal}/></svg><span>{size}px</span></div>)}</div>
    <p className="rationale">FOUR RIGHT-ANGLE SPOKES MAKE CUSTODY A MECHANISM, NOT A WHEEL.</p>
  </main>;
}