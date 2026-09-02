import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl, { prepare: false });
  return drizzle(client, { schema });
}

export type ArcanumDb = ReturnType<typeof createDb>;

/**
 * Whether this runtime has a direct Postgres connection at all.
 *
 * Deployed environments read from Supabase and deliberately run without
 * `DATABASE_URL`, so callers that need the local tables must branch on
 * configuration explicitly. Discovering it by catching the proxy's error
 * cannot distinguish "not configured here" from "configured but broken",
 * and security decisions must never be made on that ambiguity.
 */
export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function createUnavailableDb(): ArcanumDb {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(
          "Direct Postgres is not configured for this runtime; use Supabase read-model helpers.",
        );
      },
    },
  ) as ArcanumDb;
}

export const db: ArcanumDb = process.env.DATABASE_URL
  ? createDb(process.env.DATABASE_URL)
  : createUnavailableDb();
