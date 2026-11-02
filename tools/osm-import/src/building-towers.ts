/** Towers the map draws at a church (G-210, G-212): in its tags, or a tower way of its own in its outline or by its walls. */
import { type Area } from "./features.ts";
import { type Pt, openRing, pointInRing } from "./geometry.ts";
import { type OsmData, type Tags } from "./osm.ts";
import { geoToWorld } from "./project.ts";

/** A tower drawn as a way of the map (a tower, a bell tower, a tower part): its outline and centroid in world metres. */
export interface MappedTower {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly ring: readonly Pt[];
}

/** A tower standing by a building counts as its tower this far from its walls, metres: wall to wall. */
const NEAR = 10;

/** Tags that make an element (or a way of its own) a tower. */
export const isTowerTags = (t: Tags): boolean =>
  t["man_made"] === "tower" || t["tower:type"] !== undefined || t["building"] === "tower" || t["building"] === "bell_tower" || t["building:part"] === "tower";

/** Every tower drawn as a way of the map. */
export const mappedTowers = (osm: OsmData): MappedTower[] =>
  [...osm.ways.values()].flatMap((w) => {
    if (!w.tags || !isTowerTags(w.tags)) return [];
    const pts = w.nodes.flatMap((n) => {
      const node = osm.nodes.get(n);
      return node ? [geoToWorld(node.lat, node.lon)] : [];
    });
    if (pts.length === 0) return [];
    return [{ id: `w${w.id}`, x: pts.reduce((a, p) => a + p.x, 0) / pts.length, z: pts.reduce((a, p) => a + p.z, 0) / pts.length, ring: openRing(pts) }];
  });

const edgeGap = (p: Pt, ring: readonly Pt[]): number => {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(a.x + dx * k - p.x, a.z + dz * k - p.z));
  }
  return best;
};

/**
 * Whether the map has a tower for a building: in its own tags, or a tower way in its outline or
 * by its walls. By the walls is measured from the tower's own walls: a free-standing belfry 7 m
 * off the nave (St Nicholas's, w680377807) has its middle 11 m off.
 */
export const towerMapped = (own: Tags, ring: readonly Pt[], towers: readonly MappedTower[]): boolean =>
  isTowerTags(own) || towers.some((t) => pointInRing(t, ring) || [t, ...t.ring].some((p) => edgeGap(p, ring) <= NEAR));

/** The buildings of the map with a tower of the map at them, by id (G-212). */
export const buildingsWithTowers = (buildings: readonly Area[], towers: readonly MappedTower[]): Set<string> =>
  new Set(buildings.flatMap((a) => (towerMapped(a.tags, a.ring, towers) ? [a.id] : [])));
