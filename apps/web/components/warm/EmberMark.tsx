const PAPER = "#faf6f1";
const INK = "#292522";
const SIGNAL = "#ff3c00";

export function EmberMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      viewBox="48 48 304 304"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ width: size, height: size, display: "block" }}
    >
      <path d="M132 286V140Q132 88 172 78Q206 69 240 78Q280 88 280 140V286H226L214 258Q206 246 198 258L186 286Z" fill={INK} stroke={PAPER} strokeWidth="3" strokeLinejoin="round" />
      <path d="M151 274V144Q151 104 177 96Q206 87 235 96Q261 104 261 144V274H238L222 252Q206 230 190 252L174 274Z" fill="none" stroke={PAPER} strokeWidth="9" strokeLinejoin="round" />
      <rect x="197" y="219" width="18" height="18" fill={SIGNAL} />
    </svg>
  );
}