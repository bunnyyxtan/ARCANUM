/** Small bounded TTL cache; reads and writes opportunistically reclaim expiry. */
export class TtlCache<T> {
  private readonly entries = new Map<string, { value: T; expiresAt: number }>();

  constructor(
    private readonly capacity: number,
    private readonly ttlMs: number,
  ) {
    if (!Number.isInteger(capacity) || capacity < 1 || ttlMs <= 0) {
      throw new Error("TTL cache requires positive capacity and TTL.");
    }
  }

  private prune(now: number) {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
  }

  get(key: string): T | undefined {
    this.prune(Date.now());
    return this.entries.get(key)?.value;
  }

  set(key: string, value: T) {
    const now = Date.now();
    this.prune(now);
    this.entries.delete(key);
    while (this.entries.size >= this.capacity) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { value, expiresAt: now + this.ttlMs });
  }

  get size() {
    this.prune(Date.now());
    return this.entries.size;
  }
}
