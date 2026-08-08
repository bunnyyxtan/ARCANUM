export type ArcanumWorkspaceMode =
  | "disconnected"
  | "connected_unsigned"
  | "live_empty"
  | "live_indexed";

export function normalizeWalletAddress(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}
