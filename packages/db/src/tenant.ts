export const FALLBACK_TENANT_ID = "00000000-0000-0000-0000-000000000001";

export function defaultTenantId() {
  const value = process.env.ARCANUM_TENANT_ID;

  if (!value) {
    return FALLBACK_TENANT_ID;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : FALLBACK_TENANT_ID;
}
