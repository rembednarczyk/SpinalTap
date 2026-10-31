import type { BuildingVertical } from "@seki/core";
import type { LublinBuildingData, LublinChunkData } from "./types";

/**
 * "Vertical Lublin 2077" (ADR-0051): a fictional layer over the real outlines that turns the
 * low, wide streets of the city (3 to 4 storeys, about 13 m, over streets 20 to 30 m wide) into
 * canyons, without moving a street. Each building gets a superstructure of whole 3 m storeys
 * and a density of the layer over the street, both from its `look` seed and its district:
 * - Krakowskie Przedmieście and Podzamcze rise most (2 to 8 and 3 to 8 storeys) and hang the
 *   most cables, ads and neon over their streets;
 * - the Old Town stays recognisable: nothing round the Rynek, a storey of rooftop gear on a
 *   few houses further out, little over the lanes;
 * - landmarks (gates, the Trybunał, towers, churches, the castle, palaces, public buildings)
 *   carry nothing, and a building standing against one rises no higher than its top (G-050).
 */

/** Height of one storey of the superstructure, metres. */
export const RISE_STOREY = 3;

type District = LublinChunkData["district"];

interface DistrictRule {
  /** Share of ordinary buildings that rise at all. */
  readonly share: number;
  readonly min: number;
  readonly max: number;
  readonly clutter: number;
}

const RULES: Readonly<Record<District, DistrictRule>> = {
  "shinsekai-7": { share: 0.85, min: 2, max: 8, clutter: 0.8 },
  targ: { share: 0.9, min: 3, max: 8, clutter: 0.9 },
  kanal: { share: 0.3, min: 1, max: 1, clutter: 0.25 },
  doki: { share: 0.6, min: 1, max: 4, clutter: 0.5 },
};

/** The Rynek: the Trybunał's centre and the radius in which the Old Town keeps its skyline. */
const RYNEK = { x: 582.4, z: -61.2, radius: 80, clutter: 0.1 } as const;

const LANDMARK = /brama|trybuna|wieża|baszta|donżon|zamek|archikatedr|katedr|kościół|kosciol|cerkiew|kaplica|klasztor|bazylika|synagog|teatr|pałac|ratusz|urząd|muzeum/i;

/** A landmark keeps its real silhouette: no superstructure, nothing hung on it. */
export const isLandmark = (b: Pick<LublinBuildingData, "use" | "name">): boolean => b.use === "church" || b.use === "civic" || b.use === "historic" || (b.name !== undefined && LANDMARK.test(b.name));

/** A hash of the look seed and a salt in [0, 1) (FNV-like mixing; no randomness). */
const unit = (look: number, salt: number): number => {
  let h = (look ^ Math.imul(salt, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Area and the short side of a flat outline's bounding box, metres. */
const footprint = (outline: readonly number[]): { area: number; short: number } => {
  let s = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const n = Math.floor(outline.length / 2);
  for (let i = 0; i < n; i++) {
    const x0 = outline[i * 2] ?? 0;
    const z0 = outline[i * 2 + 1] ?? 0;
    const k = ((i + 1) % n) * 2;
    s += x0 * (outline[k + 1] ?? 0) - (outline[k] ?? 0) * z0;
    minX = Math.min(minX, x0);
    maxX = Math.max(maxX, x0);
    minZ = Math.min(minZ, z0);
    maxZ = Math.max(maxZ, z0);
  }
  return { area: Math.abs(s) / 2, short: Math.min(maxX - minX, maxZ - minZ) };
};

/**
 * Gap between outlines, metres, under which a building stands against a landmark: narrower than
 * any street, so nothing but a wall or a passage lies between them.
 */
const AGAINST = 4;

/** World y of a building's top without a superstructure: foot, walls and roof. */
const bareTop = (b: LublinBuildingData): number => b.y + b.height + (b.roof ?? 0);

type Ring = { readonly pts: readonly (readonly [number, number])[]; readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };

const ringOf = (b: LublinBuildingData): Ring => {
  const pts: [number, number][] = [];
  for (let i = 0; i + 1 < b.outline.length; i += 2) pts.push([(b.outline[i] ?? 0) + b.x, (b.outline[i + 1] ?? 0) + b.z]);
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  return { pts, minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
};

/** Shortest distance from the corners of `a` to the edges of `b`. */
const cornersTo = (a: Ring, b: Ring): number => {
  let d = Infinity;
  for (const [x, z] of a.pts) {
    for (let i = 0; i < b.pts.length; i++) {
      const [x0, z0] = b.pts[i]!;
      const [x1, z1] = b.pts[(i + 1) % b.pts.length]!;
      const dx = x1 - x0;
      const dz = z1 - z0;
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (dx * dx + dz * dz || 1)));
      d = Math.min(d, Math.hypot(x0 + dx * t - x, z0 + dz * t - z));
    }
  }
  return d;
};

const against = (a: Ring, b: Ring): boolean =>
  a.minX - AGAINST < b.maxX && b.minX - AGAINST < a.maxX && a.minZ - AGAINST < b.maxZ && b.minZ - AGAINST < a.maxZ && Math.min(cornersTo(a, b), cornersTo(b, a)) < AGAINST;

/**
 * The world y each building standing against a landmark keeps its superstructure under: the
 * lowest top of those landmarks, by building id. The district alone would let a house on its
 * edge tower over the gate or church it adjoins (G-050), whatever district the landmark is in.
 */
export const landmarkCeilings = (buildings: readonly LublinBuildingData[]): ReadonlyMap<string, number> => {
  const landmarks = buildings.filter(isLandmark).map((b) => ({ ring: ringOf(b), top: bareTop(b) }));
  const out = new Map<string, number>();
  for (const b of buildings) {
    if (isLandmark(b)) continue;
    const ring = ringOf(b);
    for (const l of landmarks) if (against(ring, l.ring)) out.set(b.id, Math.min(out.get(b.id) ?? Infinity, l.top));
  }
  return out;
};

/** Storeys of superstructure of a building (0 for none). */
const storeys = (b: LublinBuildingData, district: District, ceiling: number): number => {
  if (isLandmark(b) || b.use === "garage") return 0;
  if (district === "kanal" && Math.hypot(b.x - RYNEK.x, b.z - RYNEK.z) < RYNEK.radius) return 0;
  const rule = RULES[district];
  const { area, short } = footprint(b.outline);
  if (area < 60 || short < 4 || unit(b.look, 1) >= rule.share) return 0;
  // Skewed to the low end: most add a few storeys, a few tower over the street.
  const n = rule.min + Math.floor(unit(b.look, 2) ** 1.6 * (rule.max - rule.min + 1));
  const cap = b.use === "industrial" || b.use === "other" ? 2 : short < 7 || area < 120 ? 3 : rule.max;
  const under = Math.max(0, Math.floor((ceiling - bareTop(b)) / RISE_STOREY));
  return Math.min(n, cap, rule.max, under);
};

/**
 * The vertical layer of a building of the map in its district, or undefined for none; its top
 * stays under `ceiling` (world y, from `landmarkCeilings`).
 */
export const verticalOf = (b: LublinBuildingData, district: District, ceiling = Infinity): BuildingVertical | undefined => {
  if (isLandmark(b)) return undefined;
  const rise = storeys(b, district, ceiling) * RISE_STOREY;
  const nearRynek = district === "kanal" && Math.hypot(b.x - RYNEK.x, b.z - RYNEK.z) < RYNEK.radius;
  const base = nearRynek ? RYNEK.clutter : RULES[district].clutter;
  // Each building hangs a little more or less than its district.
  const clutter = Math.round(Math.min(1, Math.max(0, base * (0.7 + 0.6 * unit(b.look, 3)))) * 100) / 100;
  return rise === 0 && clutter === 0 ? undefined : { rise, clutter };
};
