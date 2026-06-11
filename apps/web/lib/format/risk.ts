export function formatDeviation(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "N/A";
  }

  const raw =
    typeof value === "number"
      ? value.toFixed(1)
      : value
          .replace(/sigma/gi, "")
          .replace(/deviation/gi, "")
          .trim();

  return raw ? `${raw} deviation` : "N/A";
}
