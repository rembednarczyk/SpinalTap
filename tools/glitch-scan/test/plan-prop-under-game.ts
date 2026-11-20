import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { StreetPropItem } from "../../../packages/core/src";
import { ARCADE_FRONT } from "../../../packages/sim/src/content/alchemia/arcade-front";
import { FRONT_FOOTPRINTS, L2_SLABS } from "../../../packages/sim/src/content/alchemia/front";
import type { Rect } from "../../../packages/sim/src/content/builders";
import { LUBLIN_STREET_PROPS } from "../../../packages/sim/src/content/lublin";
import { CLEARED_BUILDINGS, MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import { METRO_FOOTPRINTS } from "../../../packages/sim/src/content/metro";
import { GAME_ACTORS, GAME_PROPS, WORLD_STREET_PROPS } from "../../../packages/sim/src/content/street-props";
import { propOf } from "../../osm-import/src/props-kinds.ts";
import type { PlanItem } from "../../osm-import/src/props-gen.ts";

/**
 * `plan-prop-under-game` (the curator's review of C5, PR #793): a point of the furniture plan
 * (`docs/world/lublin-props.todo.json`) laid by hand (`inOsm: false`: from photos, descriptions, a
 * rule) whose piece the import places and the game always takes off again (`street-props.ts`): a
 * set piece, a block, a character or a way of the game's stands on its spot. A dead point of the
 * plan: it promises a bench or a lamp the player never sees. The points the map's data gives
 * (`inOsm` true or unset) are not the plan's to move, nor are lines, areas and the rules' groups.
 */

type Finding = { readonly at: string; readonly what: string };
type Pt = { readonly x: number; readonly z: number };

/** A point of the plan laid by hand: its group, its number in the group, the kind of piece it asks for. */
export interface PlanPoint extends Pt {
  readonly id: string;
  readonly n: number;
  readonly prop: string;
}

/** The plan's points laid by hand (`inOsm: false`), each `points` entry and each `position`. */
export const handPoints = (items: readonly PlanItem[]): PlanPoint[] =>
  items.flatMap((item) => {
    const prop = propOf(item.kind);
    if (item.inOsm !== false || !prop) return [];
    const pts = [...(item.position ? [[item.position.x, item.position.z] as const] : []), ...(item.points ?? [])];
    return pts.map(([x, z], n) => ({ id: item.id, n, prop, x, z }));
  });

/** How far a placed piece may stand off its point and still be its (m): the tables keep a decimetre. */
export const MATCH = 0.1;

/**
 * The hand-laid points whose piece the map places on them and the game drops: one finding a point,
 * at the point, with what of the game stands there (`why`). A point the import itself leaves out
 * (crowded, in a building) or moves off is no finding here: the game never had its piece.
 */
export const planPropsUnderGame = (points: readonly PlanPoint[], placed: readonly StreetPropItem[], kept: readonly StreetPropItem[], why: (p: PlanPoint) => string = () => "dropped by the game"): Finding[] => {
  const at = (items: readonly StreetPropItem[], p: PlanPoint) => items.some((i) => i.prop === p.prop && Math.hypot(i.x - p.x, i.z - p.z) <= MATCH);
  return points
    .filter((p) => at(placed, p) && !at(kept, p))
    .map((p) => ({ at: `${p.x.toFixed(1)},${p.z.toFixed(1)}`, what: `${p.id}#${p.n} ${p.prop} (${p.x}; ${p.z}): ${why(p)}` }));
};

const rectGap = (p: Pt, r: Rect): number => Math.hypot(Math.max(r.minX - p.x, 0, p.x - r.maxX), Math.max(r.minZ - p.z, 0, p.z - r.maxZ));
const span = (r: Rect) => `x ${r.minX.toFixed(1)}..${r.maxX.toFixed(1)}, z ${r.minZ.toFixed(1)}..${r.maxZ.toFixed(1)}`;

/** A set piece's or a game block's clearance from the map's furniture (m), `street-props.ts`'s `FURNITURE_CLEARANCE`. */
const CLEARANCE = 1.2;

/** The game's blocks standing on the ground, as `street-props.ts` reads them (the buried ones clear nothing). */
const blocks = (): Rect[] =>
  GAME_PROPS.flatMap((p) => (p.view.kind === "block" ? [{ minX: p.center.x - p.view.size.x / 2, maxX: p.center.x + p.view.size.x / 2, minZ: p.center.z - p.view.size.z / 2, maxZ: p.center.z + p.view.size.z / 2 }] : []));

/** What of the game stands on a point or within its clearance, nearest first among the rules of `clearOfGame` and `underFront` (a lamp's, `street-props.ts`). */
export const gameOn = (p: Pt & { readonly prop?: string }): string => {
  const near: { d: number; what: string }[] = [
    ...FRONT_FOOTPRINTS.map((r, i) => ({ d: rectGap(p, r) - CLEARANCE, what: `by Alchemia's front footprint ${i} (${span(r)})` })),
    ...METRO_FOOTPRINTS.map((r) => ({ d: rectGap(p, r) - CLEARANCE, what: `by a metro pavilion (${span(r)})` })),
    ...blocks().map((r) => ({ d: rectGap(p, r) - CLEARANCE, what: `by a game block (${span(r)})` })),
    ...CLEARED_BUILDINGS.map((r) => ({ d: rectGap(p, r) - 2, what: `by a cleared plot (${span(r)})` })),
    ...GAME_ACTORS.map((a) => ({ d: Math.hypot(a.spawn.position.x - p.x, a.spawn.position.z - p.z) - CLEARANCE, what: `by the game's character ${a.spawn.key} at (${a.spawn.position.x.toFixed(1)}; ${a.spawn.position.z.toFixed(1)})` })),
    ...[...L2_SLABS, ARCADE_FRONT].map((r) => ({ d: rectGap(p, r) > 0 || !p.prop?.startsWith("lamp") ? Infinity : -1e-3, what: `under the front's L2 (${span(r)})` })),
  ];
  const hit = near.filter((n) => n.d < 0).sort((a, b) => a.d - b.d)[0];
  return hit ? hit.what : "dropped by the game (a way the content walks, a passage)";
};

/** The plan's items as the file holds them. */
export const planItems = (): readonly PlanItem[] => (JSON.parse(readFileSync(join(__dirname, "../../../docs/world/lublin-props.todo.json"), "utf8")) as { items: PlanItem[] }).items;

/** The check over the game: the plan's file, the map's furniture and the game's (`WORLD_STREET_PROPS`). */
export const planPropsInGame = (): Finding[] => {
  const ids = MAP_CHUNKS.map((c) => c.id);
  return planPropsUnderGame(
    handPoints(planItems()),
    ids.flatMap((id) => LUBLIN_STREET_PROPS[id] ?? []),
    ids.flatMap((id) => WORLD_STREET_PROPS[id] ?? []),
    gameOn,
  );
};
