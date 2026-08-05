const PAPER = "#faf6f1";
const INK = "#292522";
const SIGNAL = "#ff3c00";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

/**
 * ARCHWAY — COIN / STUDY 46C
 *
 * The 46A gate is reversed out of a 240×240 container. The container uses a
 * 42px superellipse-like corner treatment (implemented as a restrained
 * rounded square for SVG portability); radius = 17.5% of side. The paper
 * passage preserves the 4:5 block ratio inside the coin and keeps 48-unit
 * piers against a 72-unit opening. The signal retains the center-curvature
 * datum (200,196), so the icon is a direct extraction, not a new symbol.
 *
 * Optical correction: the coin is 4% oversized against its viewbox so its
 * corner mass survives avatar cropping; the signal is 2px above the passage
 * center to counter the negative space's visual drop.
 */
const NEGATIVE_ARCH =
  "M116 86 Q116 84 118 84 H282 Q284 84 284 86 V296 Q284 298 282 298 H238 V220 C238 190 222 174 200 174 C178 174 162 190 162 220 V298 H118 Q116 298 116 296 Z";

function Mark({ construction = false, opacity = 1 }: { construction?: boolean; opacity?: number }) {
  return (
    <g opacity={opacity}>
      {construction ? (
        <>
          <g fill="none" stroke={HAIRLINE} strokeWidth="1"><path d="M80 56V344M104 56V344M128 56V344M152 56V344M176 56V344M200 56V344M224 56V344M248 56V344M272 56V344M296 56V344M320 56V344" /><path d="M56 80H344M56 104H344M56 128H344M56 152H344M56 176H344M56 200H344M56 224H344M56 248H344M56 272H344M56 296H344M56 320H344" /></g>
          <g fill="none" stroke={GUIDE} strokeWidth="1" strokeDasharray="4 5"><rect x="80" y="80" width="240" height="240" rx="42" /><rect x="116" y="84" width="168" height="214" /><path d="M162 220C162 190 178 174 200 174C222 174 238 190 238 220" /><path d="M200 150V298" /></g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing=".7"><text x="205" y="72">240 COIN · R / 42</text><text x="205" y="168">4:5 NEGATIVE ARCH</text><text x="70" y="340">COIN OVERSIZE / 4% · SIGNAL / CENTER DATUM</text></g>
        </>
      ) : null}
      <rect x="80" y="80" width="240" height="240" rx="42" fill={INK} />
      <path d={NEGATIVE_ARCH} fill={PAPER} />
      <circle cx="200" cy="196" r="7" fill={SIGNAL} />
    </g>
  );
}

function Mini({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="56 56 288 288" role="img" aria-label={`${size}px coin`} style={{ width: size, height: size, display: "block" }}><Mark /></svg>;
}

export default function TheArchwayCoin() {
  return (
    <main style={{ minHeight: "100dvh", boxSizing: "border-box", background: PAPER, color: INK, padding: "27px 30px", display: "flex", flexDirection: "column", fontFamily: MONO }}>
      <header style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", color: META, fontSize: 10, lineHeight: 1.2, letterSpacing: ".14em", textTransform: "uppercase" }}><span>ARCANUM — STUDY 46C</span><span>ARCHWAY — COIN</span></header>
      <section style={{ flex: "1 1 auto", minHeight: 370, display: "grid", placeItems: "center", padding: "12px 0" }} aria-label="Finished coin"><svg viewBox="56 56 288 288" width="360" height="360" role="img" aria-label="Rounded ink coin with paper archway cutout" style={{ width: "min(360px, 78vw)", height: "auto", display: "block" }}><Mark /></svg></section>
      <section style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 10, width: "100%", maxWidth: 640, margin: "0 auto" }} aria-label="Coin construction"><svg viewBox="0 0 640 180" width="100%" height="170" role="img" aria-label="Coin and negative arch construction" style={{ display: "block" }}><g transform="translate(180,-48) scale(.7)"><Mark construction opacity={.42} /></g></svg></section>
      <section style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 38, paddingTop: 2 }} aria-label="Small size proof">{[64, 32, 16].map(size => <figure key={size} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><Mini size={size} /><figcaption style={{ color: GUIDE, fontSize: 8 }}>{size}</figcaption></figure>)}</section>
      <p style={{ width: "100%", maxWidth: 640, margin: "8px auto 0", color: GUIDE, fontSize: 9, lineHeight: 1.35, letterSpacing: ".12em", textTransform: "uppercase" }}>THE GATE, MADE ICONIC — A TREASURY YOU CAN CARRY.</p>
    </main>
  );
}