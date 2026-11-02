import { type FacadeFrame, type Palette, facadeFrame } from "../../../packages/engine/src/renderer/mapcity/facade-frame";
import { planFarBuilding } from "../../../packages/engine/src/renderer/mapcity/facade-plan";
import { landmarkAt, withLandmark } from "../../../packages/engine/src/renderer/mapcity/landmarks";
import { type BuildingSource, mapBuilding } from "../../../packages/engine/src/renderer/mapcity/map-building";
import { type P2, centroid, cleanRing, pointInRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { addTowers } from "../../../packages/engine/src/renderer/mapcity/roof-plan";
import { MeshSink } from "../../../packages/engine/src/renderer/mesh-sink";
import { clearedBuilding } from "../../../packages/sim/src/content/cleared-buildings";
import { buildingView } from "../../../packages/sim/src/content/lublin";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { mappedTowers, towerMapped } from "../../osm-import/src/building-towers.ts";
import type { OsmData } from "../../osm-import/src/osm.ts";

/**
 * Landmarks of the curator's list the renderer crowns with bell towers of its own (G-210) while
 * the map shows them whole and without one: no `building:part` on or under them, no tower in
 * their tags, no tower mapped at them. The towers come from `roof-plan` (`addTowers`) and match
 * nothing in the data. The map's towers by a church are the importer's rule (`building-towers`).
 */

export { type MappedTower, isTowerTags, mappedTowers, towerMapped } from "../../osm-import/src/building-towers.ts";

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
 * A building of the city for the check: its map id, place, outline in the data, frame as the map
 * city frames it, whether it is a part or a part stands on it (G-049), and whether the map has a
 * tower for it.
 */
export interface TowerEntry {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly ring: readonly P2[];
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

/** Each church with a tower of the map in its outline or by its walls, without parts, that gets the renderer's towers besides (G-212). */
export const doubleTowers = (entries: readonly TowerEntry[]): { readonly at: string; readonly what: string }[] =>
  entries.flatMap((e) => {
    if (e.frame.b.use !== "church" || e.parts || !e.mapped) return [];
    const n = towerVertices(e.frame);
    return n > 0 ? [{ at: `${e.x.toFixed(0)},${e.z.toFixed(0)}`, what: `${e.id} ${e.frame.b.name ?? ""}: ${n} vertices of towers by the map's`.trim() }] : [];
  });

const GREY: Palette = { wall: [0.5, 0.5, 0.5, 1], trim: [0.5, 0.5, 0.5, 1], plinth: [0.5, 0.5, 0.5, 1], roof: [0.5, 0.5, 0.5, 1] };

/** The tips of the renderer's towers on a building (its far towers, each ending in a spire): the highest points, one per tower. */
export const towerTips = (f: FacadeFrame): P2[] => {
  if (!f.style.tower) return [];
  const sink = new MeshSink();
  addTowers(sink, f, GREY, false);
  const pos = sink.positions;
  let top = -Infinity;
  for (let i = 1; i < pos.length; i += 3) top = Math.max(top, pos[i]!);
  const tips = new Map<string, P2>();
  for (let i = 0; i < pos.length; i += 3) if (pos[i + 1]! > top - 1e-6) tips.set(`${pos[i]!.toFixed(2)},${pos[i + 2]!.toFixed(2)}`, { x: pos[i]!, z: pos[i + 2]! });
  return [...tips.values()];
};

/** Each tower of the renderer's whose middle (its spire's tip) stands outside its building's outline (G-212, G-215). */
export const towersOffBuilding = (entries: readonly TowerEntry[]): { readonly at: string; readonly what: string }[] =>
  entries.flatMap((e) =>
    towerTips(e.frame)
      .filter((t) => !pointInRing(t, e.ring))
      .map((t) => ({ at: `${t.x.toFixed(0)},${t.z.toFixed(0)}`, what: `${e.id} ${e.frame.b.name ?? ""}: a tower off the building`.trim() })),
  );

/** The buildings of the city `keep` takes, framed as the map city frames them, with the map's towers. */
const cityEntries = (keep: (id: string, s: BuildingSource) => boolean, osm: OsmData): TowerEntry[] => {
  const data = MAP_CHUNKS.flatMap((c) => c.buildings.filter((b) => !clearedBuilding(b)));
  const sources = data.map((b): BuildingSource => {
    const view = buildingView(b) as BuildingSource["view"];
    return { ring: cleanRing(view.outline.map((p) => ({ x: p.x + b.x, z: p.z + b.z }))), view, at: { x: b.x, y: b.y, z: b.z } };
  });
  const lifted = sources.filter((s) => s.view.soffit !== undefined);
  const towers = mappedTowers(osm);
  return sources.flatMap((s, i): TowerEntry[] => {
    const id = data[i]!.id;
    if (!keep(id, s)) return [];
    const m = /^([wr])(\d+)/.exec(id);
    const el = m ? (m[1] === "w" ? osm.ways.get(Number(m[2])) : osm.relations.get(Number(m[2]))) : undefined;
    const frame = withLandmark(facadeFrame(mapBuilding(i + 1, s, () => null, lifted), () => null), landmarkAt(s.at.x, s.at.z, s.view.outline.length));
    return [{ id, x: s.at.x, z: s.at.z, ring: s.ring, frame, parts: hasParts(s, lifted), mapped: towerMapped(el?.tags ?? {}, s.ring, towers) }];
  });
};

/** The check over the city: the listed landmarks framed as the map city frames them, with the map's towers. */
export const cityFakeTowers = (ids: readonly string[], osm: OsmData): { readonly at: string; readonly what: string }[] => {
  const listed = new Set(ids);
  return fakeTowers(ids, cityEntries((id) => listed.has(id.split("/")[0]!), osm));
};

/** The city's churches, framed as the map city frames them, with the map's towers. */
export const cityChurches = (osm: OsmData): TowerEntry[] => cityEntries((_, s) => s.view.use === "church", osm);
