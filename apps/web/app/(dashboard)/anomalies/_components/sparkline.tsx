import { pointsToPolyline } from "../_lib/anomaly-helpers";

const ORANGE = "var(--wl-signal)";

export function Sparkline({ points }: { points: readonly number[] }) {
  const line = pointsToPolyline(points);
  const parts = line.split(" ");
  const first = parts[0] ?? "2,24";
  const last = parts[parts.length - 1] ?? "59,5";
  return (
    <svg
      role="img"
      aria-label="anomaly trend"
      viewBox="0 0 62 28"
      className="h-7 w-[62px]"
      fill="none"
    >
      <polyline
        points={line}
        style={{ stroke: "var(--wl-secondary)" }}
        strokeWidth="1.2"
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={`${first} ${last}`}
        stroke={ORANGE}
        strokeWidth="1.8"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={Number(last.split(",")[0])}
        cy={Number(last.split(",")[1])}
        r="1.8"
        fill={ORANGE}
      />
    </svg>
  );
}
