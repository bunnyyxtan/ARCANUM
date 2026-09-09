import { TRPCError } from "@trpc/server";

/**
 * User-facing message for a read-model outage. Deliberately explicit that this
 * is an availability failure, never the same thing as "no activity yet".
 */
export const READ_MODEL_UNAVAILABLE_MESSAGE =
  "The live data service is unavailable, so recent activity cannot be shown right now. This is an outage, not an empty history. Try again shortly.";

/**
 * Read-model failures fail closed (mirrors the vendor-flags review register):
 * a Supabase problem must surface as an error the UI can distinguish from an
 * empty result, never as a believable empty array.
 */
export function readModelUnavailable(label: string, error: unknown): TRPCError {
  warnSupabase(label, error);
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: READ_MODEL_UNAVAILABLE_MESSAGE,
    cause: error,
  });
}

export type SupabaseRow = Record<string, unknown>;

export type SupabaseRequestOptions = {
  filters?: Record<string, string | number | boolean | null | undefined>;
  inFilters?: Record<string, string[]>;
  limit?: number;
  order?: string;
  // Do not project mapped tables while their mappers tolerate legacy names.
  // PostgREST rejects a projection when any named legacy column is absent.
  select?: string;
  before?: { createdAt: string; id: string };
};

export type SupabaseWriteResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "unconfigured" | "unavailable" | "forbidden"; message: string };

/**
 * A PostgREST call that came back with a non-2xx status. Carries the status so
 * callers can tell a unique-key conflict (409) from an outage without parsing
 * the message.
 */
export class SupabaseRequestError extends Error {
  readonly status: number;
  readonly table: string;

  constructor(table: string, method: string, status: number, detail: string) {
    super(`${table} ${method} failed with ${status}: ${detail}`);
    this.name = "SupabaseRequestError";
    this.status = status;
    this.table = table;
  }
}

export type SupabaseServiceRoleClient = {
  configured: boolean;
  selectRows: (table: string, options?: SupabaseRequestOptions) => Promise<SupabaseRow[]>;
  // Plain insert: a duplicate key is reported as a 409 SupabaseRequestError
  // instead of silently merging into the existing row.
  insertRows: (table: string, rows: SupabaseRow[]) => Promise<SupabaseRow[]>;
  upsertRows: (table: string, rows: SupabaseRow[], onConflict?: string) => Promise<SupabaseRow[]>;
  patchRows: (
    table: string,
    patch: SupabaseRow,
    filters: Record<string, string | number | boolean>,
  ) => Promise<SupabaseRow[]>;
  // Postgres functions are how a write that must not tear -- a state change and
  // its audit event -- stays atomic: the REST tables have no transactions.
  callFunction: (fn: string, args: Record<string, unknown>) => Promise<unknown>;
};

const warningLabels = new Set<string>();

// Service-role access belongs only in server/API code. Never import this helper from client components.
export function createSupabaseServiceRoleClient(): SupabaseServiceRoleClient | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    warnSupabase("service-role.env", "Supabase service-role env is not configured.");
    return null;
  }

  const baseUrl = url.replace(/\/+$/, "");
  const adminKey = serviceRoleKey;

  async function request(
    method: "GET" | "POST" | "PATCH",
    table: string,
    options?: SupabaseRequestOptions & {
      body?: SupabaseRow | SupabaseRow[];
      onConflict?: string;
      resolution?: "merge-duplicates" | "none";
    },
  ) {
    const endpoint = new URL(`${baseUrl}/rest/v1/${table}`);
    endpoint.searchParams.set("select", options?.select ?? "*");

    if (options?.order) {
      endpoint.searchParams.set("order", options.order);
    }

    if (options?.limit) {
      endpoint.searchParams.set("limit", String(options.limit));
    }

    for (const [key, value] of Object.entries(options?.filters ?? {})) {
      if (value !== undefined && value !== null && value !== "") {
        endpoint.searchParams.set(key, `eq.${String(value)}`);
      }
    }

    for (const [key, values] of Object.entries(options?.inFilters ?? {})) {
      if (values.length > 0) {
        endpoint.searchParams.set(key, `in.(${values.join(",")})`);
      }
    }

    if (options?.before) {
      endpoint.searchParams.set(
        "or",
        `(created_at.lt.${options.before.createdAt},and(created_at.eq.${options.before.createdAt},id.lt.${options.before.id}))`,
      );
    }

    if (options?.onConflict) {
      endpoint.searchParams.set("on_conflict", options.onConflict);
    }

    const response = await fetch(endpoint, {
      method,
      headers: {
        apikey: adminKey,
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
        Prefer:
          method === "GET" || options?.resolution === "none"
            ? "return=representation"
            : "return=representation,resolution=merge-duplicates",
      },
      body: options?.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new SupabaseRequestError(table, method, response.status, safeSupabaseError(body));
    }

    return (await response.json()) as SupabaseRow[];
  }

  async function callFunction(fn: string, args: Record<string, unknown>) {
    const response = await fetch(`${baseUrl}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        apikey: adminKey,
        Authorization: `Bearer ${adminKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      cache: "no-store",
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`rpc ${fn} failed with ${response.status}: ${safeSupabaseError(body)}`);
    }

    const body = await response.text();
    return body ? (JSON.parse(body) as unknown) : null;
  }

  return {
    configured: true,
    selectRows: (table, options) => request("GET", table, options),
    insertRows: (table, rows) => request("POST", table, { body: rows, resolution: "none" }),
    upsertRows: (table, rows, onConflict) => request("POST", table, { body: rows, onConflict }),
    patchRows: (table, patch, filters) => request("PATCH", table, { body: patch, filters }),
    callFunction,
  };
}

export function warnSupabase(label: string, error: unknown) {
  if (warningLabels.has(label)) {
    return;
  }

  warningLabels.add(label);
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[arcanum-supabase] ${label}: ${safeSupabaseError(message)}`);
}

export function safeSupabaseError(message: string) {
  return message
    .replaceAll(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "__never__", "[redacted]")
    .replaceAll(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "__never__", "[redacted]");
}

export function unconfiguredWrite<T>(label: string): SupabaseWriteResult<T> {
  return {
    ok: false,
    reason: "unconfigured",
    message: `Supabase service role is not configured; ${label} cannot be saved to the live read model.`,
  };
}

export function unavailableWrite<T>(label: string, error: unknown): SupabaseWriteResult<T> {
  warnSupabase(`${label}.write-unavailable`, error);
  return {
    ok: false,
    reason: "unavailable",
    message: `Supabase ${label} write failed; save the onchain address and retry sync.`,
  };
}
