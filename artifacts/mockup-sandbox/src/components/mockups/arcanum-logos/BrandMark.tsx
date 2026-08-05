import type { CSSProperties } from "react";

export const BRAND_PAPER = "#faf6f1";
export const BRAND_INK = "#292522";
export const BRAND_SIGNAL = "#ff3c00";

/**
 * Extracted directly from TheArchwayCoin.tsx.
 * Geometry is intentionally untouched: 240px rounded-square coin and the
 * original 4:5 NEGATIVE_ARCH path, including the 2px-high signal datum.
 */
const NEGATIVE_ARCH =
  "M116 86 Q116 84 118 84 H282 Q284 84 284 86 V296 Q284 298 282 298 H238 V220 C238 190 222 174 200 174 C178 174 162 190 162 220 V298 H118 Q116 298 116 296 Z";

export function ArchwayCoin({
  size = 240,
  coin = BRAND_INK,
  paper = BRAND_PAPER,
  signal = BRAND_SIGNAL,
  className,
  style,
}: {
  size?: number;
  coin?: string;
  paper?: string;
  signal?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="56 56 288 288"
      role="img"
      aria-label="Arcanum archway coin"
      className={className}
      style={{ display: "block", ...style }}
    >
      <rect x="80" y="80" width="240" height="240" rx="42" fill={coin} />
      <path d={NEGATIVE_ARCH} fill={paper} />
      <circle cx="200" cy="196" r="7" fill={signal} />
    </svg>
  );
}

export function ArchwayCoinReversed({ size = 240 }: { size?: number }) {
  return <ArchwayCoin size={size} coin={BRAND_PAPER} paper={BRAND_INK} />;
}