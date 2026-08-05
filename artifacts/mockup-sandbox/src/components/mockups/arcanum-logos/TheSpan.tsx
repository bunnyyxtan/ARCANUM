const PAPER = "#faf6f1";
const INK = "#292522";
const UMBER = "#655d56";
const SIGNAL = "#ff3c00";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

/**
 * THE SPAN / STUDY 54
 *
 * Civil datum M=20. Two 3M×3.5M abutments stand 7M apart. The bridge is a
 * single 1M solid cubic span, with 0.75M rise and matched G2-like handles
 * into the bearing blocks. Signal sits at the true keystone apex, not at
 * either party. Optical correction: apex is lowered 3px from the geometric
 * construction crown so the arc does not appear to float.
 */
const SPAN = "M116 244 C144 178 256 178 284 244";

function Mark({ construction = false, opacity = 1 }: { construction?: boolean; opacity?: number }) {
  return (
    <g opacity={opacity}>
      {construction ? (
        <>
          <g fill="none" stroke={HAIRLINE} strokeWidth="1">
            <path d="M76 80V320M96 80V320M116 80V320M136 80V320M156 80V320M176 80V320M196 80V320M216 80V320M236 80V320M256 80V320M276 80V320M296 80V320M316 80V320" />
            <path d="M76 80H316M76 100H316M76 120H316M76 140H316M76 160H316M76 180H316M76 200H316M76 220H316M76 240H316M76 260H316M76 280H316M76 300H316M76 320H316" />
          </g>
          <g fill="none" stroke={GUIDE} strokeWidth="1" strokeDasharray="4 5">
            <path d="M116 244C144 178 256 178 284 244" />
            <path d="M116 244H284M200 170V260" />
            <rect x="96" y="244" width="40" height="76" />
            <rect x="264" y="244" width="40" height="76" />
          </g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing=".7">
            <text x="204" y="166">7M CLEAR · .75M RISE</text>
            <text x="204" y="260">KEYSTONE / 1M</text>
            <text x="76" y="340">TWO ABUTMENTS · ONE LOAD PATH · G2 BEARINGS</text>
          </g>
        </>
      ) : null}
      <rect x="96" y="244" width="40" height="76" fill={INK} />
      <rect x="264" y="244" width="40" height="76" fill={UMBER} />
      <path d={SPAN} fill="none" stroke={INK} strokeWidth="20" strokeLinecap="round" />
      <circle cx="200" cy="191" r="7" fill={SIGNAL} />
    </g>
  );
}

function Mini({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="72 150 256 190" role="img" aria-label={`${size}px span`} style={{ width: size, height: size, display: "block" }}><Mark /></svg>;
}

export default function TheSpan() {
  return (
    <main style={{ minHeight: "100dvh", boxSizing: "border-box", background: PAPER, color: INK, padding: "27px 30px", display: "flex", flexDirection: "column", fontFamily: MONO }}>
      <header style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", color: META, fontSize: 10, lineHeight: 1.2, letterSpacing: ".14em", textTransform: "uppercase" }}><span>ARCANUM — STUDY 54/55</span><span>THE SPAN</span></header>
      <section style={{ flex: "1 1 auto", minHeight: 370, display: "grid", placeItems: "center", padding: "12px 0" }} aria-label="Finished span"><svg viewBox="72 150 256 190" width="380" height="300" role="img" aria-label="Two abutments connected by a precise arc span" style={{ width: "min(380px, 84vw)", height: "auto", display: "block" }}><Mark /></svg></section>
      <section style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 10, width: "100%", maxWidth: 640, margin: "0 auto" }} aria-label="Span construction"><svg viewBox="0 0 640 180" width="100%" height="170" role="img" aria-label="Civil engineering span construction" style={{ display: "block" }}><g transform="translate(180,-48) scale(.7)"><Mark construction opacity={.42} /></g></svg></section>
      <section style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 38, paddingTop: 2 }} aria-label="Small size proof">{[64, 32, 16].map(size => <figure key={size} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><Mini size={size} /><figcaption style={{ color: GUIDE, fontSize: 8 }}>{size}</figcaption></figure>)}</section>
      <p style={{ width: "100%", maxWidth: 640, margin: "8px auto 0", color: GUIDE, fontSize: 9, lineHeight: 1.35, letterSpacing: ".12em", textTransform: "uppercase" }}>TWO PARTIES, ONE LOAD PATH — TRUST MADE STRUCTURAL.</p>
    </main>
  );
}