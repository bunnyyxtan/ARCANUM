const PAPER = "#faf6f1";
const INK = "#292522";
const UMBER = "#655d56";
const SIGNAL = "#ff3c00";

export default function ChamferA() {
  return (
    <main
      className="min-h-screen w-full flex flex-col items-center justify-center"
      style={{
        minHeight: "100dvh",
        background: PAPER,
        color: INK,
        padding: "32px 20px 28px",
        boxSizing: "border-box",
      }}
    >
      <svg
        viewBox="0 0 480 480"
        width="420"
        height="420"
        role="img"
        aria-labelledby="chamfer-title chamfer-desc"
        style={{ width: "min(84vw, 420px)", height: "auto", display: "block" }}
      >
        <title id="chamfer-title">Arcanum Chamfer A</title>
        <desc id="chamfer-desc">
          A solid, chamfered architectural A drawn as an engraved brass mark.
        </desc>

        {/* Optical correction: the crown rises 4px past the nominal cap guide;
            the outer terminals sit 3px below the baseline. The diagonal
            miters are deliberately blunt-cut, not rounded. */}
        <path
          fill={INK}
          fillRule="evenodd"
          d="M240 58
             C247 58 252 65 257 77
             L401 384
             L388 410
             L350 410
             L334 397
             L292 302
             L188 302
             L146 397
             L130 410
             L92 410
             L79 384
             L223 77
             C228 65 233 58 240 58 Z
             M240 139
             C237 139 234 144 231 153
             L198 251
             L203 257
             L277 257
             L282 251
             L249 153
             C246 144 243 139 240 139 Z"
        />

        {/* One light rule only: the upper-left plane is umber; all planes on
            the opposite shoulder remain the same ink as the face. This is a
            single continuous bevel with no highlight gap or stroke. */}
        <path
          fill={UMBER}
          d="M224 79
             L236 66
             L104 381
             L92 403
             L108 403
             L122 378
             L242 94
             L240 65 Z"
        />

        {/* Joint thinning: the rule enters each diagonal on a clean miter;
            there is no paper-colored sliver inside the bar. */}
        <path
          fill={INK}
          d="M158 249
             L322 249
             L326 264
             L322 282
             L158 282
             L154 264 Z"
        />

        {/* The top edge of the rule is the same directional umber bevel. */}
        <path
          fill={UMBER}
          d="M158 249 L322 249 L324 257 L156 257 Z"
        />

        {/* Signal facet: one clean orange plane is cut into the rule's right
            terminal and ends flush before the outer diagonal silhouette. */}
        <path
          fill={SIGNAL}
          d="M306 257 L322 257 L324 264 L322 274 L306 274 Z"
        />
      </svg>

      <p
        style={{
          margin: "18px 0 0",
          color: "#9b9289",
          fontFamily: '"IBM Plex Mono", "DM Mono", monospace',
          fontSize: "10px",
          lineHeight: 1.2,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          textAlign: "center",
        }}
      >
        ARCANUM — STUDY 25/26 · CHAMFER A
      </p>
    </main>
  );
}