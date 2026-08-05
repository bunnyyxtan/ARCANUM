const BG = "#16130f";
const GOLD = "#c8a558";
const PALE = "#e6d3a3";
const SHADOW = "#6e5a33";
const CREAM = "#f3ead8";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

const polar = (cx: number, cy: number, r: number, angle: number) => [
  cx + Math.cos(angle) * r,
  cy + Math.sin(angle) * r,
];

const radialTicks = Array.from({ length: 72 }, (_, i) => {
  const a = (i / 72) * Math.PI * 2 - Math.PI / 2;
  const major = i % 6 === 0;
  const [x1, y1] = polar(200, 200, major ? 174 : 178, a);
  const [x2, y2] = polar(200, 200, 184, a);
  return <path key={`tick-${i}`} d={`M${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}`} />;
});

// Lathe-turned rosette: one exact 24-repeat family, phase-locked in 15°
// increments. There are no drifting harmonics or independent scales; every
// lobe returns at the same angular interval, which keeps the engraving
// mechanical rather than hairy.
const rosettePath = (phase: number) => {
  const points = Array.from({ length: 721 }, (_, i) => {
    const t = (i / 360) * Math.PI * 2;
    const r = 104 + 7 * Math.sin(24 * t + phase);
    return polar(200, 200, r, t);
  });
  return points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join(" ");
};

function SealArt({ detail = false }: { detail?: boolean }) {
  const rosettes = Array.from({ length: 4 }, (_, i) => (
    <path key={`rose-${i}`} d={rosettePath((i * Math.PI) / 2)} fill="none" stroke={i % 2 ? SHADOW : GOLD} strokeWidth={i % 2 ? 0.8 : 1.05} opacity={0.9} />
  ));
  const arcFamily = Array.from({ length: 8 }, (_, i) => (
    <circle key={`arc-${i}`} cx="200" cy="200" r={76 + i * 4.2} fill="none" stroke={i % 2 ? SHADOW : GOLD} strokeWidth="0.65" opacity="0.78" />
  ));
  const needles = Array.from({ length: 24 }, (_, i) => (
    <path key={`needle-${i}`} d={`M200 32V${i % 2 ? 42 : 49}`} transform={`rotate(${i * 15} 200 200)`} stroke={i % 2 ? SHADOW : GOLD} strokeWidth={i % 2 ? 0.7 : 1.1} />
  ));
  const shield = "M200 150C184 150 171 153 162 159V192C162 219 179 239 200 251C221 239 238 219 238 192V159C229 153 216 150 200 150Z";
  return (
    <g>
      <defs>
        <clipPath id={detail ? "seal-detail-clip" : "seal-clip"}><circle cx="200" cy="200" r="116" /></clipPath>
      </defs>
      <circle cx="200" cy="200" r="190" fill="none" stroke={SHADOW} strokeWidth="1" />
      <circle cx="200" cy="200" r="186" fill="none" stroke={GOLD} strokeWidth="1.7" />
      <g fill="none" strokeLinecap="square">{radialTicks}</g>
      <circle cx="200" cy="200" r="176" fill="none" stroke={GOLD} strokeWidth="1.2" />
      <circle cx="200" cy="200" r="169" fill="none" stroke={SHADOW} strokeWidth="0.8" />
      <g clipPath={`url(#${detail ? "seal-detail-clip" : "seal-clip"})`}>{rosettes}{arcFamily}</g>
      <circle cx="200" cy="200" r="82" fill={BG} stroke={GOLD} strokeWidth="1.5" />
      <g opacity="0.7">{needles}</g>
      <path d={shield} fill="none" stroke={PALE} strokeWidth="1.8" />
      <path d="M200 159V243" stroke={SHADOW} strokeWidth="0.8" />
      <path d="M178 184C178 171.8 187.8 162 200 162C212.2 162 222 171.8 222 184" fill="none" stroke={PALE} strokeWidth="1" />
      <circle cx="200" cy="184" r="5.5" fill={PALE} />
      <path d="M197.5 189H202.5V207H197.5Z" fill={PALE} />
      <circle cx="200" cy="200" r="76" fill="none" stroke={SHADOW} strokeWidth="0.75" />
      <circle cx="200" cy="200" r="82" fill="none" stroke={GOLD} strokeWidth="1" />
    </g>
  );
}

export default function TheGuillocheSeal() {
  return (
    <main style={{ minHeight: "100dvh", width: "100%", boxSizing: "border-box", background: BG, color: GOLD, padding: "27px 30px 28px", display: "flex", flexDirection: "column", fontFamily: MONO }}>
      <header style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 18, color: SHADOW, fontSize: 10, lineHeight: 1.2, letterSpacing: "0.14em", textTransform: "uppercase" }}>
        <span>ARCANUM — STUDY 40/42</span><span>THE GUILLOCHÉ SEAL</span>
      </header>
      <section aria-label="Finished engraved seal" style={{ flex: "1 1 auto", minHeight: 390, display: "grid", placeItems: "center", padding: "12px 0 10px" }}>
        <svg viewBox="0 0 400 400" width="400" height="400" role="img" aria-label="A gold guilloche currency seal with a central shield" style={{ width: "min(400px, 78vw)", height: "auto", display: "block" }}><SealArt /></svg>
      </section>
      <section aria-label="Engraving detail" style={{ width: "100%", maxWidth: 640, margin: "0 auto", borderTop: `1px solid ${SHADOW}`, paddingTop: 14 }}>
        <svg viewBox="80 70 240 130" width="100%" height="178" role="img" aria-label="Enlarged crop of the seal's rosette linework" style={{ display: "block" }}><SealArt detail /></svg>
      </section>
      <p style={{ width: "100%", maxWidth: 640, margin: "10px auto 0", color: SHADOW, fontSize: 9, lineHeight: 1.35, letterSpacing: "0.12em", textTransform: "uppercase" }}>GUILLOCHÉ IS MONEY'S ANTI-FORGERY LANGUAGE. THE RULE IS THE SEAL.</p>
    </main>
  );
}