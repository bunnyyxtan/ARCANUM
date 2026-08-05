const PAPER = "#faf6f1";
const INK = "#292522";
const SIGNAL = "#ff3c00";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

/**
 * THE PULSE / STUDY 47
 *
 * One path, one weight: M=8px line weight on a 40M baseline. The pulse
 * begins at φ of the active run (x=154; φ≈.618), rises 13M, returns through
 * a 17M counter-slope, and resumes the ledger baseline. The signal dot is
 * the only terminal accent. Optical correction: the sharp apex is held one
 * half-weight below the construction datum to compensate for visual lift.
 */
const PULSE = "M48 220H150L174 116L204 280L228 220H348";

function Mark({ construction = false, opacity = 1 }: { construction?: boolean; opacity?: number }) {
  return (
    <g opacity={opacity}>
      {construction ? (
        <>
          <g fill="none" stroke={HAIRLINE} strokeWidth="1">
            <path d="M48 92V300M72 92V300M96 92V300M120 92V300M144 92V300M168 92V300M192 92V300M216 92V300M240 92V300M264 92V300M288 92V300M312 92V300M336 92V300M360 92V300" />
            <path d="M36 220H372M36 116H372M36 280H372" />
          </g>
          <g fill="none" stroke={GUIDE} strokeWidth="1" strokeDasharray="4 5">
            <path d="M150 100V292M174 100V292M204 100V292M228 100V292" />
            <path d="M48 220H348" />
          </g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing=".7">
            <text x="145" y="88">φ BREAK / .618</text>
            <text x="233" y="108">13M PEAK</text>
            <text x="44" y="316">ONE STROKE · 1M WEIGHT · TERMINAL SIGNAL</text>
          </g>
        </>
      ) : null}
      <path d={PULSE} fill="none" stroke={INK} strokeWidth="8" strokeLinecap="square" strokeLinejoin="miter" />
      <circle cx="348" cy="220" r="7" fill={SIGNAL} />
    </g>
  );
}

function Mini({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="28 88 344 224" role="img" aria-label={`${size}px pulse`} style={{ width: size, height: size, display: "block" }}><Mark /></svg>;
}

export default function ThePulse() {
  return (
    <main style={{ minHeight: "100dvh", boxSizing: "border-box", background: PAPER, color: INK, padding: "27px 30px", display: "flex", flexDirection: "column", fontFamily: MONO }}>
      <header style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", color: META, fontSize: 10, lineHeight: 1.2, letterSpacing: ".14em", textTransform: "uppercase" }}><span>ARCANUM — STUDY 47/55</span><span>THE PULSE</span></header>
      <section style={{ flex: "1 1 auto", minHeight: 370, display: "grid", placeItems: "center", padding: "12px 0" }} aria-label="Finished pulse"><svg viewBox="28 88 344 224" width="380" height="260" role="img" aria-label="Single ledger stroke with sharp pulse" style={{ width: "min(380px, 82vw)", height: "auto", display: "block" }}><Mark /></svg></section>
      <section style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 10, width: "100%", maxWidth: 640, margin: "0 auto" }} aria-label="Pulse construction"><svg viewBox="0 0 640 180" width="100%" height="170" role="img" aria-label="Pulse golden ratio construction" style={{ display: "block" }}><g transform="translate(180,-48) scale(.7)"><Mark construction opacity={.42} /></g></svg></section>
      <section style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 38, paddingTop: 2 }} aria-label="Small size proof">{[64, 32, 16].map(size => <figure key={size} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><Mini size={size} /><figcaption style={{ color: GUIDE, fontSize: 8 }}>{size}</figcaption></figure>)}</section>
      <p style={{ width: "100%", maxWidth: 640, margin: "8px auto 0", color: GUIDE, fontSize: 9, lineHeight: 1.35, letterSpacing: ".12em", textTransform: "uppercase" }}>ONE MONITORED FLOW — FLAT, INTERRUPTED, THEN STEADY AGAIN.</p>
    </main>
  );
}