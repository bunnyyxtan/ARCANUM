import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

const DEFAULT_DATABASE_URL = "postgresql://arcanum:arcanum@localhost:5432/arcanum";

export function createDb(databaseUrl = process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL) {
  const client = postgres(databaseUrl, { prepare: false });
  return drizzle(client, { schema });
}

export const db = createDb();

export type ArcanumDb = typeof db;
