const PAPER = "#faf6f1";
const INK = "#292522";
const SIGNAL = "#ff3c00";

/**
 * Shared ARCANUM Ember asset.
 *
 * Geometry is intentionally copied as the locked mark's single source of
 * truth: rounded ink keep, baked paper lining, downward 40° opening, feet,
 * and the 18u square core below center. No ground-aware recoloring occurs.
 *
 * Construction: shell 148u × 208u; back 28u; lining 9u; feet taper 28→20u;
 * core 18u centered at x206 / y228 in the 304u viewBox. oneColor preserves
 * the same geometry while reducing the baked lining and core to ink.
 */
const SHELL = "M132 286V140Q132 88 172 78Q206 69 240 78Q280 88 280 140V286H226L214 258Q206 246 198 258L186 286Z";
const LINING = "M151 274V144Q151 104 177 96Q206 87 235 96Q261 104 261 144V274H238L222 252Q206 230 190 252L174 274Z";

export type EmberMarkProps = {
  size: number;
  oneColor?: boolean;
};

export default function EmberMark({ size, oneColor = false }: EmberMarkProps) {
  return (
    <svg
      viewBox="48 48 304 304"
      width={size}
      height={size}
      role="img"
      aria-label="The Ember mark"
      style={{ width: size, height: size, display: "block" }}
    >
      <path d={SHELL} fill={INK} stroke={PAPER} strokeWidth="3" strokeLinejoin="round" />
      <path d={LINING} fill="none" stroke={oneColor ? INK : PAPER} strokeWidth="9" strokeLinejoin="round" />
      <rect x="197" y="219" width="18" height="18" fill={oneColor ? INK : SIGNAL} />
    </svg>
  );
}