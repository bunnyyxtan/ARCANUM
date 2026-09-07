import type { ApiContext } from "../context";
import { type SupabaseRequestOptions, readModelUnavailable } from "./client";

export async function selectRows(ctx: ApiContext, table: string, options?: SupabaseRequestOptions) {
  const client = ctx.supabase;
  if (!client) {
    // A missing configuration must never look like "no rows": for a product
    // whose promise is showing what an agent spent, a calm empty dashboard on
    // top of a broken read model is worse than an error.
    throw readModelUnavailable(
      `${table}.read`,
      new Error(
        "Supabase read model is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
      ),
    );
  }

  try {
    return await client.selectRows(table, options);
  } catch (error) {
    throw readModelUnavailable(`${table}.read`, error);
  }
}
