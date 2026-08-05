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
 * THE KNOT — STUDY 62/63
 *
 * Fresh two-part construction: one 86 × 192u vertical rounded rectangle
 * crosses one 192 × 86u horizontal rounded rectangle. Both use R = 22u.
 * There is one lock, one over-under exchange, and no repeated chain loops.
 *
 * Theme duality is carried by the mark itself. The ink member has a 3u paper
 * keyline; the paper member has a 2u umber containment line. These are the
 * same paths on both grounds, never theme-swapped. At the lock, the over
 * member leaves a 12u clear separation at each side of the 10u datum.
 *
 * Squint test: at 16u and one color it reads as one vertical/horizontal
 * policy bind, not chain-link clip art, a bow, glasses, a shield, an arch,
 * a coin, or a letterform.
 */

const CENTER = 200;

function RoundedRect({ x, y, width, height, fill, stroke, strokeWidth }: { x: number; y: number; width: number; height: number; fill: string; stroke: string; strokeWidth: number }) {
  return <rect x={x} y={y} width={width} height={height} rx="22" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
}

function KnotMark({ construction = false, monochrome = false, size = 320 }: { construction?: boolean; monochrome?: boolean; size?: number }) {
  const paper = monochrome ? INK : PAPER;
  const paperLine = monochrome ? INK : UMBER;
  return (
    <svg viewBox="48 48 304 304" width={size} height={size} role="img" aria-label="Two interlocking rounded rectangles forming a knot" style={{ width: size, height: size, display: "block" }}>
      {construction ? (
        <>
          <g fill="none" stroke={HAIRLINE} strokeWidth="1">
            <path d="M72 48V352M96 48V352M120 48V352M144 48V352M168 48V352M192 48V352M216 48V352M240 48V352M264 48V352M288 48V352M312 48V352M336 48V352" />
            <path d="M48 72H352M48 96H352M48 120H352M48 144H352M48 168H352M48 192H352M48 216H352M48 240H352M48 264H352M48 288H352M48 312H352M48 336H352" />
          </g>
          <g fill="none" stroke={GUIDE} strokeWidth="1" strokeDasharray="4 5">
            <rect x="157" y="94" width="86" height="212" rx="22" />
            <rect x="94" y="157" width="212" height="86" rx="22" />
            <path d="M157 200H243M200 94V306" />
          </g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing=".55">
            <text x="164" y="84">86U WIDE · 192U TALL</text><text x="252" y="164">R22</text>
            <text x="244" y="253">12U CLEAR</text><text x="166" y="316">ONE LOCK / NO REPEAT</text>
          </g>
        </>
      ) : null}
      <RoundedRect x={157} y={94} width={86} height={212} fill={INK} stroke={paper} strokeWidth={3} />
      <RoundedRect x={94} y={157} width={212} height={86} fill={paper} stroke={paperLine} strokeWidth={2} />
      <path d="M157 188H169V212H157Z M231 188H243V212H231Z" fill={INK} />
      {!monochrome ? <circle cx={CENTER} cy={CENTER} r="5.5" fill={SIGNAL} /> : null}
    </svg>
  );
}

function Proof({ size, monochrome = false }: { size: number; monochrome?: boolean }) {
  return <KnotMark size={size} monochrome={monochrome} />;
}

function SplitHero() {
  return <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", width: "100%", maxWidth: 640, margin: "0 auto", height: 320 }} aria-label="Identical knot on light and dark themes"><div style={{ background: PAPER, display: "grid", placeItems: "center" }}><KnotMark size={300} /></div><div style={{ background: FOUNDRY, display: "grid", placeItems: "center" }}><KnotMark size={300} /></div></section>;
}

export default function TheKnot() {
  return (
    <main style={{ minHeight: "100dvh", boxSizing: "border-box", background: PAPER, color: INK, padding: "27px 30px 24px", display: "flex", flexDirection: "column", fontFamily: MONO }}>
      <header style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", color: META, fontSize: 10, lineHeight: 1.2, letterSpacing: ".14em", textTransform: "uppercase" }}><span>ARCANUM — STUDY 62/63</span><span>THE KNOT</span></header>
      <SplitHero />
      <section style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 10, width: "100%", maxWidth: 640, margin: "0 auto" }} aria-label="Knot construction">
        <svg viewBox="0 0 640 176" width="100%" height="164" role="img" aria-label="Knot construction grid and crossing dimensions" style={{ display: "block" }}><g transform="translate(10,-46) scale(.46)"><KnotMark construction size={320} /></g><g fill={INK} fontFamily={MONO}><text x="224" y="34" fontSize="10" letterSpacing="1.2">TWO ROUNDED RECTANGLES</text><text x="224" y="57" fontSize="8" fill={GUIDE}>86 × 192U / 192 × 86U · R22</text><text x="224" y="85" fontSize="10" letterSpacing="1.2">ONE OVER-UNDER LOCK</text><text x="224" y="108" fontSize="8" fill={GUIDE}>12U CLEAR EACH SIDE · 10U SIGNAL DATUM</text><text x="224" y="136" fontSize="10" letterSpacing="1.2">INTERNAL THEME DUALITY</text><text x="224" y="159" fontSize="8" fill={GUIDE}>3U PAPER KEYLINE / 2U UMBER CONTAINMENT</text></g></svg>
      </section>
      <section style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, paddingTop: 2 }} aria-label="Small size proof on both grounds"><div style={{ background: PAPER, display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 25, padding: "2px 0 0" }}>{[64, 32, 16].map(size => <figure key={size} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><Proof size={size} /><figcaption style={{ color: GUIDE, fontSize: 8 }}>{size}</figcaption></figure>)}</div><div style={{ background: FOUNDRY, display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 25, padding: "2px 0 0" }}>{[64, 32, 16].map(size => <figure key={size} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><Proof size={size} /><figcaption style={{ color: HAIRLINE, fontSize: 8 }}>{size}</figcaption></figure>)}</div></section>
      <p style={{ width: "100%", maxWidth: 640, margin: "8px auto 0", color: GUIDE, fontSize: 9, lineHeight: 1.35, letterSpacing: ".12em", textTransform: "uppercase" }}>TWO SYSTEMS, ONE BINDING: THE POLICY HOLDS HUMAN JUDGMENT AND MACHINE ACTION TOGETHER.</p>
    </main>
  );
}