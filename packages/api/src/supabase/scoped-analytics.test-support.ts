import { SupabaseRpcError } from "./client";

/** Explicit pre-migration capability fixture, never a successful empty RPC. */
export async function oldSchemaAnalyticsRpc(
  fn: string,
  args: Record<string, unknown>,
): Promise<never> {
  throw new SupabaseRpcError(
    fn,
    404,
    "PGRST202",
    `Could not find the function public.${fn}(${Object.keys(args).sort().join(", ")}) in the schema cache`,
  );
}
