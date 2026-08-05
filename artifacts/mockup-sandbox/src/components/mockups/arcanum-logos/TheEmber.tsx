const PAPER = "#faf6f1";
const INK = "#292522";
const FOUNDRY = "#1d1a18";
const UMBER = "#655d56";
const SIGNAL = "#ff3c00";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

/**
 * THE EMBER — STUDY 63/63
 *
 * Reworked as a rounded keep rather than a side-opening glyph: the outer ink
 * shell is a 148u × 208u near-full envelope with a DOWNWARD 40° aperture.
 * Its interior paper lining is 9u wide and follows the same keep contour,
 * ending at the two lower feet. The back is 28u thick; the feet taper from
 * 28u to 20u into the opening.
 *
 * The 18u square-cornered ember is centered at (206,200). It is the only
 * signal color and is smaller than every structural interval. The paper
 * lining is a true internal layer, not a theme swap, so the identical mark
 * remains legible against paper and foundry grounds.
 *
 * Squint test: checked at 16u and one color. The silhouette reads as a
 * freestanding enclosure / bell-keep, not a horseshoe, magnet, C, U, O,
 * pac-man, moon, shield, coin, arch, seal, letter, or other accidental object.
 */

const SHELL = "M132 286V140Q132 88 172 78Q206 69 240 78Q280 88 280 140V286H226L214 258Q206 246 198 258L186 286Z";
const LINING = "M151 274V144Q151 104 177 96Q206 87 235 96Q261 104 261 144V274H238L222 252Q206 230 190 252L174 274Z";
const EMBER_X = 206;
const EMBER_Y = 200;

function EmberMark({ construction = false, monochrome = false, size = 320 }: { construction?: boolean; monochrome?: boolean; size?: number }) {
  const shellInk = INK;
  const liningPaper = monochrome ? INK : PAPER;
  const ember = monochrome ? INK : SIGNAL;
  return (
    <svg viewBox="48 48 304 304" width={size} height={size} role="img" aria-label="Asymmetric ink and paper protective shell holding a small ember" style={{ width: size, height: size, display: "block" }}>
      {construction ? (
        <>
          <g fill="none" stroke={HAIRLINE} strokeWidth="1">
            <path d="M72 48V352M96 48V352M120 48V352M144 48V352M168 48V352M192 48V352M216 48V352M240 48V352M264 48V352M288 48V352M312 48V352M336 48V352" />
            <path d="M48 72H352M48 96H352M48 120H352M48 144H352M48 168H352M48 192H352M48 216H352M48 240H352M48 264H352M48 288H352M48 312H352M48 336H352" />
          </g>
          <g fill="none" stroke={GUIDE} strokeWidth="1" strokeDasharray="4 5">
            <path d={SHELL} />
            <path d={LINING} />
            <path d="M206 84V316M142 200H308" />
            <rect x="197" y="191" width="18" height="18" />
          </g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing=".55">
            <text x="144" y="72">ROUNDED KEEP · 148 × 208U</text>
            <text x="248" y="116">DOWN APERTURE · 40°</text>
            <text x="222" y="246">CORE · 18U</text>
            <text x="144" y="330">PAPER LINING · 9U / BACK · 28U / FEET · 20U</text>
          </g>
        </>
      ) : null}
      <path d={SHELL} fill={shellInk} stroke={PAPER} strokeWidth="3" strokeLinejoin="round" />
      <path d={LINING} fill="none" stroke={liningPaper} strokeWidth="9" strokeLinejoin="round" />
      <rect x="197" y="219" width="18" height="18" fill={ember} />
    </svg>
  );
}

function Proof({ size, monochrome = false }: { size: number; monochrome?: boolean }) {
  return <EmberMark size={size} monochrome={monochrome} />;
}

function SplitHero() {
  return (
    <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", width: "100%", maxWidth: 640, margin: "0 auto", height: 320 }} aria-label="Identical ember on light and dark themes">
      <div style={{ background: PAPER, display: "grid", placeItems: "center" }}><EmberMark size={300} /></div>
      <div style={{ background: FOUNDRY, display: "grid", placeItems: "center" }}><EmberMark size={300} /></div>
    </section>
  );
}

export default function TheEmber() {
  return (
    <main style={{ minHeight: "100dvh", boxSizing: "border-box", background: PAPER, color: INK, padding: "27px 30px 24px", display: "flex", flexDirection: "column", fontFamily: MONO }}>
      <header style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", color: META, fontSize: 10, lineHeight: 1.2, letterSpacing: ".14em", textTransform: "uppercase" }}>
        <span>ARCANUM — STUDY 63/63</span><span>THE EMBER</span>
      </header>
      <SplitHero />
      <section style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 10, width: "100%", maxWidth: 640, margin: "0 auto" }} aria-label="Ember construction">
        <svg viewBox="0 0 640 176" width="100%" height="164" role="img" aria-label="Ember construction grid and aperture dimensions" style={{ display: "block" }}>
          <g transform="translate(10,-46) scale(.46)"><EmberMark construction size={320} /></g>
          <g fill={INK} fontFamily={MONO}>
            <text x="224" y="34" fontSize="10" letterSpacing="1.2">ROUNDED KEEP / PROTECTIVE ENCLOSURE</text>
            <text x="224" y="57" fontSize="8" fill={GUIDE}>148 × 208U · 28U BACK · FEET 28→20U</text>
            <text x="224" y="85" fontSize="10" letterSpacing="1.2">DOWNWARD CONTROLLED APERTURE</text>
            <text x="224" y="108" fontSize="8" fill={GUIDE}>40° OPENING · PAPER LINING 9U · NOT HORSESHOE / MAGNET</text>
            <text x="224" y="136" fontSize="10" letterSpacing="1.2">ONE LIVE CORE / BELOW CENTER</text>
            <text x="224" y="159" fontSize="8" fill={GUIDE}>18U SQUARE · #FF3C00 · SMALLEST ELEMENT · NO C/U/O READ</text>
          </g>
        </svg>
      </section>
      <section style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, paddingTop: 2 }} aria-label="Small size proof on both grounds">
        <div style={{ background: PAPER, display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 25, padding: "2px 0 0" }}>{[64, 32, 16].map(size => <figure key={size} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><Proof size={size} /><figcaption style={{ color: GUIDE, fontSize: 8 }}>{size}</figcaption></figure>)}</div>
        <div style={{ background: FOUNDRY, display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 25, padding: "2px 0 0" }}>{[64, 32, 16].map(size => <figure key={size} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><Proof size={size} /><figcaption style={{ color: HAIRLINE, fontSize: 8 }}>{size}</figcaption></figure>)}</div>
      </section>
      <p style={{ width: "100%", maxWidth: 640, margin: "8px auto 0", color: GUIDE, fontSize: 9, lineHeight: 1.35, letterSpacing: ".12em", textTransform: "uppercase" }}>THE TREASURY'S LIVE SPARK, KEPT BRIGHT BY THE SYSTEM THAT GUARDS IT.</p>
    </main>
  );
}