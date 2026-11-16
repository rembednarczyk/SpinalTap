import { type P2, pointInRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { clearedBuilding } from "../../../packages/sim/src/content/cleared-buildings";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";

/**
 * The roof's edge of a landmark's outer walls in the surface model (G-874): NMPT GUGiK 0.5 m, the
 * middle of the steepest 0.5 m drop (over 3 m) on a line across the wall, 6 m either side of it,
 * every 3 m along the outer walls of OSM's outline and 3 m clear of their corners. The walls to
 * the courtyard are not in the table.
 */
export const OUTLINE_SURFACE: Readonly<Record<string, readonly (readonly [number, number])[]>> = {
  // Zamek Lubelski: the west wing north to south, the south wing west to east, the east walls,
  // the north wing east to west.
  w48500136: [
    [841.2, 261.0], [841.7, 257.9], [840.4, 255.0], [840.9, 252.0], [840.1, 249.0], [835.7, 241.0], [835.7, 238.0], [835.4, 235.0],
    [837.0, 226.8], [837.0, 223.8], [837.2, 220.8], [836.1, 217.9], [836.6, 214.8],
    [841.3, 209.1], [844.3, 209.0], [847.3, 208.9], [850.2, 208.3], [853.2, 208.3], [856.2, 207.4], [859.2, 207.3], [862.2, 207.2],
    [865.1, 206.6], [868.0, 205.6], [871.0, 205.5], [874.1, 205.6], [877.1, 205.5], [880.0, 204.7], [885.9, 200.6], [888.9, 200.4],
    [891.9, 200.4], [900.6, 202.8], [903.6, 202.2], [906.5, 201.6], [909.5, 201.5], [912.5, 201.4], [915.4, 200.5], [918.4, 200.4],
    [921.4, 199.8], [924.4, 199.7], [927.4, 199.1], [930.4, 199.0], [933.4, 198.8], [936.3, 198.5], [939.3, 197.9],
    [944.9, 201.8], [944.9, 204.8], [945.7, 239.6], [946.1, 242.5], [946.5, 245.5], [946.7, 248.5],
    [938.1, 254.2], [935.2, 255.1], [932.2, 255.2], [929.3, 255.8], [926.3, 256.0], [923.3, 256.6], [920.3, 256.7], [917.3, 256.9],
    [914.4, 257.5], [911.4, 257.6], [908.4, 258.3], [900.7, 259.4], [897.7, 259.7], [894.7, 260.3], [891.7, 260.6], [888.7, 260.7],
    [885.8, 261.3], [882.8, 261.6], [879.8, 261.7], [876.8, 262.2], [873.9, 262.5], [870.8, 262.6], [867.9, 263.2], [864.9, 263.8],
    [861.9, 264.1], [858.9, 264.2], [855.9, 264.2], [853.0, 265.0], [850.0, 265.6],
  ],
};

/** How deep into the outline the roof's edge may lie, metres: the mapping's spread and NMPT's cell. */
const DEEP = 2;

/** How long a run of the table's points that deep has to be for a wall off its place, metres. */
const RUN = 10;

/** How far (x, z) lies from the ring's edges. */
const edgeDistance = (p: P2, ring: readonly P2[]): number =>
  Math.min(
    ...ring.map((a, i) => {
      const b = ring[(i + 1) % ring.length]!;
      const dx = b.x - a.x, dz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
      return Math.hypot(p.x - a.x - t * dx, p.z - a.z - t * dz);
    }),
  );

/** A landmark of the table with its outline as the game's data has it. */
export interface OutlineEntry {
  readonly id: string;
  readonly ring: readonly P2[];
}

/**
 * Each run of the table's points, in its order, whose roof edge lies over 2 m inside the
 * landmark's outline along at least 10 m: a wall of the outline standing off the building, over
 * what is the ground in front of it. One finding a run, at its middle point.
 */
export const outlinesOffSurface = (surface: typeof OUTLINE_SURFACE, entries: readonly OutlineEntry[]): { readonly at: string; readonly what: string }[] =>
  entries.flatMap((e) => {
    const rows = (surface[e.id] ?? []).map(([x, z]) => ({ x, z }));
    const deep = rows.map((p) => (pointInRing(p, e.ring) ? edgeDistance(p, e.ring) : 0));
    const found: { at: string; what: string }[] = [];
    for (let i = 0; i < rows.length; ) {
      let j = i;
      while (j < rows.length && deep[j]! > DEEP) j++;
      if (j > i) {
        const [a, b] = [rows[i]!, rows[j - 1]!];
        const span = Math.hypot(b.x - a.x, b.z - a.z);
        const mid = rows[(i + j - 1) >> 1]!;
        if (span >= RUN) found.push({ at: `${mid.x.toFixed(0)},${mid.z.toFixed(0)}`, what: `${e.id}: NMPT's roof edge up to ${Math.max(...deep.slice(i, j)).toFixed(1)} m inside the outline along ${span.toFixed(0)} m (${a.x},${a.z} to ${b.x},${b.z})` });
      }
      i = j > i ? j : i + 1;
    }
    return found;
  });

/** The check over the city: the table's landmarks with their outlines from the map's chunks. */
export const cityOutlinesOffSurface = (): { readonly at: string; readonly what: string }[] =>
  outlinesOffSurface(
    OUTLINE_SURFACE,
    MAP_CHUNKS.flatMap((c) => c.buildings.filter((b) => b.id in OUTLINE_SURFACE && !clearedBuilding(b))).map((b) => ({
      id: b.id,
      ring: Array.from({ length: b.outline.length / 2 }, (_, i) => ({ x: b.x + b.outline[2 * i]!, z: b.z + b.outline[2 * i + 1]! })),
    })),
  );
