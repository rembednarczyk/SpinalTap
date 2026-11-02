import { type FacadeFrame, facadeFrame } from "../../../packages/engine/src/renderer/mapcity/facade-frame";
import { planFarBuilding } from "../../../packages/engine/src/renderer/mapcity/facade-plan";
import { landmarkAt, withLandmark } from "../../../packages/engine/src/renderer/mapcity/landmarks";
import { type BuildingSource, mapBuilding } from "../../../packages/engine/src/renderer/mapcity/map-building";
import { type P2, centroid, cleanRing, pointInRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { MeshSink } from "../../../packages/engine/src/renderer/mesh-sink";
import { clearedBuilding } from "../../../packages/sim/src/content/cleared-buildings";
import { buildingView } from "../../../packages/sim/src/content/lublin";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import type { OsmData, Tags } from "../../osm-import/src/osm.ts";
import { geoToWorld } from "../../osm-import/src/project.ts";

/**
 * Landmarks of the curator's list the renderer crowns with bell towers of its own (G-210) while
 * the map shows them whole and without one: no `building:part` on or under them, no tower in
 * their tags, no tower mapped at them. The towers come from `roof-plan` (`addTowers`) and match
 * nothing in the data.
 */

/** A tower drawn as a way of the map (a tower, a bell tower, a tower part), its centroid in world metres. */
export interface MappedTower {
  readonly id: string;
  readonly x: number;
  readonly z: number;
}

/** A tower standing by a building counts as its tower this far from its walls, metres. */
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
    return [{ id: `w${w.id}`, x: pts.reduce((a, p) => a + p.x, 0) / pts.length, z: pts.reduce((a, p) => a + p.z, 0) / pts.length }];
  });

const edgeGap = (p: P2, ring: readonly P2[]): number => {
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

/** Whether the map has a tower for a building: in its own tags, or a tower way in its outline or by its walls. */
export const towerMapped = (own: Tags, ring: readonly P2[], towers: readonly MappedTower[]): boolean =>
  isTowerTags(own) || towers.some((t) => pointInRing(t, ring) || edgeGap(t, ring) <= NEAR);

/** Whether a building is a part lifted onto another (G-049), or a part from the map stands on it. */
export const hasParts = (s: BuildingSource, lifted: readonly BuildingSource[]): boolean =>
  s.view.soffit !== undefined || lifted.some((p) => pointInRing(centroid(p.ring), s.ring));

/** Vertices the renderer's bell towers add to a building's far block. */
export const towerVertices = (f: FacadeFrame): number => {
  const count = (frame: FacadeFrame) => {
    const sink = new MeshSink();
    planFarBuilding(sink, frame);
    return sink.vertexCount;
  };
  return count(f) - count({ ...f, style: { ...f.style, tower: false } });
};

/**
 * A building of the city for the check: its map id, place, frame as the map city frames it,
 * whether it is a part or a part stands on it (G-049), and whether the map has a tower for it.
 */
export interface TowerEntry {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly frame: FacadeFrame;
  readonly parts: boolean;
  readonly mapped: boolean;
}

/** Each listed landmark (by map id, a split piece by its whole's) without parts and without a mapped tower that gets the renderer's towers. */
export const fakeTowers = (ids: readonly string[], entries: readonly TowerEntry[]): { readonly at: string; readonly what: string }[] => {
  const listed = new Set(ids);
  return entries.flatMap((e) => {
    if (!listed.has(e.id.split("/")[0]!) || e.parts || e.mapped) return [];
    const n = towerVertices(e.frame);
    return n > 0 ? [{ at: `${e.x.toFixed(0)},${e.z.toFixed(0)}`, what: `${e.id} ${e.frame.b.name ?? ""}: ${n} vertices of towers`.trim() }] : [];
  });
};

/** The check over the city: the listed landmarks framed as the map city frames them, with the map's towers. */
export const cityFakeTowers = (ids: readonly string[], osm: OsmData): { readonly at: string; readonly what: string }[] => {
  const data = MAP_CHUNKS.flatMap((c) => c.buildings.filter((b) => !clearedBuilding(b)));
  const sources = data.map((b): BuildingSource => {
    const view = buildingView(b) as BuildingSource["view"];
    return { ring: cleanRing(view.outline.map((p) => ({ x: p.x + b.x, z: p.z + b.z }))), view, at: { x: b.x, y: b.y, z: b.z } };
  });
  const lifted = sources.filter((s) => s.view.soffit !== undefined);
  const towers = mappedTowers(osm);
  const listed = new Set(ids);
  const entries = sources.flatMap((s, i): TowerEntry[] => {
    const id = data[i]!.id;
    if (!listed.has(id.split("/")[0]!)) return [];
    const m = /^([wr])(\d+)/.exec(id);
    const el = m ? (m[1] === "w" ? osm.ways.get(Number(m[2])) : osm.relations.get(Number(m[2]))) : undefined;
    const frame = withLandmark(facadeFrame(mapBuilding(i + 1, s, () => null, lifted), () => null), landmarkAt(s.at.x, s.at.z, s.view.outline.length));
    return [{ id, x: s.at.x, z: s.at.z, frame, parts: hasParts(s, lifted), mapped: towerMapped(el?.tags ?? {}, s.ring, towers) }];
  });
  return fakeTowers(ids, entries);
};
