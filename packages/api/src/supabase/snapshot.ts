import type { ApiContext } from "../context";

// Coalesce overlapping reads only. Entries disappear on settlement, so a
// subsequent mutation/read never reuses stale authorization or wallet state.
// Weak keys cannot retain completed HTTP request contexts.
const pending = new WeakMap<ApiContext, Map<string, Promise<unknown>>>();

export function sharedRead<T>(ctx: ApiContext, key: string, read: () => Promise<T>): Promise<T> {
  let reads = pending.get(ctx);
  if (!reads) {
    reads = new Map();
    pending.set(ctx, reads);
  }
  const existing = reads.get(key);
  if (existing) return existing as Promise<T>;
  const result = read().finally(() => reads.delete(key));
  reads.set(key, result);
  return result;
}
