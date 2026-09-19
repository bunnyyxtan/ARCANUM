// Server-only: node:crypto and service-role credentials must never enter a client bundle.
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import {
  type ArcanumSession,
  type AuthSessionData,
  SESSION_TTL_MS,
  isCurrentSession,
} from "./index";

const rowSchema = z.object({
  session_hash: z.string().regex(/^[a-f0-9]{64}$/),
  wallet_address: z.string().min(1),
  tenant_id: z.string().min(1),
  role: z.enum(["owner", "council", "signer", "viewer"]),
  expires_at: z.string().datetime({ offset: true }),
  revoked_at: z.string().nullable(),
});
type SessionRow = z.infer<typeof rowSchema>;
const localRows = new Map<string, SessionRow>();
const localRevokedBefore = new Map<string, number>();

export class SessionStoreUnavailableError extends Error {
  constructor() {
    super("Session service unavailable. Please retry shortly.");
    this.name = "SessionStoreUnavailableError";
  }
}

/** Read-only migration/config canary; verifies all required PostgREST columns. */
export async function assertSessionStoreReady(): Promise<void> {
  await store("GET", { session_hash: "0".repeat(64) });
}

function hashId(id: string) {
  return createHash("sha256").update(id).digest("hex");
}

function validId(id: unknown): id is string {
  return typeof id === "string" && /^[a-f0-9]{64}$/.test(id);
}

async function store(
  method: "GET" | "POST" | "PATCH",
  filters: Record<string, string>,
  body?: SessionRow | { revoked_at: string },
  revokeAll = false,
): Promise<SessionRow[]> {
  // This is a deliberate ephemeral local-test mode, never an outage fallback.
  if (process.env.ARCANUM_SESSION_STORE_MODE === "local-test") {
    if (process.env.NODE_ENV !== "test" && process.env.NODE_ENV !== "development") {
      throw new SessionStoreUnavailableError();
    }
    if (method === "POST") {
      const row = rowSchema.parse(body);
      const scope = JSON.stringify([row.tenant_id, row.wallet_address]);
      if (
        Date.parse(row.expires_at) - SESSION_TTL_MS <=
        (localRevokedBefore.get(scope) ?? Number.NEGATIVE_INFINITY)
      ) {
        throw new SessionStoreUnavailableError();
      }
      // Mirror the production bounded prune; local-test is never a fallback.
      const expired = [...localRows.values()]
        .filter((entry) => Date.parse(entry.expires_at) <= Date.now())
        .slice(0, 100);
      for (const entry of expired) localRows.delete(entry.session_hash);
      localRows.set(row.session_hash, { ...row });
      return [row];
    }
    if (revokeAll) {
      const sessionHash = filters.session_hash;
      if (!sessionHash) return [];
      const caller = localRows.get(sessionHash);
      if (
        !caller ||
        caller.revoked_at ||
        Date.parse(caller.expires_at) <= Date.now() ||
        caller.wallet_address !== filters.wallet_address ||
        caller.tenant_id !== filters.tenant_id
      )
        return [];
      const now = Date.now();
      localRevokedBefore.set(JSON.stringify([caller.tenant_id, caller.wallet_address]), now);
      const rows = [...localRows.values()].filter(
        (row) => row.tenant_id === caller.tenant_id && row.wallet_address === caller.wallet_address,
      );
      for (const row of rows) row.revoked_at = new Date(now).toISOString();
      return rows.map((row) => ({ ...row }));
    }
    const rows = [...localRows.values()].filter((row) =>
      Object.entries(filters).every(([key, value]) => row[key as keyof SessionRow] === value),
    );
    if (method === "PATCH") {
      for (const row of rows) Object.assign(row, body);
    }
    return rows.map((row) => ({ ...row }));
  }
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (
    !url ||
    !key ||
    (process.env.ARCANUM_SESSION_STORE_MODE &&
      process.env.ARCANUM_SESSION_STORE_MODE !== "supabase")
  ) {
    throw new SessionStoreUnavailableError();
  }
  try {
    const rpc =
      method === "POST" ? "create_auth_session" : revokeAll ? "revoke_all_auth_sessions" : null;
    const endpoint = new URL(
      `${url.replace(/\/+$/, "")}/rest/v1/${rpc ? `rpc/${rpc}` : "auth_sessions"}`,
    );
    endpoint.searchParams.set(
      "select",
      "session_hash,wallet_address,tenant_id,role,expires_at,revoked_at",
    );
    if (!rpc) {
      for (const [name, value] of Object.entries(filters))
        endpoint.searchParams.set(name, `eq.${value}`);
    }
    const payload =
      method === "POST"
        ? {
            p_session_hash: (body as SessionRow).session_hash,
            p_wallet_address: (body as SessionRow).wallet_address,
            p_tenant_id: (body as SessionRow).tenant_id,
            p_role: (body as SessionRow).role,
            p_expires_at: (body as SessionRow).expires_at,
          }
        : revokeAll
          ? {
              p_session_hash: filters.session_hash,
              p_wallet_address: filters.wallet_address,
              p_tenant_id: filters.tenant_id,
            }
          : body;
    const response = await fetch(endpoint, {
      method: rpc ? "POST" : method,
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: payload ? JSON.stringify(payload) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new SessionStoreUnavailableError();
    return z.array(rowSchema).parse(await response.json());
  } catch {
    // Do not leak service-role details or treat an unavailable store as anonymous.
    throw new SessionStoreUnavailableError();
  }
}

export async function createTrackedSession(user: ArcanumSession): Promise<string> {
  if (!isCurrentSession(user) || user.expiresAt > Date.now() + SESSION_TTL_MS) {
    throw new Error("Invalid session lifetime");
  }
  const id = randomBytes(32).toString("hex");
  const row: SessionRow = {
    session_hash: hashId(id),
    wallet_address: user.walletAddress.toLowerCase(),
    tenant_id: user.tenantId,
    role: user.role,
    expires_at: new Date(user.expiresAt).toISOString(),
    revoked_at: null,
  };
  const saved = await store("POST", {}, row);
  if (saved.length !== 1 || saved[0]?.session_hash !== row.session_hash) {
    throw new SessionStoreUnavailableError();
  }
  return id;
}

/**
 * Old cookies deliberately fail: expiry alone cannot prove a session is tracked.
 * No positive cache: a copied cookie stops authorizing once revocation completes.
 */
export async function validateSession(
  session: AuthSessionData,
  expectedTenantId?: string,
): Promise<ArcanumSession | null> {
  const { user, sessionId } = session;
  if (!isCurrentSession(user) || !validId(sessionId)) return null;
  if (expectedTenantId !== undefined && user.tenantId !== expectedTenantId) return null;
  const rows = await store("GET", { session_hash: hashId(sessionId) });
  const row = rows[0];
  if (
    rows.length !== 1 ||
    !row ||
    row.revoked_at !== null ||
    row.session_hash !== hashId(sessionId) ||
    row.wallet_address !== user.walletAddress.toLowerCase() ||
    row.tenant_id !== user.tenantId ||
    row.role !== user.role ||
    Date.parse(row.expires_at) !== user.expiresAt ||
    Date.parse(row.expires_at) <= Date.now()
  )
    return null;
  return user;
}

/** Idempotent, including already revoked/expired cookies; outages still throw. */
export async function revokeSession(session: AuthSessionData): Promise<void> {
  if (!validId(session.sessionId)) return;
  await store(
    "PATCH",
    { session_hash: hashId(session.sessionId) },
    { revoked_at: new Date().toISOString() },
  );
}

/** Only a live tracked session can revoke this wallet's sessions in this tenant. */
export async function revokeAllSessions(
  session: AuthSessionData,
  expectedTenantId?: string,
): Promise<boolean> {
  const sessionId = session.sessionId;
  if (!validId(sessionId)) return false;
  const user = await validateSession({ ...session, sessionId }, expectedTenantId);
  if (!user) return false;
  const revoked = await store(
    "PATCH",
    {
      session_hash: hashId(sessionId),
      wallet_address: user.walletAddress.toLowerCase(),
      tenant_id: user.tenantId,
    },
    undefined,
    true,
  );
  return revoked.length > 0;
}
