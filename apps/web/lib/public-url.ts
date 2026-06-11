export const CANONICAL_PUBLIC_ORIGIN = "https://thearcanum.in";

export function configuredPublicOrigin() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? CANONICAL_PUBLIC_ORIGIN).replace(/\/+$/, "");
}
