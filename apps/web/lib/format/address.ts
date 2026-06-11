export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

type ShortAddressOptions = {
  head?: number;
  tail?: number;
  fallback?: string;
};

export function normalizeAddress(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

export function isSameAddress(left: string | null | undefined, right: string | null | undefined) {
  const normalizedLeft = normalizeAddress(left);
  const normalizedRight = normalizeAddress(right);

  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

export function isZeroAddress(value: string | null | undefined) {
  return normalizeAddress(value) === ZERO_ADDRESS;
}

export function isEvmAddress(value: string | null | undefined) {
  const trimmed = value?.trim();
  return Boolean(trimmed && /^0x[a-fA-F0-9]{40}$/.test(trimmed));
}

export function isConfiguredAddress(value: string | null | undefined) {
  return isEvmAddress(value) && !isZeroAddress(value);
}

export function shortAddress(value: string | null | undefined, options: ShortAddressOptions = {}) {
  const { head = 6, tail = 4, fallback = "N/A" } = options;
  const trimmed = value?.trim();

  if (!trimmed) {
    return fallback;
  }

  if (trimmed.includes("...") || trimmed.length <= head + tail + 3) {
    return trimmed;
  }

  return `${trimmed.slice(0, head)}...${trimmed.slice(-tail)}`;
}
