/** Strict browser same-origin protection, including nonce issuance. No missing-Origin bypass. */
export function isSameOriginAuthRequest(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = request.headers.get("origin");
  if (!origin || origin === "null") return false;
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
