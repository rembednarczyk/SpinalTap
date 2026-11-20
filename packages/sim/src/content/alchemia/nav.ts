import { type NavEdge, type NavGraph, type NavNode, mergeNav } from "../builders";
import { P1_NAV } from "./parking-nav";
import { METRO_DOOR_NAV } from "./metro-door";
import { P2_NAV } from "./p2-nav";
import { SHELTER_NAV } from "./shelter-nav";
import { MALL_NAV } from "./mall-nav";
import { groundY } from "../lublin/terrain";
import { STAIR, STAIR_HEAD_X, opening } from "./foodhall";
import { HALL } from "./plan";
import { EAST_RAMP, WEST_RAMP } from "./terraces";

/**
 * Alchemia in the level graph (ADR-0074 §5, stage 1; as the metro's, #316): the food hall is dug
 * into the slope (a `GroundCut`), so its floor and its roof are levels of their own, apart from
 * the terraces round it at any height; the graph says which way in and up. Nodes stand a step
 * outside and inside each door, a step off both ends of the stairs and on the roof's south edge.
 * The terraces T0 and T1 and their ramps are one floor of the terrain: their nodes are linked
 * along the ramps only so that a way from the roof or the hall goes on to the other terrace.
 * Inside the hall (P0, its shops round the fountain since ADR-0093 O3) an NPC walks round them itself. The lift is the player's.
 */

const F = HALL.floor;
const R = HALL.roof;
/** Outside the front, a step off its glass; inside the doors, past the wall. */
const OUT = HALL.maxZ + 1.6;
const IN = HALL.maxZ - 1.4;
const OFF = 0.4;

const mid = (id: Parameters<typeof opening>[0]): number => {
  const o = opening(id);
  return (o.x0 + o.x1) / 2;
};

const on = (x: number, z: number): { x: number; y: number; z: number } => ({ x, y: groundY(x, z), z });

const NODES: readonly NavNode[] = [
  // T1, along the front.
  { id: "alchemia-t1-west", at: on(WEST_RAMP.b.x, OUT) },
  { id: "alchemia-t1-fumiko", at: on(mid("fumiko-door"), OUT) },
  { id: "alchemia-t1-entrance", at: on(mid("entrance"), OUT) },
  { id: "alchemia-t1-east-door", at: on(mid("east-door"), OUT) },
  { id: "alchemia-t1-east", at: on(EAST_RAMP.b.x, OUT) },
  // T0, along the car park by the back wall.
  { id: "alchemia-t0-west", at: on(WEST_RAMP.a.x, HALL.minZ - 1.2) },
  { id: "alchemia-t0-stair", at: on(401.8, HALL.minZ - 1.2) },
  { id: "alchemia-t0-roof", at: on(420, HALL.minZ - 1.2) },
  { id: "alchemia-t0-east", at: on(EAST_RAMP.a.x, HALL.minZ - 1.2) },
  // The hall's floor.
  { id: "alchemia-fumiko-in", at: { x: mid("fumiko-door"), y: F, z: IN } },
  { id: "alchemia-entrance-in", at: { x: mid("entrance"), y: F, z: IN } },
  // Since ADR-0093 O3 the fountain stands in the atrium's middle: the way in's aisle passes west of it.
  { id: "alchemia-hall-centre", at: { x: 416, y: F, z: 51.6 } },
  // Since ADR-0093 O1 the escalators stand along the atrium's south edge: west of the first one's head, by the P1 landing.
  { id: "alchemia-hall-aisle", at: { x: 413.0, y: F, z: 42.5 } },
  { id: "alchemia-hall-south", at: { x: 416.7, y: F, z: 39.2 } },
  { id: "alchemia-hall-back", at: { x: 411.3, y: F, z: 38.8 } },
  // The stairs up to the stair house on the old roof, P1 of the gallery since ADR-0093 O1 (`mall-nav.ts`).
  { id: "alchemia-stair-foot", at: { x: STAIR.footX + OFF, y: F, z: (STAIR.minZ + STAIR.maxZ) / 2 } },
  { id: "alchemia-stair-head", at: { x: STAIR_HEAD_X - OFF, y: R, z: (STAIR.minZ + STAIR.maxZ) / 2 } },
];

const chain = (...ids: string[]): NavEdge[] => ids.slice(1).map((b, i) => ({ a: `alchemia-${ids[i]}`, b: `alchemia-${b}` }));

const EDGES: readonly NavEdge[] = [
  ...chain("t1-west", "t1-fumiko", "t1-entrance", "t1-east-door", "t1-east"),
  ...chain("t0-west", "t0-stair", "t0-roof", "t0-east"),
  // Down the ramps beside the hall.
  { a: "alchemia-t0-west", b: "alchemia-t1-west", via: { minX: WEST_RAMP.a.x - 3, maxX: WEST_RAMP.a.x + 3, minZ: WEST_RAMP.a.z, maxZ: WEST_RAMP.b.z } },
  { a: "alchemia-t0-east", b: "alchemia-t1-east", via: { minX: EAST_RAMP.a.x - 3, maxX: EAST_RAMP.a.x + 3, minZ: EAST_RAMP.a.z, maxZ: EAST_RAMP.b.z } },
  // The doors in the front: Fumiko's second place on its own (ADR-0093 O3), the hall's way in; the east door's is the gallery's (`mall-nav.ts`).
  ...chain("t1-fumiko", "fumiko-in"),
  ...chain("t1-entrance", "entrance-in", "hall-centre", "hall-aisle", "hall-south", "hall-back", "stair-foot"),
  // The stairs up to the landing, out of the stair house onto the car park.
  { a: "alchemia-stair-foot", b: "alchemia-stair-head", via: { minX: STAIR_HEAD_X, maxX: STAIR.footX, minZ: STAIR.minZ, maxZ: STAIR.maxZ } },
  ...chain("stair-head", "t0-stair"),
];

/**
 * The food hall's graph, P-1's under the car park (stage 4, `parking-nav.ts`), the passage from metro B
 * (stage 10), P-2 (stage 5a, `p2-nav.ts`), the shelter (5d1) and the gallery over the hall (ADR-0093 O1, `mall-nav.ts`).
 */
export const ALCHEMIA_NAV: NavGraph = mergeNav({ nodes: NODES, edges: EDGES }, P1_NAV, METRO_DOOR_NAV, P2_NAV, SHELTER_NAV, MALL_NAV);
