/**
 * Whether a session may still be issued when no identity record was written.
 *
 * Local development runs without Supabase at all, and requiring it there would
 * make sign-in impossible on a fresh checkout. A deployment is different: with
 * no direct user database either, missing service-role credentials mean the
 * cookie would be the only thing that exists about this user - no profile, no
 * workspace, no membership - which is exactly the fail-open shape this route is
 * meant to close. Set ARCANUM_ALLOW_UNBACKED_SESSIONS=true only to run a
 * deliberately storage-less deployment.
 */
export function identitySyncOptional(reason: "unconfigured" | "unavailable") {
  if (process.env.NODE_ENV === "production") {
    return process.env.ARCANUM_ALLOW_UNBACKED_SESSIONS === "true";
  }

  return reason === "unconfigured";
}
