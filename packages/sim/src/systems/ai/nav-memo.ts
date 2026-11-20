/**
 * The memo of the steering's rasters and the distance fields grown on them (ADR-0025), one per
 * world and window. A pure cache: a miss makes what a hit would have given.
 */
export interface NavMemo<R, F extends { readonly raster: R }> {
  readonly rasters: Map<string, R>;
  /** Keyed by their raster's key and the source cell: `${rasterKey}|${source}`. */
  readonly fields: Map<string, F>;
  /** Rasters made and fields grown so far, and the cells they went through: what the misses cost. */
  readonly built: { rasters: number; fields: number; units: number };
}

/** Least recently used out once the map is full (Map keeps insertion order). */
export const remember = <T>(map: Map<string, T>, key: string, value: T, max: number): T => {
  map.delete(key);
  map.set(key, value);
  while (map.size > max) {
    const first = map.keys().next();
    if (first.done) break;
    map.delete(first.value);
  }
  return value;
};

export const recall = <T>(map: Map<string, T>, key: string): T | undefined => {
  const v = map.get(key);
  if (v !== undefined) {
    map.delete(key);
    map.set(key, v);
  }
  return v;
};

/**
 * A raster out of the memo that a remembered field still holds (G-644): the fields outnumber the
 * rasters, and a dozen gangers after a dozen leads, each asking every step, pushed the rasters out
 * in turn and made them again every step (some 20 ms each) to find the field they had. It is kept
 * anyway, so this costs no memory.
 */
export const heldRaster = <R, F extends { readonly raster: R }>(fields: ReadonlyMap<string, F>, rasterKey: string): R | undefined => {
  const prefix = `${rasterKey}|`;
  for (const [key, field] of fields) if (key.startsWith(prefix)) return field.raster;
  return undefined;
};

/*
 * Work made in slices (`Slices` in `nav-raster.ts`) kept with the reports it gave: the process's
 * shared store (`nav-share.ts`) and a ground's terrain passes (`terrainLayer`) hand them back on a
 * hit, so the slices spread over the steps stay what they were without the store.
 */

/** What making a raster or growing a field gave: the units of work it reported, in order, and the result. */
export interface Made<T> {
  readonly yields: readonly number[];
  readonly value: T;
}

export interface NavShareStore<T> {
  get(key: string): Made<T> | undefined;
  set(key: string, made: Made<T>): void;
}

/** Runs `steps`, passing on its reports, and gives them with the result. */
export function* recorded<T>(steps: Generator<number, T, void>, yields: number[]): Generator<number, T, void> {
  for (;;) {
    const s = steps.next();
    if (s.done) return s.value;
    yields.push(s.value);
    yield s.value;
  }
}

/** The reports of a making done before, then its result: no work. */
export function* replayed<T>(made: Made<T>): Generator<number, T, void> {
  for (const u of made.yields) yield u;
  return made.value;
}

/** Through a store: the made value when it has one under `key`, else `make` run and kept. */
export function* through<T>(store: NavShareStore<T> | undefined, key: string, make: () => Generator<number, T, void>): Generator<number, T, void> {
  if (!store) return yield* make();
  const had = store.get(key);
  if (had) return yield* replayed(had);
  const yields: number[] = [];
  const value = yield* recorded(make(), yields);
  store.set(key, { yields, value });
  return value;
}
