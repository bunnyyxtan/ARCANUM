const PAPER = "#faf6f1";
const INK = "#292522";
const SIGNAL = "#ff3c00";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

/**
 * THE SIGNET — STUDY 59/59
 *
 * Fresh construction: a bespoke signet face with deliberately unequal
 * chamfers. The upper pair uses 22u cuts; the lower pair uses 34u cuts.
 * Side chamfers are 18u. This asymmetry prevents a generic octagon read.
 *
 * The countersign is one engraved paper incision from (72,280) to (330,180),
 * a 21.2° rise. Its signal datum is the intersection at (221,222), which is
 * the face's golden-section x point (110 + .618 × 180 = 221.2u) and the
 * corresponding y on the incision. The signal is punched, not appended.
 *
 * Squint test: checked at 16u and in one color. The silhouette reads as a
 * single signet face with one cut; no circle, shield, arch, pants, letter,
 * badge clip-art, or accidental object read appears.
 */

const SIGNET_PATH = "M132 72H288L310 94V150L328 168V246L294 280H132L98 246V168L116 150V94Z";
const INCISION = "M72 280L330 180";
const SIGNAL_X = 221;
const SIGNAL_Y = 222;

function SignetMark({
  construction = false,
  monochrome = false,
  size = 360,
}: {
  construction?: boolean;
  monochrome?: boolean;
  size?: number;
}) {
  return (
    <svg
      viewBox="48 42 304 316"
      width={size}
      height={size}
      role="img"
      aria-label="Irregular ink signet face with a paper countersign incision"
      style={{ width: size, height: size, display: "block" }}
    >
      <rect x="56" y="50" width="288" height="300" fill={PAPER} />
      {construction ? (
        <>
          <g fill="none" stroke={HAIRLINE} strokeWidth="1">
            <path d="M72 50V350M96 50V350M120 50V350M144 50V350M168 50V350M192 50V350M216 50V350M240 50V350M264 50V350M288 50V350M312 50V350M336 50V350" />
            <path d="M56 74H344M56 98H344M56 122H344M56 146H344M56 170H344M56 194H344M56 218H344M56 242H344M56 266H344M56 290H344M56 314H344M56 338H344" />
          </g>
          <g fill="none" stroke={GUIDE} strokeWidth="1" strokeDasharray="4 5">
            <path d={SIGNET_PATH} />
            <path d="M110 72V280M221 58V294M98 222H328" />
            <path d={INCISION} />
          </g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing=".55">
            <text x="112" y="64">TOP CHAMFER · 22U</text>
            <text x="274" y="304">LOWER CHAMFER · 34U</text>
            <text x="222" y="214">GOLDEN SECTION · 0.618</text>
            <text x="74" y="294">INCISION · 21.2° RISE</text>
          </g>
        </>
      ) : null}
      <path d={SIGNET_PATH} fill={INK} />
      <path d={INCISION} fill="none" stroke={PAPER} strokeWidth="8" strokeLinecap="butt" />
      {!monochrome ? <circle cx={SIGNAL_X} cy={SIGNAL_Y} r="5.5" fill={SIGNAL} /> : null}
    </svg>
  );
}

function Mini({ size, monochrome = false }: { size: number; monochrome?: boolean }) {
  return <SignetMark size={size} monochrome={monochrome} />;
}

export default function TheSignet() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        boxSizing: "border-box",
        background: PAPER,
        color: INK,
        padding: "27px 30px 24px",
        display: "flex",
        flexDirection: "column",
        fontFamily: MONO,
      }}
    >
      <header
        style={{
          width: "100%",
          maxWidth: 640,
          margin: "0 auto",
          display: "flex",
          justifyContent: "space-between",
          color: META,
          fontSize: 10,
          lineHeight: 1.2,
          letterSpacing: ".14em",
          textTransform: "uppercase",
        }}
      >
        <span>ARCANUM — STUDY 59/59</span>
        <span>THE SIGNET</span>
      </header>

      <section
        style={{
          flex: "1 1 auto",
          minHeight: 370,
          display: "grid",
          placeItems: "center",
          padding: "12px 0 8px",
        }}
        aria-label="Finished signet mark"
      >
        <SignetMark size={360} />
      </section>

      <section
        style={{
          borderTop: `1px solid ${HAIRLINE}`,
          paddingTop: 10,
          width: "100%",
          maxWidth: 640,
          margin: "0 auto",
        }}
        aria-label="Signet construction"
      >
        <svg viewBox="0 0 640 178" width="100%" height="166" role="img" aria-label="Signet construction grid and chamfer dimensions" style={{ display: "block" }}>
          <g transform="translate(8,-40) scale(.48)">
            <SignetMark construction size={360} />
          </g>
          <g fill={INK} fontFamily={MONO}>
            <text x="230" y="35" fontSize="10" letterSpacing="1.2">IRREGULAR SIGNET FACE</text>
            <text x="230" y="58" fontSize="8" fill={GUIDE}>UPPER CHAMFERS 22U · LOWER CHAMFERS 34U</text>
            <text x="230" y="86" fontSize="10" letterSpacing="1.2">ONE COUNTERSIGN INCISION</text>
            <text x="230" y="109" fontSize="8" fill={GUIDE}>PAPER CUT · 21.2° RISE · 8U WIDTH</text>
            <text x="230" y="137" fontSize="10" letterSpacing="1.2">SIGNAL AT GOLDEN SECTION</text>
            <text x="230" y="160" fontSize="8" fill={GUIDE}>X = 221U · ONE ELEMENT · #FF3C00</text>
          </g>
        </svg>
      </section>

      <section
        style={{
          width: "100%",
          maxWidth: 640,
          margin: "0 auto",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-end",
          gap: 38,
          paddingTop: 2,
        }}
        aria-label="Small size and one-color proof"
      >
        {[64, 32, 16].map((size) => (
          <figure key={size} style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <Mini size={size} />
            <figcaption style={{ color: GUIDE, fontSize: 8 }}>{size}</figcaption>
          </figure>
        ))}
        <figure style={{ margin: "0 0 0 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <Mini size={32} monochrome />
          <figcaption style={{ color: GUIDE, fontSize: 8 }}>1C</figcaption>
        </figure>
      </section>

      <p
        style={{
          width: "100%",
          maxWidth: 640,
          margin: "8px auto 0",
          color: GUIDE,
          fontSize: 9,
          lineHeight: 1.35,
          letterSpacing: ".12em",
          textTransform: "uppercase",
        }}
      >
        AUTHORITY, MADE CURRENT: A SINGLE FACE, SIGNED ONCE, WITHOUT ORNAMENT.
      </p>
    </main>
  );
}