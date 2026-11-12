/**
 * A memo of limited size that drops the least recently used entry first. A `Map` keeps its
 * keys in insertion order, so a hit moves its entry to the end (delete and set again) and the
 * first key is always the one used longest ago. Meant for memos of pure results: what it
 * drops only costs the time to compute it again, never a different answer.
 */
export class LruMap<K, V> {
  private readonly entries = new Map<K, V>();

  constructor(readonly limit: number) {
    if (!(limit >= 1)) throw new Error(`LruMap limit must be at least 1, got ${limit}`);
  }

  get size(): number {
    return this.entries.size;
  }

  has(key: K): boolean {
    return this.entries.has(key);
  }

  /** The value under `key`, which becomes the most recently used; `undefined` on a miss. */
  get(key: K): V | undefined {
    const value = this.entries.get(key);
    if (value === undefined && !this.entries.has(key)) return undefined;
    this.entries.delete(key);
    // Present under the key, so `value` is a V even when V itself allows `undefined`.
    this.entries.set(key, value as V);
    return value;
  }

  /** Stores `value` as the most recently used and drops the oldest entries over the limit. */
  set(key: K, value: V): this {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.limit) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
    return this;
  }

  delete(key: K): boolean {
    return this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  /** Keys from the least to the most recently used. */
  keys(): IterableIterator<K> {
    return this.entries.keys();
  }
}
