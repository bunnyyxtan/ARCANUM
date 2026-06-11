export function normalizeSearch(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export function matchesSearch(query: string, values: readonly unknown[]) {
  if (!query) {
    return true;
  }

  return values
    .filter((value) => value !== null && value !== undefined)
    .some((value) => String(value).toLowerCase().includes(query));
}
