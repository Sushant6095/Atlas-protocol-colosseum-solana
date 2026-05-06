// Bounded LRU used by the realtime dedup gate (Phase 20 §4.2).
// Keeps the most-recent N event ids; any duplicate within the window
// is dropped silently. We do not need a full LRU library — a Map
// preserves insertion order and an eviction step on overflow gives us
// the right behaviour at near-zero overhead.

export class BoundedLru<K, V = true> {
  private readonly capacity: number;
  private readonly map = new Map<K, V>();

  constructor(capacity: number) {
    this.capacity = Math.max(1, capacity);
  }

  has(key: K): boolean {
    if (!this.map.has(key)) return false;
    // Touch — bump to most-recently-used.
    const v = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, v);
    return true;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      this.map.delete(key);
    } else if (this.map.size >= this.capacity) {
      const oldest = this.map.keys().next().value as K | undefined;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, value);
  }

  get size(): number {
    return this.map.size;
  }
}
