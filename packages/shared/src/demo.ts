export const DEFAULT_ARCANUM_DEMO_OWNER_WALLET =
  "0x70b474010e1bf0c4a087a3eadeb157ea515872f6";

export type ArcanumWorkspaceMode =
  | "disconnected"
  | "connected_unsigned"
  | "demo"
  | "live_empty"
  | "live_indexed";

export function normalizeWalletAddress(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

export function resolveDemoOwnerWallet(value?: string | null) {
  return normalizeWalletAddress(value) ?? DEFAULT_ARCANUM_DEMO_OWNER_WALLET;
}

export function isDemoOwnerWallet(address: string | null | undefined, configured?: string | null) {
  const normalized = normalizeWalletAddress(address);
  return Boolean(normalized && normalized === resolveDemoOwnerWallet(configured));
}
