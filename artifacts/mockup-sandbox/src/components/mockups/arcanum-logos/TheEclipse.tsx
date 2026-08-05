const PAPER = "#faf6f1";
const INK = "#292522";
const SIGNAL = "#ff3c00";
const UMBER = "#655d56";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

/**
 * THE ECLIPSE / STUDY 28B
 * M=24. Guard disc R=116. Human disc r=42, offset=(28,-18).
 * The minimum paper crescent is 16px (0.38× human radius), maintained by
 * keeping the signal disc fully inside the guard's field and separate.
 * Optical correction: the signal disc is shifted 3px down-left from the
 * geometric offset so the upper crescent does not dominate at small sizes.
 */

function EclipseMark({ construction = false, opacity = 1 }: { construction?: boolean; opacity?: number }) {
  return <g opacity={opacity}>
    {construction ? <><g fill="none" stroke={HAIRLINE} strokeWidth="1"><circle cx="200" cy="200" r="116" /><circle cx="228" cy="179" r="42" /><path d="M84 200H316M200 84V316" /></g><g fill="none" stroke={GUIDE} strokeWidth="1" strokeDasharray="4 5"><path d="M200 200L228 179" /><path d="M186 179H270" /></g><g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing="0.7"><text x="232" y="150">R : r = 2.76 : 1</text><text x="232" y="164">OFFSET / +28, −21</text><text x="70" y="338">CRESCENT / 16 MINIMUM</text></g></> : null}
    <circle cx="200" cy="200" r="116" fill={INK} />
    <circle cx="228" cy="179" r="42" fill={PAPER} />
    <circle cx="228" cy="179" r="30" fill={SIGNAL} />
  </g>;
}

function Mini({ size }: { size: number }) { return <svg width={size} height={size} viewBox="48 48 304 304" role="img" aria-label={`${size}px eclipse`} style={{ width: size, height: size, display: "block" }}><EclipseMark /></svg>; }

export default function TheEclipse() {
  return <main style={{ minHeight: "100dvh", width: "100%", boxSizing: "border-box", background: PAPER, color: INK, padding: "27px 30px", display: "flex", flexDirection: "column", fontFamily: MONO }}>
    <header style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", color: META, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}><span>ARCANUM — STUDY 28B</span><span>THE ECLIPSE</span></header>
    <section style={{ flex: "1 1 auto", minHeight: 370, display: "grid", placeItems: "center", padding: "12px 0" }}><svg viewBox="40 40 320 320" width="380" height="380" role="img" aria-label="A signal disc held inside an ink guard disc by a paper crescent" style={{ width: "min(380px, 78vw)", height: "auto" }}><EclipseMark /></svg></section>
    <section style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 10, width: "100%", maxWidth: 640, margin: "0 auto" }}><svg viewBox="0 0 640 180" width="100%" height="170" role="img" aria-label="Eclipse construction"><g transform="translate(180,-49) scale(.7)"><EclipseMark construction opacity={0.42} /></g></svg></section>
    <section style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 38, paddingTop: 2 }}>{[64,32,16].map(size => <figure key={size} style={{ margin: 0, textAlign: "center" }}><Mini size={size} /><figcaption style={{ color: GUIDE, fontSize: 8 }}>{size}</figcaption></figure>)}</section>
    <p style={{ maxWidth: 640, width: "100%", margin: "8px auto 0", color: GUIDE, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase" }}>THE AGENT IS THE MASS. THE HUMAN FIRE IS HELD INSIDE ITS FIELD.</p>
  </main>;
}