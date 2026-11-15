/**
 * What stands on the ground the map data draws as built (G-815, T-300): the outlines of OSM's
 * buildings and building parts (ruins and buildings under ground aside, as the game draws them:
 * a roof, a building site, a shed the game leaves out still has one), its building sites
 * (`landuse=construction`), its markets (`amenity=marketplace`, the covered stalls of Targ „Bazar”)
 * and its canopies (`man_made=canopy`), each with its holes (a multipolygon's courtyards). No tree
 * of the crowns' rule (`crown-trees.ts`) stands in one; the glitch scan's `tree-in-structure`
 * counts the trees that do.
 */
import { assembleRings } from "./features.ts";
import { type Pt, type Rect, openRing, pointInRing, ringBounds } from "./geometry.ts";
import type { OsmData, Tags } from "./osm.ts";
import { geoToWorld } from "./project.ts";

/** What a structure is. */
export type StructureKind = "building" | "construction" | "marketplace" | "canopy";

export interface Structure {
  /** `w<id>` or `r<id>`. */
  readonly id: string;
  readonly kind: StructureKind;
  readonly ring: readonly Pt[];
  readonly holes: readonly (readonly Pt[])[];
  readonly box: Rect;
}

/** The kind of a structure an area with `tags` is, or null. */
export const structureKind = (tags: Tags | undefined): StructureKind | null => {
  if (!tags) return null;
  if (tags.landuse === "construction") return "construction";
  if (tags.amenity === "marketplace") return "marketplace";
  if (tags.man_made === "canopy") return "canopy";
  const b = tags.building ?? tags["building:part"];
  if (b === undefined || b === "no" || b === "ruins" || tags.ruins === "yes" || tags.location === "underground") return null;
  return b === "construction" ? "construction" : "building";
};

/** Every structure of an extract: its closed ways and its multipolygons' outer rings with their inner ones, by id. */
export const structuresOf = (osm: OsmData): Structure[] => {
  const ringOf = (ids: readonly number[]): Pt[] | null => {
    const pts: Pt[] = [];
    for (const id of ids) {
      const n = osm.nodes.get(id);
      if (!n) return null;
      pts.push(geoToWorld(n.lat, n.lon));
    }
    return openRing(pts);
  };
  const out: Structure[] = [];
  const add = (id: string, kind: StructureKind, ring: Pt[] | null, holes: Pt[][]) => {
    if (ring && ring.length >= 3) out.push({ id, kind, ring, holes, box: ringBounds(ring) });
  };
  for (const w of [...osm.ways.values()].sort((a, b) => a.id - b.id)) {
    const kind = structureKind(w.tags);
    if (kind && w.nodes.length >= 4 && w.nodes[0] === w.nodes[w.nodes.length - 1]) add(`w${w.id}`, kind, ringOf(w.nodes), []);
  }
  for (const r of [...osm.relations.values()].sort((a, b) => a.id - b.id)) {
    const kind = structureKind(r.tags);
    if (!kind || (r.tags?.type !== "multipolygon" && r.tags?.type !== "building")) continue;
    const member = (inner: boolean): (readonly number[])[] =>
      r.members
        .filter((m) => m.type === "way" && (m.role === "inner") === inner)
        .map((m) => osm.ways.get(m.ref)?.nodes)
        .filter((n): n is readonly number[] => !!n);
    const holes = assembleRings(member(true)).flatMap((ids) => {
      const h = ringOf(ids);
      return h && h.length >= 3 ? [h] : [];
    });
    const rings = assembleRings(member(false));
    rings.forEach((ids, k) => add(rings.length > 1 ? `r${r.id}/${k}` : `r${r.id}`, kind, ringOf(ids), holes));
  }
  return out;
};

/** The structures by bins, for the point queries. */
export class StructureIndex {
  private readonly bins = new Map<string, Structure[]>();
  private static readonly BIN = 32;

  constructor(list: readonly Structure[]) {
    const B = StructureIndex.BIN;
    for (const s of list)
      for (let i = Math.floor(s.box.minX / B); i <= Math.floor(s.box.maxX / B); i++)
        for (let j = Math.floor(s.box.minZ / B); j <= Math.floor(s.box.maxZ / B); j++) {
          const k = `${i},${j}`;
          const l = this.bins.get(k);
          if (l) l.push(s);
          else this.bins.set(k, [s]);
        }
  }

  /** The first structure (by id order) p stands in, out of its holes; null in none. */
  at(p: Pt): Structure | null {
    const B = StructureIndex.BIN;
    for (const s of this.bins.get(`${Math.floor(p.x / B)},${Math.floor(p.z / B)}`) ?? []) {
      if (p.x < s.box.minX || p.x > s.box.maxX || p.z < s.box.minZ || p.z > s.box.maxZ) continue;
      if (pointInRing(p, s.ring) && !s.holes.some((h) => pointInRing(p, h))) return s;
    }
    return null;
  }
}
