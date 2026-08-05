import type { CSSProperties } from "react";

export const COIN_GEOMETRY = {
  container: { x: 80, y: 80, size: 240, radius: 42 },
  archPath:
    "M116 86 Q116 84 118 84 H282 Q284 84 284 86 V296 Q284 298 282 298 H238 V220 C238 190 222 174 200 174 C178 174 162 190 162 220 V298 H118 Q116 298 116 296 Z",
  signal: { cx: 200, cy: 196, r: 7 },
} as const;

type CoinMode = "full" | "ink" | "reversed" | "dark";

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
  const colors =
    mode === "dark"
      ? { coin: "#edf0f3", arch: "#181b21", signal: "#ff5a1f" }
      : mode === "reversed"
        ? { coin: "#faf6f1", arch: "#292522", signal: "#faf6f1" }
        : mode === "ink"
          ? { coin: "#292522", arch: "#faf6f1", signal: "#faf6f1" }
          : { coin: "#292522", arch: "#faf6f1", signal: "#ff3c00" };
  return (
    <svg width={size} height={size} viewBox="56 56 288 288" role="img" aria-label={title} className={className} style={{ width: size, height: size, display: "block", ...style }}>
      <title>{title}</title>
      <rect x={COIN_GEOMETRY.container.x} y={COIN_GEOMETRY.container.y} width={COIN_GEOMETRY.container.size} height={COIN_GEOMETRY.container.size} rx={COIN_GEOMETRY.container.radius} fill={colors.coin} />
      <path d={COIN_GEOMETRY.archPath} fill={colors.arch} />
      <circle cx={COIN_GEOMETRY.signal.cx} cy={COIN_GEOMETRY.signal.cy} r={COIN_GEOMETRY.signal.r} fill={colors.signal} />
    </svg>
  );
}
