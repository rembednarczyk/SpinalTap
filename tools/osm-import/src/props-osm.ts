/**
 * The furniture of the current OSM extract the plan does not hold (ADR-0077 point 4: OSM first, G-099,
 * T-061): every point of `data/osm/points/furniture.json` (`furniture.ts`) inside the map's districts
 * whose node id no group of `docs/world/lublin-props.todo.json` lists becomes a point of a group of its
 * own, `osm.furniture.<kind>`, after the plan's groups, so the plan's pieces keep their places and win
 * where the two meet. The plan of 29.10 stays the source of its descriptions, its hand-drawn lines and
 * areas; the lamps (the `lit` rule, `props-lit.ts`, G-798) and the hydrants (`osm.hydrants`) are placed by rules of their own.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DISTRICTS } from "./config.ts";
import { type FurniturePoint, loadFurniture, planKindOf } from "./furniture.ts";
import { type OsmData, type Tags, mergeOsm, parseExtract } from "./osm.ts";
import { REPO } from "./paths.ts";
import type { PlanItem, PropsPlan } from "./props-gen.ts";
import { type LitWay, isLitWay } from "./props-lit.ts";
import { geoToWorld } from "./project.ts";

/** The id of the group of an OSM kind. */
export const OSM_GROUP = "osm.furniture";

const inMap = (p: { readonly x: number; readonly z: number }): boolean => DISTRICTS.some(({ rect: r }) => p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ);

/** Every node id a group of the plan lists (`n123`). */
export const planNodeIds = (plan: PropsPlan): Set<string> => new Set(plan.items.flatMap((i) => (i.osm === undefined ? [] : typeof i.osm === "string" ? [i.osm] : i.osm)));

/** The groups of the extract's points the plan lacks, one a kind, in the order of the file (by node id). */
export const osmFurnitureItems = (plan: PropsPlan, points: readonly FurniturePoint[]): PlanItem[] => {
  const held = planNodeIds(plan);
  const groups = new Map<string, { points: [number, number][]; osm: string[] }>();
  for (const f of points) {
    const kind = planKindOf(f);
    if (kind === null || held.has(f.id) || !inMap(f.p)) continue;
    const g = groups.get(kind) ?? { points: [], osm: [] };
    g.points.push([Math.round(f.p.x * 10) / 10, Math.round(f.p.z * 10) / 10]);
    g.osm.push(f.id);
    groups.set(kind, g);
  }
  return [...groups].sort(([a], [b]) => (a < b ? -1 : 1)).map(([kind, g]) => ({ id: `${OSM_GROUP}.${kind}`, kind, points: g.points, osm: g.osm, count: g.points.length, note: "From data/osm/points/furniture.json (pnpm osm:fetch): nodes the plan lacks." }));
};

/** The plan with the extract's groups after its own. */
export const withOsmFurniture = (plan: PropsPlan, points: readonly FurniturePoint[]): PropsPlan => ({ ...plan, items: [...plan.items, ...osmFurnitureItems(plan, points)] });

/** The ways of an extract whose tags `keep` takes (the lit ones by default), by id, with their points in the world (`props-lit.ts`). */
export const litWaysOf = (osm: OsmData, keep: (tags: Tags | undefined) => boolean = isLitWay): LitWay[] =>
  [...osm.ways.values()]
    .filter((w) => keep(w.tags))
    .sort((a, b) => a.id - b.id)
    .flatMap((w) => {
      const pts = w.nodes.map((id) => osm.nodes.get(id));
      return pts.every((n) => n !== undefined) ? [{ id: w.id, tags: w.tags!, pts: pts.map((n) => geoToWorld(n!.lat, n!.lon)) }] : [];
    });

const loadDistricts = (root: string): OsmData => mergeOsm(DISTRICTS.map((d) => parseExtract(readFileSync(join(root, "data/osm", `${d.slug}.json`), "utf8"))));

/** The lit ways of the districts' extracts in `data/osm`. */
export const loadLitWays = (root = REPO): LitWay[] => litWaysOf(loadDistricts(root));

/** Every street and path of the districts' extracts, for the lamps' looks along them (`styleClashes`). */
export const loadStreetWays = (root = REPO): LitWay[] => litWaysOf(loadDistricts(root), (tags) => tags?.highway !== undefined);

/** The plan as its file has it, before the extract's groups and the `lit` rule. */
export const loadPlanFile = (root = REPO): PropsPlan => JSON.parse(readFileSync(join(root, "docs/world/lublin-props.todo.json"), "utf8")) as PropsPlan;

/** The plan `pnpm osm:props` places: `docs/world/lublin-props.todo.json` with the extract's groups after its own. */
export const loadPropsPlan = (root = REPO): PropsPlan => withOsmFurniture(loadPlanFile(root), loadFurniture(root));
