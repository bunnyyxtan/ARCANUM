export function pointsToPolyline(points: readonly number[]) {
  if (points.length === 0) {
    return "2,24 59,5";
  }
  const step = points.length > 1 ? 57 / (points.length - 1) : 0;
  return points
    .map((value, index) => {
      const x = 2 + index * step;
      const y = Math.max(2, Math.min(26, 26 - value * 3));
      return `${x.toFixed(0)},${y.toFixed(0)}`;
    })
    .join(" ");
}
