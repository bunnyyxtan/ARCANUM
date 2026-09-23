import { afterEach, expect, it, vi } from "vitest";
import { TtlCache } from "./ttl-cache";

afterEach(() => vi.useRealTimers());

it("expires zero-valued entries, reclaims unused keys, and bounds distinct actors", () => {
  vi.useFakeTimers();
  const cache = new TtlCache<number>(2, 30_000);
  cache.set("tenant:a", 0);
  cache.set("tenant:b", 90);
  expect(cache.get("tenant:a")).toBe(0);
  cache.set("other:a", 42);
  expect(cache.size).toBe(2);
  expect(cache.get("tenant:a")).toBeUndefined();
  expect(cache.get("tenant:b")).toBe(90);
  expect(cache.get("other:a")).toBe(42);
  vi.advanceTimersByTime(30_000);
  expect(cache.get("other:a")).toBeUndefined();
  expect(cache.size).toBe(0);
});

it("replacement does not evict another live scope", () => {
  const cache = new TtlCache<number>(2, 30_000);
  cache.set("one", 1);
  cache.set("two", 2);
  cache.set("one", 3);
  expect(cache.get("two")).toBe(2);
  expect(cache.get("one")).toBe(3);
});
