import type { PageState } from "@/lib/types";

export function normalizePageState(value: string | string[] | undefined): PageState {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (rawValue === "loading" || rawValue === "empty" || rawValue === "error") {
    return rawValue;
  }

  return "default";
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>> | undefined;

export async function getPageState(searchParams: SearchParams): Promise<PageState> {
  const params = await searchParams;

  return normalizePageState(params?.state);
}

export async function getStringParam(
  searchParams: SearchParams,
  key: string,
): Promise<string | undefined> {
  const params = await searchParams;
  const value = params?.[key];

  return Array.isArray(value) ? value[0] : value;
}
