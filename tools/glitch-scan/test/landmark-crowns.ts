import { type LandmarkFrame, isLandmarkFrame, planNearLandmark } from "../../../packages/engine/src/renderer/mapcity/landmarks";
import { type P2, pointInRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { MeshSink } from "../../../packages/engine/src/renderer/mesh-sink";
import type { OsmData } from "../../osm-import/src/osm.ts";
import { cityEntries } from "./landmark-towers";

/**
 * The crown of a landmark's outer walls drawn from its recipe against the surface model (G-841):
 * NMPT GUGiK 0.5 m, world y, the highest point in a band 3 m into the building from a point on an
 * outer wall's line, 1.5 m either side along it, every 3 m (the curator's probes, round 2 of
 * G-841). Left out: points within 3 m of the outline's convex corners (pinnacles) and 5 m of the
 * gate's turrets, and points whose band holds a roof's superstructure deeper in, over 0.8 m above
 * the wall's first 1.5 m (Zamek's north wing at x 862-868). The north wing's run from x 904 to 942
 * on its wall without OSM's jog (G-874).
 */
export const CROWN_SURFACE: Readonly<Record<string, readonly (readonly [number, number, number])[]>> = {
  // Zamek Lubelski: the west wing, the south wing (its SE corner to y 8.0), the north wing high to
  // x 855 and low past it, the east wall low.
  w48500136: [
    [841.9, 262.9, 7.8], [841.6, 259.9, 7.7], [841.4, 256.9, 7.7], [841.1, 253.9, 7.8], [840.8, 251.0, 7.7],
    [837.9, 222.7, 7.6], [837.6, 219.8, 7.7], [837.3, 216.8, 7.5], [837.0, 213.8, 7.3],
    [839.3, 209.6, 7.6], [842.3, 209.2, 7.8], [845.3, 208.9, 7.8], [848.2, 208.6, 7.8], [851.2, 208.2, 7.8], [854.2, 207.9, 7.8],
    [857.2, 207.6, 7.8], [860.2, 207.2, 7.8], [863.1, 206.9, 7.8], [866.1, 206.5, 7.8], [869.1, 206.2, 7.8], [872.1, 205.9, 7.8],
    [875.1, 205.5, 7.8], [878.0, 205.2, 7.8], [881.0, 204.8, 7.8], [886.9, 200.8, 8.0], [889.9, 200.5, 7.8], [892.9, 200.3, 7.8],
    [898.6, 202.8, 7.8], [901.6, 202.4, 7.8], [904.5, 202.1, 7.8], [907.5, 201.7, 7.8], [910.5, 201.3, 7.8], [913.5, 201.0, 7.7],
    [916.5, 200.6, 7.9], [919.4, 200.3, 7.8], [922.4, 199.9, 7.7], [925.4, 199.5, 7.8], [928.4, 199.2, 7.8], [931.4, 198.8, 7.9],
    [934.3, 198.5, 8.0], [937.3, 198.1, 8.0], [940.3, 197.8, 8.0], [944.7, 202.8, 8.0], [945.0, 205.8, 8.0], [945.4, 208.7, 8.1],
    [945.4, 237.6, 5.7], [945.8, 240.6, 5.8], [946.2, 243.5, 5.8], [946.6, 246.5, 5.8], [947.0, 249.5, 5.8], [943.5, 253.4, 5.8],
    [937.5, 254.1, 5.7], [934.6, 254.5, 5.7], [931.6, 254.9, 5.7], [928.6, 255.3, 5.7], [925.6, 255.7, 5.7], [922.7, 256.1, 5.7],
    [919.7, 256.5, 5.7], [916.7, 256.9, 5.7], [913.7, 257.3, 5.7], [910.7, 257.7, 5.7], [907.8, 258.0, 5.7],
    [902.6, 258.7, 6.0], [899.6, 259.0, 6.0], [896.6, 259.3, 5.7], [893.7, 259.7, 5.6], [890.7, 260.0, 5.4], [887.7, 260.3, 5.9],
    [884.7, 260.6, 5.7], [881.7, 260.9, 6.0], [878.7, 261.3, 6.0], [875.8, 261.6, 6.0], [872.8, 261.9, 6.1], [869.8, 262.2, 5.5],
    [860.8, 263.2, 6.0], [857.9, 263.5, 6.1], [854.9, 263.8, 7.7], [851.9, 264.2, 7.7], [848.9, 264.5, 7.3], [845.9, 264.8, 6.9],
  ],
};

/** How far the drawn crown may stand off the surface model, up or down: the measurement's spread. */
const OFF = 0.8;

/** How far round a point of the table the drawn crown is looked for, metres, within the outline. */
const REACH = 1.5;

/** The highest point of the sink's faces seen from above over each of `at`, -Infinity where none lies over it. */
export const topsOver = (sink: MeshSink, at: readonly P2[]): number[] => {
  const tops = at.map(() => -Infinity);
  const P = sink.positions;
  const I = sink.indices;
  for (let t = 0; t < I.length; t += 3) {
    const [a, b, c] = [I[t]! * 3, I[t + 1]! * 3, I[t + 2]! * 3];
    const ax = P[a]!, az = P[a + 2]!, bx = P[b]!, bz = P[b + 2]!, cx = P[c]!, cz = P[c + 2]!;
    const det = (bx - ax) * (cz - az) - (cx - ax) * (bz - az);
    // A wall seen edge-on from above: its top shows through the faces over it.
    if (Math.abs(det) < 1e-6) continue;
    const x0 = Math.min(ax, bx, cx), x1 = Math.max(ax, bx, cx), z0 = Math.min(az, bz, cz), z1 = Math.max(az, bz, cz);
    at.forEach((p, k) => {
      if (p.x < x0 || p.x > x1 || p.z < z0 || p.z > z1) return;
      const u = ((p.x - ax) * (cz - az) - (cx - ax) * (p.z - az)) / det;
      const v = ((bx - ax) * (p.z - az) - (p.x - ax) * (bz - az)) / det;
      if (u < -1e-9 || v < -1e-9 || u + v > 1 + 1e-9) return;
      const y = P[a + 1]! + u * (P[b + 1]! - P[a + 1]!) + v * (P[c + 1]! - P[a + 1]!);
      if (y > tops[k]!) tops[k] = y;
    });
  }
  return tops;
};

/** A drawn landmark for the check: its map id, place, outline and the near solid of its recipe. */
export interface CrownEntry {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly ring: readonly P2[];
  readonly sink: MeshSink;
}

/**
 * Each landmark of the table whose drawn crown stands over 0.8 m off NMPT's at a point of it: the
 * highest face over the outline within 1.5 m of the point against the table's y. One finding a
 * building, the points off counted.
 */
export const crownsOffSurface = (surface: typeof CROWN_SURFACE, entries: readonly CrownEntry[]): { readonly at: string; readonly what: string }[] =>
  entries.flatMap((e) => {
    const rows = surface[e.id.split("/")[0]!] ?? [];
    const off = rows.flatMap(([x, z, y]) => {
      const grid: P2[] = [];
      for (let dx = -REACH; dx <= REACH; dx += 0.25) for (let dz = -REACH; dz <= REACH; dz += 0.25) if (Math.hypot(dx, dz) <= REACH && pointInRing({ x: x + dx, z: z + dz }, e.ring)) grid.push({ x: x + dx, z: z + dz });
      const top = Math.max(...topsOver(e.sink, grid));
      return Math.abs(top - y) > OFF ? [`${x},${z} ${top.toFixed(1)}/${y}`] : [];
    });
    if (!off.length) return [];
    return [{ at: `${e.x.toFixed(0)},${e.z.toFixed(0)}`, what: `${e.id}: crown off NMPT at ${off.length} of ${rows.length} points (${off.slice(0, 3).join("; ")})` }];
  });

/** The check over the city: the table's landmarks drawn near from their recipes. */
export const cityCrownsOffSurface = (osm: OsmData): { readonly at: string; readonly what: string }[] => {
  const entries = cityEntries((id) => id.split("/")[0]! in CROWN_SURFACE, osm).flatMap((e): CrownEntry[] => {
    if (!isLandmarkFrame(e.frame)) return [];
    const sink = new MeshSink();
    planNearLandmark(sink, e.frame as LandmarkFrame);
    return [{ id: e.id, x: e.x, z: e.z, ring: e.ring, sink }];
  });
  return crownsOffSurface(CROWN_SURFACE, entries);
};
