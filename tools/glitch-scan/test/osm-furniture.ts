import type { StreetPropItem } from "../../../packages/core/src";
import { DISTRICTS } from "../../osm-import/src/config.ts";
import { type BollardLine, type FurniturePoint, planKindOf } from "../../osm-import/src/furniture.ts";
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

/** How near a line of bollards its posts stand (m), and how far apart at most on average (G-818). */
export const LINE_REACH = 0.8;
export const LINE_SPACING = 2.5;

const toSegment = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
};

/**
 * `osm-bollard-line-missing` (G-818, T-301): a row of bollards OSM maps as a way `barrier=bollard`
 * (`data/osm/points/bollard-lines.json`) inside the map's districts with fewer than its length over
 * `LINE_SPACING` posts within `LINE_REACH` of it. The plan of 29.10 held each such way as one point,
 * so Plac Łokietka's row before the Nowy Ratusz had 3 posts of its 43.6 m and Krakowskie by the
 * Bernardines none.
 */
export const osmBollardLineMissing = (lines: readonly BollardLine[], props: readonly StreetPropItem[]): { at: string; what: string }[] => {
  const posts = props.filter((i) => i.prop === "bollard");
  return lines.flatMap((l) => {
    if (!l.pts.some(inMap)) return [];
    const segs = l.pts.slice(1).map((b, k) => [l.pts[k]!, b] as const);
    const length = segs.reduce((s, [a, b]) => s + Math.hypot(b.x - a.x, b.z - a.z), 0);
    const near = posts.filter((i) => segs.some(([a, b]) => toSegment(i, a, b) <= LINE_REACH)).length;
    if (near >= length / LINE_SPACING) return [];
    const mid = l.pts[Math.floor(l.pts.length / 2)]!;
    return [{ at: `${mid.x.toFixed(1)},${mid.z.toFixed(1)}`, what: `${l.id} ${length.toFixed(1)} m: ${near} posts, ${Math.ceil(length / LINE_SPACING)} wanted` }];
  });
};
