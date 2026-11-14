/**
 * The furniture of the current OSM extract the plan does not hold (ADR-0077 point 4: OSM first, G-099,
 * T-061): every point of `data/osm/points/furniture.json` (`furniture.ts`) inside the map's districts
 * whose node id no group of `docs/world/lublin-props.todo.json` lists becomes a point of a group of its
 * own, `osm.furniture.<kind>`, after the plan's groups, so the plan's pieces keep their places and win
 * where the two meet. The plan of 29.10 stays the source of its descriptions, its hand-drawn lines and
 * areas; the lamps (the `lit` rule, G-798) and the hydrants (`osm.hydrants`) are placed by rules of their own.
 */
import { DISTRICTS } from "./config.ts";
import { type FurniturePoint, planKindOf } from "./furniture.ts";
import type { PlanItem, PropsPlan } from "./props-gen.ts";

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
