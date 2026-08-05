import type { CSSProperties } from "react";
import { ArchwayCoinMark } from "./ArchwayCoinMark";

export const BRAND_PAPER = "#faf6f1";
export const BRAND_INK = "#292522";
export const BRAND_SIGNAL = "#ff3c00";

/**
 * Extracted directly from TheArchwayCoin.tsx.
 * Geometry is intentionally untouched: 240px rounded-square coin and the
 * original 4:5 NEGATIVE_ARCH path, including the 2px-high signal datum.
 * The master is self-contained: the paper arch is opaque, so this exact mark
 * is identical on every surface.
 */
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
  void coin;
  void paper;
  void signal;
  return <ArchwayCoinMark size={size} className={className} style={style} title="Arcanum archway coin" />;
}

export function ArchwayCoinReversed({ size = 240 }: { size?: number }) {
  return <ArchwayCoin size={size} />;
}