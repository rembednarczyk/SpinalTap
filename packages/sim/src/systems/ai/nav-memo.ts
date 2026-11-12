/**
 * The memo of the steering's rasters and the distance fields grown on them (ADR-0025), one per
 * world and window. A pure cache: a miss makes what a hit would have given.
 */
export interface NavMemo<R, F extends { readonly raster: R }> {
  readonly rasters: Map<string, R>;
  /** Keyed by their raster's key and the source cell: `${rasterKey}|${source}`. */
  readonly fields: Map<string, F>;
  /** Rasters made and fields grown so far: what the misses cost. */
  readonly built: { rasters: number; fields: number };
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
