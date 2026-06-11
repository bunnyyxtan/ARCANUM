import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl, { prepare: false });
  return drizzle(client, { schema });
}

export type ArcanumDb = ReturnType<typeof createDb>;

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
