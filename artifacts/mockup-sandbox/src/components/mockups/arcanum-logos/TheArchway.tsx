const PAPER = "#faf6f1";
const INK = "#292522";
const SIGNAL = "#ff3c00";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

/**
 * THE ARCHWAY / STUDY 46
 *
 * Module M=24. The treasury is a 7M×10M monolith; the governed opening is
 * 3M wide with a 1.5M spring line and a 1.5M radius-like cubic crown.
 * The opening runs through the base, not into a floating badge. The crown
 * uses matched cubic handles for a G2-feeling tangent transition.
 * Optical correction: the side piers are 0.10M heavier than the lintel at
 * small scale; the signal is inset above the spring line so it belongs to
 * the passage rather than reading as a notch in the masonry.
 */
const ARCH =
  "M116 80H284V320H116Z " +
  "M164 320V202 C164 163 180 142 200 142 C220 142 236 163 236 202V320Z";

function Mark({ construction = false, opacity = 1 }: { construction?: boolean; opacity?: number }) {
  return (
    <g opacity={opacity}>
      {construction ? (
        <>
          <g fill="none" stroke={HAIRLINE} strokeWidth="1">
            <path d="M92 56V344M116 56V344M140 56V344M164 56V344M188 56V344M212 56V344M236 56V344M260 56V344M284 56V344M308 56V344" />
            <path d="M92 56H308M92 80H308M92 104H308M92 128H308M92 152H308M92 176H308M92 200H308M92 224H308M92 248H308M92 272H308M92 296H308M92 320H308M92 344H308" />
          </g>
          <g fill="none" stroke={GUIDE} strokeWidth="1" strokeDasharray="4 5">
            <rect x="116" y="80" width="168" height="240" />
            <path d="M164 320V202C164 163 180 142 200 142C220 142 236 163 236 202V320" />
            <path d="M164 202H236M200 128V320" />
          </g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing=".7">
            <text x="208" y="72">7M × 10M MONOLITH</text>
            <text x="208" y="135">3M PASSAGE / G2 CROWN</text>
            <text x="88" y="358">SPRING / 1.5M · SIGNAL INSET / .5M</text>
          </g>
        </>
      ) : null}
      <path d={ARCH} fill={INK} fillRule="evenodd" />
      <circle cx="200" cy="228" r="7" fill={SIGNAL} />
    </g>
  );
}

function Mini({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="88 56 224 288" role="img" aria-label={`${size}px archway`} style={{ width: size, height: size, display: "block" }}><Mark /></svg>;
}

export default function TheArchway() {
  return (
    <main style={{ minHeight: "100dvh", boxSizing: "border-box", background: PAPER, color: INK, padding: "27px 30px", display: "flex", flexDirection: "column", fontFamily: MONO }}>
      <header style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", color: META, fontSize: 10, lineHeight: 1.2, letterSpacing: ".14em", textTransform: "uppercase" }}><span>ARCANUM — STUDY 46/55</span><span>THE ARCHWAY</span></header>
      <section style={{ flex: "1 1 auto", minHeight: 370, display: "grid", placeItems: "center", padding: "12px 0" }} aria-label="Finished archway"><svg viewBox="88 56 224 288" width="360" height="400" role="img" aria-label="Ink monolith with governed round arch passage" style={{ width: "min(360px, 78vw)", height: "auto", display: "block" }}><Mark /></svg></section>
      <section style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 10, width: "100%", maxWidth: 640, margin: "0 auto" }} aria-label="Archway construction"><svg viewBox="0 0 640 180" width="100%" height="170" role="img" aria-label="Archway grid and geometry" style={{ display: "block" }}><g transform="translate(180,-48) scale(.7)"><Mark construction opacity={.42} /></g></svg></section>
      <section style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 38, paddingTop: 2 }} aria-label="Small size proof">{[64, 32, 16].map(size => <figure key={size} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><Mini size={size} /><figcaption style={{ color: GUIDE, fontSize: 8 }}>{size}</figcaption></figure>)}</section>
      <p style={{ width: "100%", maxWidth: 640, margin: "8px auto 0", color: GUIDE, fontSize: 9, lineHeight: 1.35, letterSpacing: ".12em", textTransform: "uppercase" }}>A TREASURY IS A PLACE YOU ENTER ONLY THROUGH THE GOVERNED GATE.</p>
    </main>
  );
}