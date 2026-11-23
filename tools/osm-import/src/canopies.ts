/**
 * Roofs on posts (`building=roof`, G-063): a bus platform's shelter on Aleja Tysiąclecia, the
 * stall roofs of Targ na Ruskiej, the museum's well, a car wash. The map gives them no height: the
 * clearance comes from what stands under them. The posts follow the outline the way a canopy's
 * frame does (posts at the corners of the roof and along its edges at a bay's pitch), set in from
 * the eaves. Kept out of the chunk's buildings, so the ground, the furniture and the crowd under
 * them stay as they are.
 */
import { terrainHeightAt } from "../../../packages/core/src/world/city-geo.ts";
import { lookOf, parseLength } from "./building-tags.ts";
import { footprint, groundUnder, prepareOutline } from "./buildings.ts";
import { type HeightSource } from "./dtm.ts";
import { type Area } from "./features.ts";
import { type Pt, type Rect, centroid, inRect, pointInRing, r1 } from "./geometry.ts";
import { type CanopyOut, type ChunkOut } from "./model.ts";
import { type ChunkTerrain } from "./terrain.ts";

/** The roof's slab (the renderer draws a lifted outline at least 1 m deep), the posts' side, their bay and how far in from the eaves, metres. */
export const CANOPY = { slab: 1, post: 0.25, bay: 6, inset: 0.35, minGap: 1.5 } as const;

/** The clearance under a roof the map gives no height: a car wash's for vans, a well's over its windlass, a platform's over the bus doors. */
const clearanceOf = (t: Area["tags"]): number => {
  const min = parseLength(t.min_height);
  if (min !== null) return min;
  const height = parseLength(t.height);
  if (height !== null) return Math.max(height - CANOPY.slab, 2.2);
  if (t.amenity === "car_wash") return 4.2;
  if (t.man_made === "water_well") return 2.4;
  if (t.public_transport === "platform" || t.shelter === "yes") return 3.2;
  return 3;
};

export const isCanopy = (a: Area): boolean => a.tags.building === "roof";

/** A point `d` metres into the outline from `p` along the mean of the inward normals given. */
const inward = (p: Pt, normals: readonly Pt[], d: number, ring: readonly Pt[]): Pt | null => {
  const n = normals.reduce((s, q) => ({ x: s.x + q.x, z: s.z + q.z }), { x: 0, z: 0 });
  const len = Math.hypot(n.x, n.z);
  if (len < 1e-6) return null;
  for (const sign of [1, -1]) {
    const q = { x: p.x + (sign * n.x * d) / len, z: p.z + (sign * n.z * d) / len };
    if (pointInRing(q, ring)) return q;
  }
  return null;
};

/** The posts of a roof on `ring` (relative points, counter-clockwise): at its corners and along its edges at most `CANOPY.bay` apart. */
export const canopyPosts = (ring: readonly Pt[]): Pt[] => {
  const n = ring.length;
  const normalOf = (i: number): Pt => {
    const a = ring[i]!;
    const b = ring[(i + 1) % n]!;
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    return { x: -(b.z - a.z) / len, z: (b.x - a.x) / len };
  };
  const posts: Pt[] = [];
  const add = (q: Pt | null) => {
    if (q && posts.every((o) => Math.hypot(o.x - q.x, o.z - q.z) >= CANOPY.minGap)) posts.push({ x: r1(q.x), z: r1(q.z) });
  };
  for (let i = 0; i < n; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % n]!;
    add(inward(a, [normalOf((i + n - 1) % n), normalOf(i)], CANOPY.inset * Math.SQRT2, ring));
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const bays = Math.ceil(len / CANOPY.bay);
    for (let k = 1; k < bays; k++) add(inward({ x: a.x + ((b.x - a.x) * k) / bays, z: a.z + ((b.z - a.z) * k) / bays }, [normalOf(i)], CANOPY.inset, ring));
  }
  return posts;
};

const flat = (pts: readonly Pt[]): number[] => pts.flatMap((p) => [p.x, p.z]);

/** A roof on posts of the map, on the terrain of its chunk; null if its outline is degenerate. */
export const makeCanopy = (a: Area, src: HeightSource, t: ChunkTerrain, altitude: number): CanopyOut | null => {
  const f = footprint(a.ring);
  if (typeof f === "string") return null;
  const { center, outline, parts } = f;
  const ground = groundUnder(src, center, outline);
  const drawn = outline.map((p) => ({ x: p.x + center.x, z: p.z + center.z }));
  const gridMin = Math.min(...drawn.map((p) => terrainHeightAt(t.grid, p.x, p.z)), terrainHeightAt(t.grid, center.x, center.z));
  const y = Math.floor(Math.min(ground.min - altitude, gridMin) * 10 + 1e-9) / 10 + 0;
  const plinth = r1(Math.max(ground.max - altitude - y, 0));
  const soffit = r1(plinth + clearanceOf(a.tags));
  // The posts stand on the frame's coarser outline: a rounded platform end gets a post at its turn, not one a metre.
  const frame = prepareOutline(a.ring, 1)?.outline ?? outline;
  return {
    id: a.id,
    x: center.x,
    z: center.z,
    y,
    outline: flat(outline),
    parts: parts.map(flat),
    soffit,
    height: r1(soffit + CANOPY.slab),
    plinth,
    look: lookOf(a.id),
    ...(a.tags.name ? { name: a.tags.name } : {}),
    posts: flat(canopyPosts(frame)),
  };
};

/** The chunk with the map's roofs on posts (of `areas`) whose centroids lie in it: beside its buildings, not among them, so what lies under them stays. */
export const withCanopies = <R extends { readonly chunk: ChunkOut }>(r: R, areas: readonly Area[], rect: Rect, src: HeightSource, t: ChunkTerrain, altitude: number): R => {
  const canopies = areas.filter((a) => isCanopy(a) && inRect(centroid(a.ring), rect)).flatMap((a) => makeCanopy(a, src, t, altitude) ?? []);
  return canopies.length > 0 ? { ...r, chunk: { ...r.chunk, canopies } } : r;
};
