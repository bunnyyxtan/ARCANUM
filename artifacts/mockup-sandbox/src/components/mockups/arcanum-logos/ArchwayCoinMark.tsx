import type { CSSProperties } from "react";

export const COIN_GEOMETRY = {
  container: { x: 80, y: 80, size: 240, radius: 42 },
  // Refined entrance: the opening is narrowed to 72 units and the spring
  // drops to 228, making the side masonry visibly load-bearing.
  archPath:
    "M116 86 Q116 84 118 84 H282 Q284 84 284 86 V296 Q284 298 282 298 H236 V228 C236 198 221 180 200 180 C179 180 164 198 164 228 V298 H118 Q116 298 116 296 Z",
  signal: { cx: 200, cy: 196, r: 7 },
} as const;

type CoinMode = "universal" | "inkFallback" | "full" | "ink" | "reversed" | "dark";

export function ArchwayCoinMark({
  size = 120,
  mode = "full",
  style,
  className,
  title = "ARCANUM Archway Coin",
}: {
  size?: number;
  mode?: CoinMode;
  style?: CSSProperties;
  className?: string;
  title?: string;
}) {
  // Universal master: these colors intentionally do not inspect the surface.
  // Legacy mode names remain accepted so older plates do not crash, but only
  // the explicitly documented print fallback may collapse to one color.
  const colors =
    mode === "ink" || mode === "inkFallback"
      ? { coin: "#292522", arch: "#faf6f1", signal: "#292522" }
      : { coin: "#292522", arch: "#faf6f1", signal: "#ff3c00" };
  return (
    <svg width={size} height={size} viewBox="56 56 288 288" role="img" aria-label={title} className={className} style={{ width: size, height: size, display: "block", ...style }}>
      <title>{title}</title>
      <rect x={COIN_GEOMETRY.container.x} y={COIN_GEOMETRY.container.y} width={COIN_GEOMETRY.container.size} height={COIN_GEOMETRY.container.size} rx={COIN_GEOMETRY.container.radius} fill={colors.coin} />
      <path d={COIN_GEOMETRY.archPath} fill={colors.arch} />
      {size >= 32 ? (
        <g fill="none" stroke="#292522" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
          {/* 32px+ detail: threshold bands ground the opening as a door. */}
          <path d="M164 278H236M164 287H236M164 296H236" strokeWidth="2.2" />
          {/* Crown joinery: two quiet voussoir hairlines, never a decorative crown. */}
          <path d="M188 188L200 178L212 188M193 190L200 184L207 190" strokeWidth="1.5" />
          {/* Interior depth: three vertical datum lines; signal floats over the center. */}
          {size >= 48 ? <path d="M178 194V272M200 194V272M222 194V272" strokeWidth="1.35" opacity=".72" /> : null}
        </g>
      ) : null}
      <circle cx={COIN_GEOMETRY.signal.cx} cy={COIN_GEOMETRY.signal.cy} r={COIN_GEOMETRY.signal.r} fill={colors.signal} />
    </svg>
  );
}
