const paper = "#faf6f1";
const ink = "#292522";
const umber = "#655d56";
const signal = "#ff3c00";
const hairline = "#ded7d0";
const guide = "#9b9289";

/*
 * Construction system: 32px module, eight-fold symmetry, 45° rotation.
 * Outer vault radius = 144px; inner aperture radius = 86px; signal core = 18px.
 * The shutter is a single 1:1 blade, repeated only by exact rotational symmetry.
 */
const vaultRing =
  "M 333 200 L 301.8 301.8 L 200 333 L 98.2 301.8 L 67 200 L 98.2 98.2 L 200 67 L 301.8 98.2 Z " +
  "M 260.8 200 L 242.8 242.8 L 200 260.8 L 157.2 242.8 L 139.2 200 L 157.2 157.2 L 200 139.2 L 242.8 157.2 Z";
const blade =
  "M 200 85 L 229 114 L 229 200 L 200 171 Z";
const core =
  "M 200 182 L 218 200 L 200 218 L 182 200 Z";

function ConstructionSystem() {
  return (
    <svg viewBox="0 0 400 400" role="img" aria-label="The Aperture construction system" className="construction-svg">
      <g fill="none" stroke={guide} strokeWidth="1" opacity="0.62">
        {/* These are the actual 144 / 86 radii and the 45° rotational axes used by the mark. */}
        <circle cx="200" cy="200" r="144" />
        <circle cx="200" cy="200" r="86" />
        <circle cx="200" cy="200" r="18" />
        <path d="M 56 200 H 344 M 200 56 V 344 M 98.2 98.2 L 301.8 301.8 M 301.8 98.2 L 98.2 301.8" />
        <path d="M 200 56 L 344 200 L 200 344 L 56 200 Z" opacity="0.48" />
      </g>
      <g stroke={guide} strokeWidth="1" opacity="0.72">
        {/* 32px module ticks document the octagonal vault's exact radial stations. */}
        <path d="M 56 194 V 206 M 88 194 V 206 M 120 194 V 206 M 152 194 V 206 M 184 194 V 206 M 216 194 V 206 M 248 194 V 206 M 280 194 V 206 M 312 194 V 206 M 344 194 V 206" />
        <path d="M 194 56 H 206 M 194 88 H 206 M 194 120 H 206 M 194 152 H 206 M 194 184 H 206 M 194 216 H 206 M 194 248 H 206 M 194 280 H 206 M 194 312 H 206 M 194 344 H 206" />
      </g>
      <path d={vaultRing} fill={ink} fillRule="evenodd" opacity="0.3" />
      <g fill={umber} opacity="0.42">
        <path d={blade} />
        <path d={blade} transform="rotate(45 200 200)" />
        <path d={blade} transform="rotate(90 200 200)" />
        <path d={blade} transform="rotate(135 200 200)" />
        <path d={blade} transform="rotate(180 200 200)" />
        <path d={blade} transform="rotate(225 200 200)" />
        <path d={blade} transform="rotate(270 200 200)" />
        <path d={blade} transform="rotate(315 200 200)" />
      </g>
      <path d={core} fill={signal} opacity="0.72" />
    </svg>
  );
}

export default function TheAperture() {
  return (
    <main className="arcanum-plate aperture-plate">
      <style>{`
        .arcanum-plate {
          min-height: 100vh;
          width: 100%;
          box-sizing: border-box;
          padding: 30px 34px 28px;
          background: ${paper};
          color: ${ink};
          display: flex;
          flex-direction: column;
          font-family: "IBM Plex Mono", "Courier New", monospace;
        }
        .plate-meta {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          color: #837a72;
          font-size: 10px;
          line-height: 1.2;
          letter-spacing: .14em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .plate-meta span:last-child { text-align: right; }
        .plate-hero {
          flex: 1 1 auto;
          min-height: 422px;
          display: grid;
          place-items: center;
        }
        .hero-svg {
          width: min(380px, 74vw);
          height: auto;
          display: block;
        }
        .construction {
          border-top: 1px solid ${hairline};
          min-height: 216px;
          display: grid;
          place-items: center;
        }
        .construction-svg {
          width: min(186px, 44vw);
          height: auto;
          display: block;
        }
        .plate-rationale {
          margin: 19px 0 0;
          color: ${guide};
          font-size: 9px;
          line-height: 1.4;
          letter-spacing: .1em;
          text-transform: uppercase;
        }
        @media (max-width: 520px) {
          .arcanum-plate { padding: 25px 22px 22px; }
          .plate-hero { min-height: 372px; }
          .construction { min-height: 186px; }
          .plate-rationale { margin-top: 15px; }
        }
      `}</style>
      <header className="plate-meta">
        <span>ARCANUM — STUDY 31/34</span>
        <span>THE APERTURE</span>
      </header>
      <section className="plate-hero" aria-label="Finished Aperture symbol">
        <svg viewBox="0 0 400 400" role="img" aria-label="Eight-sided vault aperture with human signal core" className="hero-svg">
          {/* The eight-sided vault is a single compound silhouette, not a camera or letterform. */}
          <path d={vaultRing} fill={ink} fillRule="evenodd" />
          {/* Flat shutter blades turn inward on the documented 45° system. Negative wedges between them are the aperture. */}
          <g fill={umber}>
            <path d={blade} />
            <path d={blade} transform="rotate(45 200 200)" />
            <path d={blade} transform="rotate(90 200 200)" />
            <path d={blade} transform="rotate(135 200 200)" />
            <path d={blade} transform="rotate(180 200 200)" />
            <path d={blade} transform="rotate(225 200 200)" />
            <path d={blade} transform="rotate(270 200 200)" />
            <path d={blade} transform="rotate(315 200 200)" />
          </g>
          {/* Optical correction: the 18px core is inset by 2px from the blade tips so the eye stays quiet at 16px. */}
          <path d={core} fill={signal} />
        </svg>
      </section>
      <section className="construction" aria-label="Aperture construction drawing">
        <ConstructionSystem />
      </section>
      <p className="plate-rationale">EIGHT BLADES WATCH THE HUMAN CHECKPOINT AT THE CENTER.</p>
    </main>
  );
}