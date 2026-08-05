const PAPER = "#faf6f1";
const INK = "#292522";
const SIGNAL = "#ff3c00";
const UMBER = "#655d56";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

/**
 * THE CLASP / STUDY 28A
 * M=24. Outer ring diameter=232, band=28: Ø:W=8.29:1.
 * Signal thread diameter=72; its center is 116px from ring center.
 * Paper crossing gaps are 8px (0.29× ring band), enough to preserve a
 * deliberate over/under read at 16px. The thread is one continuous path.
 * Optical corrections: the ring's horizontal extrema are eased by 1px in
 * the bezier approximation; the thread is held 2px toward the ring center
 * so the crossings do not visually loosen after reduction.
 */

function ClaspMark({ construction = false, opacity = 1 }: { construction?: boolean; opacity?: number }) {
  const ringPath = "M200 84C264 84 316 136 316 200C316 264 264 316 200 316C136 316 84 264 84 200C84 136 136 84 200 84Z";
  return (
    <g opacity={opacity}>
      {construction ? (
        <>
          <g fill="none" stroke={HAIRLINE} strokeWidth="1">
            <circle cx="200" cy="200" r="116" /><circle cx="200" cy="200" r="88" />
            <path d="M84 200H316M200 84V316M116 116L284 284M284 116L116 284" />
          </g>
          <g fill="none" stroke={GUIDE} strokeWidth="1" strokeDasharray="4 5">
            <path d="M200 164C243 164 278 178 278 200C278 222 243 236 200 236C157 236 122 222 122 200C122 178 157 164 200 164Z" />
            <path d="M84 332H316" />
          </g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing="0.7">
            <text x="222" y="92">Ø : W = 8.29 : 1</text><text x="222" y="108">THREAD Ø / 72</text>
            <text x="52" y="338">GAP / 8 · CENTER DISTANCE / 116</text>
          </g>
        </>
      ) : null}
      <path d={`${ringPath} M200 112C249 112 288 151 288 200C288 249 249 288 200 288C151 288 112 249 112 200C112 151 151 112 200 112Z`} fill={INK} fillRule="evenodd" />
      {/* Signal thread: the paper slits create the literal behind/front logic. */}
      <path d="M116 200C116 160 148 128 188 128C228 128 260 160 260 200C260 240 228 272 188 272C148 272 116 240 116 200Z" fill="none" stroke={SIGNAL} strokeWidth="28" />
      <path d="M167 143L181 157M195 243L209 257" stroke={PAPER} strokeWidth="8" strokeLinecap="butt" />
    </g>
  );
}

function Mini({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="48 48 304 304" role="img" aria-label={`${size}px clasp`} style={{ width: size, height: size, display: "block" }}><ClaspMark /></svg>;
}

export default function TheClasp() {
  return <main style={{ minHeight: "100dvh", width: "100%", boxSizing: "border-box", background: PAPER, color: INK, padding: "27px 30px", display: "flex", flexDirection: "column", fontFamily: MONO }}>
    <header style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", color: META, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}><span>ARCANUM — STUDY 28A</span><span>THE CLASP</span></header>
    <section style={{ flex: "1 1 auto", minHeight: 370, display: "grid", placeItems: "center", padding: "12px 0" }}><svg viewBox="40 40 320 320" width="380" height="380" role="img" aria-label="A signal thread clasped through an ink ring" style={{ width: "min(380px, 78vw)", height: "auto" }}><ClaspMark /></svg></section>
    <section style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 10, width: "100%", maxWidth: 640, margin: "0 auto" }}><svg viewBox="0 0 640 180" width="100%" height="170" role="img" aria-label="Clasp construction"><g transform="translate(180,-49) scale(.7)"><ClaspMark construction opacity={0.42} /></g></svg></section>
    <section style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 38, paddingTop: 2 }}>{[64,32,16].map(size => <figure key={size} style={{ margin: 0, textAlign: "center" }}><Mini size={size} /><figcaption style={{ color: GUIDE, fontSize: 8 }}>{size}</figcaption></figure>)}</section>
    <p style={{ maxWidth: 640, width: "100%", margin: "8px auto 0", color: GUIDE, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase" }}>TWO AUTHORITIES ARE CLASPED. THE THREAD CANNOT LEAVE THE RING.</p>
  </main>;
}