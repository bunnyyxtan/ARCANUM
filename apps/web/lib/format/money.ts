type NumericInput = bigint | number | string | null | undefined;

function toFiniteNumber(value: NumericInput) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const raw = typeof value === "bigint" ? Number(value) : Number(value);
  return Number.isFinite(raw) ? raw : 0;
}

export function usdcNumber(amount: NumericInput) {
  return toFiniteNumber(amount) / 1_000_000;
}

export function formatInteger(value: NumericInput) {
  return toFiniteNumber(value).toLocaleString("en-US");
}

export function formatUsd(value: NumericInput, decimals = 2) {
  return toFiniteNumber(value).toLocaleString("en-US", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
    style: "currency",
    currency: "USD",
  });
}

export function formatUsdCompact(value: NumericInput) {
  const amount = toFiniteNumber(value);

  return `$${amount.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: amount < 100 ? 2 : 0,
  })}`;
}

export function formatUSDCFromBaseUnits(amount: NumericInput) {
  return formatUsdCompact(usdcNumber(amount));
}
