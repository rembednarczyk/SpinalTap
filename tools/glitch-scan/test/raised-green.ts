import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { belowGround } from "../../osm-import/src/building-tags.ts";
import { extractFeatures } from "../../osm-import/src/features.ts";
import { areaSurface } from "../../osm-import/src/ground.ts";
import type { OsmData, Tags } from "../../osm-import/src/osm.ts";
import { flatRing } from "./landuse-bare";

/**
 * `raised-green-on-ground` (G-647): a point of a 0.5 m grid with drawn grass on it, in a lawn the
 * map lays above the ground (`layer` > 0, or on a roof) and in no other lawn of the map, where that
 * lawn is not on the ground: in a drawn building (its roof's green, VIVO's r11978659), or, when the
 * lawn reaches over a structure under the ground (a garage, whose roof is the ground's level),
 * off every such structure. Points within `EDGE` of an outline are left out: the import rounds
 * the ground to 0.1 m and the renderer draws the buildings' outlines cleaned.
 */

type Pt = { readonly x: number; readonly z: number };
type Ring = readonly Pt[];
type Box = { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
type Finding = { readonly at: string; readonly what: string };

const GRID = 0.5;
/** How far inside or outside an outline a point must lie to count (m). */
export const EDGE = 0.3;

export interface RaisedGreenWorld {
  /** The map's lawns above the ground, by id. */
  readonly raised: readonly { readonly id: string; readonly ring: Ring }[];
  /** The map's other lawns: a point in one is that lawn's. */
  readonly lawns: readonly Ring[];
  /** The map's buildings under the ground. */
  readonly decks: readonly Ring[];
  /** The drawn buildings' outlines. */
  readonly buildings: readonly Ring[];
  /** The drawn grass. */
  readonly grass: readonly Ring[];
  readonly chunks: readonly Box[];
}

const boxOf = (ring: Ring): Box => ({
  minX: Math.min(...ring.map((p) => p.x)),
  maxX: Math.max(...ring.map((p) => p.x)),
  minZ: Math.min(...ring.map((p) => p.z)),
  maxZ: Math.max(...ring.map((p) => p.z)),
});
const meets = (a: Box, b: Box): boolean => a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;

const inRing = (p: Pt, ring: Ring): boolean => {
  let odd = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = [ring[i]!, ring[j]!];
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) odd = !odd;
  }
  return odd;
};

const edgeGap = (p: Pt, ring: Ring): number => {
  let d = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [a, b] = [ring[j]!, ring[i]!];
    const [dx, dz] = [b.x - a.x, b.z - a.z];
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    d = Math.min(d, Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z));
  }
  return d;
};

/** One finding per point of drawn grass where a raised lawn of the map is not on the ground. */
export const raisedGreenOnGround = (w: RaisedGreenWorld): Finding[] => {
  const out: Finding[] = [];
  for (const lawn of w.raised) {
    const box = boxOf(lawn.ring);
    const near = (rings: readonly Ring[]) => rings.filter((r) => meets(boxOf(r), box));
    const [lawns, decks, buildings, grass] = [near(w.lawns), near(w.decks), near(w.buildings), near(w.grass)];
    const deep = (p: Pt, r: Ring) => inRing(p, r) && edgeGap(p, r) > EDGE;
    const clear = (p: Pt, r: Ring) => !inRing(p, r) && edgeGap(p, r) > EDGE;
    for (let x = Math.floor(box.minX) + GRID / 2; x < box.maxX; x += GRID)
      for (let z = Math.floor(box.minZ) + GRID / 2; z < box.maxZ; z += GRID) {
        const p = { x, z };
        if (!inRing(p, lawn.ring) || !w.chunks.some((c) => x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ)) continue;
        if (!grass.some((r) => inRing(p, r)) || lawns.some((r) => inRing(p, r))) continue;
        const what = buildings.some((r) => deep(p, r)) ? "in a building" : decks.length > 0 && decks.every((r) => clear(p, r)) ? "off the deck under it" : null;
        if (what) out.push({ at: `${x.toFixed(0)},${z.toFixed(0)}`, what: `${lawn.id} on the ground ${what}: ${x.toFixed(2)},${z.toFixed(2)}` });
      }
  }
  return out;
};

/** A lawn the map lays above the ground. */
const raisedTags = (t: Tags): boolean => Number(t.layer ?? 0) > 0 || t.location === "roof" || t.location === "rooftop";

/** The city's world: the map data's lawns and decks, the game's buildings and grass. */
export const cityRaisedGreenWorld = (osm: OsmData): RaisedGreenWorld => {
  const areas = extractFeatures(osm).areas;
  const green = areas.filter((a) => areaSurface(a.tags) === "grass");
  return {
    raised: green.filter((a) => raisedTags(a.tags)).map((a) => ({ id: a.id, ring: a.ring })),
    lawns: green.filter((a) => !raisedTags(a.tags)).map((a) => a.ring),
    decks: areas.filter((a) => a.tags.building !== undefined && a.tags.building !== "no" && belowGround(a.tags)).map((a) => a.ring),
    buildings: MAP_CHUNKS.flatMap((c) => c.buildings.map((b) => flatRing(b.outline, b.x, b.z))),
    grass: MAP_CHUNKS.flatMap((c) => c.ground.filter((g) => g.surface === "grass").map((g) => flatRing(g.outline))),
    chunks: MAP_CHUNKS.map((c) => c.bounds),
  };
};
