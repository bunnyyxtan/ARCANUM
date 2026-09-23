/**
 * Whether a session may still be issued when no identity record was written.
 *
 * Only explicitly selected local-test mode may omit identity provisioning.
 * Production always needs the real identity store AND tracked session store.
 * ARCANUM_ALLOW_UNBACKED_SESSIONS no longer permits production sign-in.
 */
export function identitySyncOptional(reason: "unconfigured" | "unavailable") {
  return (
    (process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development") &&
    process.env.ARCANUM_SESSION_STORE_MODE === "local-test" &&
    reason === "unconfigured"
  );
}
