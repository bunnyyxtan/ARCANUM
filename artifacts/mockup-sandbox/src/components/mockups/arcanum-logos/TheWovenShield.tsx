const BG = "#faf6f1";
const GOLD = "#292522";
const PALE = "#ff3c00";
const SHADOW = "#655d56";
const HAIRLINE = "#ded7d0";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

const outerShield = "M200 34C148 34 107 46 78 67V194C78 284 124 343 200 378C276 343 322 284 322 194V67C293 46 252 34 200 34Z";
const innerShield = "M200 47C155 47 121 57 94 75V193C94 270 130 322 200 356C270 322 306 270 306 193V75C279 57 245 47 200 47Z";

function WovenArt({ detail = false }: { detail?: boolean }) {
  // Two periodic crossing families make the interior a true policy weave,
  // not vertical grain. Each family repeats on the same M-derived spacing;
  // the shield clip trims the outer turns cleanly at the contour.
  const left = Array.from({ length: 13 }, (_, i) => {
    const x = 48 + i * 25;
    return <path key={`left-${i}`} d={`M${x} 42C${x + 38} 126 ${x + 58} 250 ${x + 82} 364`} fill="none" stroke={i % 3 === 0 ? GOLD : SHADOW} strokeWidth={i % 3 === 0 ? 1.45 : 1.0} />;
  });
  const right = Array.from({ length: 13 }, (_, i) => {
    const x = 48 + i * 25;
    return <path key={`right-${i}`} d={`M${x + 82} 42C${x + 44} 126 ${x + 24} 250 ${x} 364`} fill="none" stroke={i % 3 === 0 ? GOLD : SHADOW} strokeWidth={i % 3 === 0 ? 1.45 : 1.0} />;
  });
  const glory = Array.from({ length: 18 }, (_, i) => <path key={`glory-${i}`} d="M200 22V6" transform={`rotate(${(i - 9) * 4} 200 200)`} stroke={SHADOW} strokeWidth="1.05" />);
  return (
    <g>
      <defs><clipPath id={detail ? "woven-detail-clip" : "woven-clip"}><path d={innerShield} /></clipPath></defs>
      <g>{glory}</g>
      <path d={outerShield} fill="none" stroke={SHADOW} strokeWidth="2.25" />
      <path d={outerShield} fill="none" stroke={GOLD} strokeWidth="1.25" />
      <path d={innerShield} fill="none" stroke={GOLD} strokeWidth="1.8" />
      <g clipPath={`url(#${detail ? "woven-detail-clip" : "woven-clip"})`} opacity="0.92">{left}{right}</g>
      <circle cx="200" cy="92" r="9.5" fill="none" stroke={PALE} strokeWidth="2.5" />
      <path d="M194 99H206V130H194Z" fill={PALE} />
      <path d="M200 58V344" stroke={SHADOW} strokeWidth="0.9" opacity="0.7" />
    </g>
  );
}

export default function TheWovenShield() {
  return (
    <main style={{ minHeight: "100dvh", width: "100%", boxSizing: "border-box", background: BG, color: GOLD, padding: "27px 30px 28px", display: "flex", flexDirection: "column", fontFamily: MONO }}>
      <header style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", gap: 18, color: SHADOW, fontSize: 10, lineHeight: 1.2, letterSpacing: "0.14em", textTransform: "uppercase" }}>
        <span>ARCANUM — STUDY 42/42</span><span>THE WOVEN SHIELD</span>
      </header>
      <section aria-label="Finished woven shield" style={{ flex: "1 1 auto", minHeight: 390, display: "grid", placeItems: "center", padding: "12px 0 10px" }}>
        <svg viewBox="0 0 400 400" width="400" height="400" role="img" aria-label="A fine-line gold shield filled with woven guilloche and a pale gold vigilance mark" style={{ width: "min(400px, 78vw)", height: "auto", display: "block" }}><WovenArt /></svg>
      </section>
      <section aria-label="Engraving detail" style={{ width: "100%", maxWidth: 640, margin: "0 auto", borderTop: `1px solid ${HAIRLINE}`, paddingTop: 14 }}>
        <svg viewBox="82 96 236 150" width="100%" height="178" role="img" aria-label="Enlarged crop of the shield's woven linework" style={{ display: "block" }}><WovenArt detail /></svg>
      </section>
      <p style={{ width: "100%", maxWidth: 640, margin: "10px auto 0", color: "#837a72", fontSize: 9, lineHeight: 1.35, letterSpacing: "0.12em", textTransform: "uppercase" }}>A POLICY MESH MONEY CANNOT SLIP THROUGH. VIGILANCE LIVES IN THE CHIEF.</p>
    </main>
  );
}