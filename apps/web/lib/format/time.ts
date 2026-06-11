export type DateInput = Date | number | string | null | undefined;

export type CountdownState = {
  isExpired: boolean;
  isMissing: boolean;
  isSoon: boolean;
  label: string;
};

export function parseDateInput(value: DateInput) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatTimestampOrNA(value: DateInput) {
  const date = parseDateInput(value);
  return date ? date.toISOString().replace(".000", "") : "N/A";
}

export function toIsoTimestamp(value: DateInput) {
  return parseDateInput(value)?.toISOString() ?? null;
}

export function getCountdownState(value: DateInput, now?: number): CountdownState {
  const date = parseDateInput(value);

  if (!date) {
    return { isExpired: false, isMissing: true, isSoon: false, label: "NO EXPIRY" };
  }

  if (now === undefined) {
    return { isExpired: false, isMissing: false, isSoon: false, label: "--:--:--" };
  }

  const remaining = date.getTime() - now;
  if (remaining <= 0) {
    return { isExpired: true, isMissing: false, isSoon: false, label: "EXPIRED" };
  }

  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1_000);
  const time = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return {
    isExpired: false,
    isMissing: false,
    isSoon: remaining <= 5 * 60_000,
    label: days > 0 ? `${String(days).padStart(2, "0")}d ${time}` : time,
  };
}
