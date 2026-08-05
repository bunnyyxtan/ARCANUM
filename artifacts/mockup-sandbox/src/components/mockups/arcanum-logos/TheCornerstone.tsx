const PAPER = "#faf6f1";
const INK = "#292522";
const UMBER = "#655d56";
const SIGNAL = "#ff3c00";
const HAIRLINE = "#ded7d0";
const GUIDE = "#9b9289";
const META = "#837a72";
const MONO = "IBM Plex Mono, ui-monospace, SFMono-Regular, monospace";

/**
 * THE CORNERSTONE — STUDY 58/59
 *
 * Fresh construction: an unequal L-bracket, not a letterform. The vertical
 * arm measures 216u from shoulder to foot; the horizontal arm measures 190u
 * from inner corner to end. The 45° diamond is 76u across its points.
 *
 * Optical correction: the diamond's geometric left point lands at the
 * bracket's inner corner (136,258), but its visible umber mass is shifted
 * 3u upward and 4u right. This keeps the square seated instead of appearing
 * to sag into the lower arm. The signal datum stays on the true contact
 * vertex, so the orange point describes the engineering relationship rather
 * than decorating the square.
 *
 * Squint test: checked at 16u and in one color. The silhouette reads only as
 * bracket + seated diamond; no arch, shield, circle, pants, letter, or
 * accidental object appears.
 */

const CONTACT_X = 136;
const CONTACT_Y = 258;

function CornerstoneMark({
  construction = false,
  monochrome = false,
  size = 360,
}: {
  construction?: boolean;
  monochrome?: boolean;
  size?: number;
}) {
  const umber = monochrome ? INK : UMBER;
  return (
    <svg
      viewBox="48 42 304 316"
      width={size}
      height={size}
      role="img"
      aria-label="Unequal ink L bracket cradling a tilted umber square"
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
            <path d="M102 82V300H292" />
            <path d="M136 258L174 220L212 258L174 296Z" />
            <path d="M136 232V284M110 258H224" />
            <path d="M136 258H212" />
          </g>
          <g fill={GUIDE} fontFamily={MONO} fontSize="7" letterSpacing=".6">
            <text x="104" y="72">VERTICAL ARM · 216U</text>
            <text x="212" y="316">HORIZONTAL ARM · 190U</text>
            <text x="181" y="214">45° / 76U POINT-TO-POINT</text>
            <text x="142" y="274">CONTACT DATUM · 136 / 258</text>
          </g>
        </>
      ) : null}
      <path d="M102 82H136V258H292V296H102Z" fill={INK} />
      <path d="M136 258L174 220L212 258L174 296Z" fill={umber} />
      {!monochrome ? <circle cx={CONTACT_X} cy={CONTACT_Y} r="5.5" fill={SIGNAL} /> : null}
    </svg>
  );
}

function Mini({ size, monochrome = false }: { size: number; monochrome?: boolean }) {
  return <CornerstoneMark size={size} monochrome={monochrome} />;
}

export default function TheCornerstone() {
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
        <span>ARCANUM — STUDY 58/59</span>
        <span>THE CORNERSTONE</span>
      </header>

      <section
        style={{
          flex: "1 1 auto",
          minHeight: 370,
          display: "grid",
          placeItems: "center",
          padding: "12px 0 8px",
        }}
        aria-label="Finished cornerstone mark"
      >
        <CornerstoneMark size={360} />
      </section>

      <section
        style={{
          borderTop: `1px solid ${HAIRLINE}`,
          paddingTop: 10,
          width: "100%",
          maxWidth: 640,
          margin: "0 auto",
        }}
        aria-label="Cornerstone construction"
      >
        <svg viewBox="0 0 640 178" width="100%" height="166" role="img" aria-label="Cornerstone construction grid and dimensions" style={{ display: "block" }}>
          <g transform="translate(8,-40) scale(.48)">
            <CornerstoneMark construction size={360} />
          </g>
          <g fill={INK} fontFamily={MONO}>
            <text x="230" y="35" fontSize="10" letterSpacing="1.2">UNEQUAL L-BRACKET</text>
            <text x="230" y="58" fontSize="8" fill={GUIDE}>216U / 190U · 12U THICKNESS</text>
            <text x="230" y="86" fontSize="10" letterSpacing="1.2">SEATED 45° SQUARE</text>
            <text x="230" y="109" fontSize="8" fill={GUIDE}>76U POINT-TO-POINT · +4U / −3U OPTICAL SHIFT</text>
            <text x="230" y="137" fontSize="10" letterSpacing="1.2">SIGNAL AT TRUE CONTACT</text>
            <text x="230" y="160" fontSize="8" fill={GUIDE}>ONE ELEMENT · 5.5U RADIUS · #FF3C00</text>
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
        A WEIGHT-BEARING CORNER, WITH THE SIGNAL WHERE FOUNDATION BECOMES TRUST.
      </p>
    </main>
  );
}