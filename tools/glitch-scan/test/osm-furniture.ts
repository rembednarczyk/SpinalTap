import type { StreetPropItem } from "../../../packages/core/src";
import { DISTRICTS } from "../../osm-import/src/config.ts";
import { type FurniturePoint, planKindOf } from "../../osm-import/src/furniture.ts";
import { propOf } from "../../osm-import/src/props-kinds.ts";

/**
 * `osm-furniture-missing` (G-099, T-061, ADR-0077 point 4): a node of the current OSM extract's
 * furniture (`data/osm/points/furniture.json`: trees, benches, bins, bike racks, machines, parcel
 * lockers, bollards, advertising columns) inside the map's districts with no piece of its kind in
 * the game within `REACH`. The furniture came from the plan of 29.10 alone, so the strip of
 * Krakowskie south of z = −200, added to the map after it (#87), had none of its 32 trees, 29
 * bollards, 4 benches and the rest. The lamps (the `lit` rule, G-798) and the hydrants
 * (`osm.hydrants`, pillars only) are left to their own rules.
 */

type Pt = { readonly x: number; readonly z: number };

/** How near its node the piece stands (m): a placed piece moves off a road or a wall a little. */
export const REACH = 3;

const inMap = (p: Pt): boolean => DISTRICTS.some(({ rect: r }) => p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ);

export const osmFurnitureMissing = (points: readonly FurniturePoint[], props: readonly StreetPropItem[], reach = REACH): { at: string; what: string }[] => {
  const byProp = new Map<string, StreetPropItem[]>();
  for (const i of props) byProp.set(i.prop, [...(byProp.get(i.prop) ?? []), i]);
  return points.flatMap((f) => {
    const kind = planKindOf(f);
    const prop = kind === null ? null : propOf(kind);
    if (prop === null || !inMap(f.p)) return [];
    if ((byProp.get(prop) ?? []).some((i) => Math.abs(i.x - f.p.x) < reach && Math.abs(i.z - f.p.z) < reach && Math.hypot(i.x - f.p.x, i.z - f.p.z) < reach)) return [];
    return [{ at: `${f.p.x.toFixed(1)},${f.p.z.toFixed(1)}`, what: `${f.id} ${f.tag}: no ${prop} within ${reach} m` }];
  });
};
