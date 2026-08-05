const PAPER = "#faf6f1";
const INK = "#292522";
const SIGNAL = "#ff3c00";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

/**
 * THE CUSTODIAN / STUDY 49
 *
 * Two matched cubic arcs form a 1.58:1 vesica: M=20, span=220, rise=140.
 * The upper/lower handles are mirrored for G2-feeling continuity at the
 * pointed ends. The iris is a flat 2M ring, not a photographic eye.
 * Proportion is intentionally broad and low (1.58:1, not a round eye) with
 * a 10px lower-arc tuck; that keeps it a seal of attention, not a CBS mark.
 * Optical correction: pupil sits 2px above geometric center to avoid droop.
 */
const VESICA = "M90 200 C142 122 258 122 310 200 C258 278 142 278 90 200 Z";

function Mark({ construction = false, opacity = 1 }: { construction?: boolean; opacity?: number }) {
  return (
    <g opacity={opacity}>
      {construction ? (
        <>
          <g fill="none" stroke={HAIRLINE} strokeWidth="1">
            <path d="M70 80V320M90 80V320M110 80V320M130 80V320M150 80V320M170 80V320M190 80V320M210 80V320M230 80V320M250 80V320M270 80V320M290 80V320M310 80V320M330 80V320" />
            <path d="M70 80H330M70 100H330M70 120H330M70 140H330M70 160H330M70 180H330M70 200H330M70 220H330M70 240H330M70 260H330M70 280H330M70 300H330M70 320H330" />
          </g>
          <g fill="none" stroke={GUIDE} strokeWidth="1" strokeDasharray="4 5">
            <path d="M90 200C142 122 258 122 310 200C258 278 142 278 90 200Z" />
            <path d="M90 200H310M200 120V280" />
            <circle cx="200" cy="198" r="40" />
          </g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing=".7">
            <text x="204" y="112">1.58:1 VESICA · G2 ARCS</text>
            <text x="204" y="292">IRIS / 2M · PUPIL / .5M</text>
            <text x="72" y="340">LOW, WARM APERTURE · LOWER TUCK / 10PX</text>
          </g>
        </>
      ) : null}
      <path d={VESICA} fill="none" stroke={INK} strokeWidth="10" strokeLinecap="round" />
      <circle cx="200" cy="198" r="34" fill="none" stroke={INK} strokeWidth="10" />
      <circle cx="200" cy="198" r="7" fill={SIGNAL} />
    </g>
  );
}

function Mini({ size }: { size: number }) {
  return <svg width={size} height={size} viewBox="64 96 272 208" role="img" aria-label={`${size}px custodian`} style={{ width: size, height: size, display: "block" }}><Mark /></svg>;
}

export default function TheCustodian() {
  return (
    <main style={{ minHeight: "100dvh", boxSizing: "border-box", background: PAPER, color: INK, padding: "27px 30px", display: "flex", flexDirection: "column", fontFamily: MONO }}>
      <header style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "space-between", color: META, fontSize: 10, lineHeight: 1.2, letterSpacing: ".14em", textTransform: "uppercase" }}><span>ARCANUM — STUDY 49/55</span><span>THE CUSTODIAN</span></header>
      <section style={{ flex: "1 1 auto", minHeight: 370, display: "grid", placeItems: "center", padding: "12px 0" }} aria-label="Finished custodian"><svg viewBox="64 96 272 208" width="380" height="300" role="img" aria-label="Low vesica custodian eye with signal pupil" style={{ width: "min(380px, 84vw)", height: "auto", display: "block" }}><Mark /></svg></section>
      <section style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 10, width: "100%", maxWidth: 640, margin: "0 auto" }} aria-label="Custodian construction"><svg viewBox="0 0 640 180" width="100%" height="170" role="img" aria-label="Custodian G2 arc construction" style={{ display: "block" }}><g transform="translate(180,-48) scale(.7)"><Mark construction opacity={.42} /></g></svg></section>
      <section style={{ width: "100%", maxWidth: 640, margin: "0 auto", display: "flex", justifyContent: "center", alignItems: "flex-end", gap: 38, paddingTop: 2 }} aria-label="Small size proof">{[64, 32, 16].map(size => <figure key={size} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><Mini size={size} /><figcaption style={{ color: GUIDE, fontSize: 8 }}>{size}</figcaption></figure>)}</section>
      <p style={{ width: "100%", maxWidth: 640, margin: "8px auto 0", color: GUIDE, fontSize: 9, lineHeight: 1.35, letterSpacing: ".12em", textTransform: "uppercase" }}>A BROAD, QUIET APERTURE — ATTENTION WITHOUT SURVEILLANCE.</p>
    </main>
  );
}