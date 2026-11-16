/**
 * A store in a test worker's memory (ADR-0083 step 3): what one test made, the next one with the
 * same inputs takes. Least recently used out past a budget of bytes, counted over the typed arrays
 * a value holds of its own (a field's raster is the raster's, counted there).
 */

export interface Made<T> {
  readonly yields: readonly number[];
  readonly value: T;
}

export interface StoreStats {
  hits: number;
  misses: number;
  bytes: number;
  entries: number;
}

/** Bytes of the typed arrays among a value's own properties. */
export const bytesOf = (value: unknown): number => {
  if (value === null || typeof value !== "object") return 0;
  let n = 0;
  for (const v of Object.values(value)) if (ArrayBuffer.isView(v)) n += v.byteLength;
  return n;
};

export class MemoryStore<T> {
  private readonly map = new Map<string, { made: Made<T>; bytes: number }>();
  readonly stats: StoreStats = { hits: 0, misses: 0, bytes: 0, entries: 0 };

  constructor(private readonly budget: number) {}

  get(key: string): Made<T> | undefined {
    const e = this.map.get(key);
    if (!e) {
      this.stats.misses++;
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, e);
    this.stats.hits++;
    return e.made;
  }

  set(key: string, made: Made<T>): void {
    const old = this.map.get(key);
    if (old) this.stats.bytes -= old.bytes;
    this.map.delete(key);
    const bytes = bytesOf(made.value) + 8 * made.yields.length + 2 * key.length;
    if (bytes > this.budget) return;
    this.map.set(key, { made, bytes });
    this.stats.bytes += bytes;
    for (const [k, e] of this.map) {
      if (this.stats.bytes <= this.budget) break;
      this.map.delete(k);
      this.stats.bytes -= e.bytes;
    }
    this.stats.entries = this.map.size;
  }
}
