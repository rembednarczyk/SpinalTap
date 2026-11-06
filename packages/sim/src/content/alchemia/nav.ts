import type { NavEdge, NavGraph, NavNode } from "../builders";
import { groundY } from "../lublin/terrain";
import { STAIR, STAIR_HEAD_X, opening } from "./foodhall";
import { HALL } from "./plan";
import { OYAJI_BACK_DOOR, OYAJI_BACK_ROOM } from "./units";
import { EAST_RAMP, WEST_RAMP } from "./terraces";

/**
 * Alchemia in the level graph (ADR-0074 §5, stage 1; as the metro's, #316): the food hall is dug
 * into the slope (a `GroundCut`), so its floor and its roof are levels of their own, apart from
 * the terraces round it at any height; the graph says which way in and up. Nodes stand a step
 * outside and inside each door, a step off both ends of the stairs and on the roof's south edge.
 * The terraces T0 and T1 and their ramps are one floor of the terrain: their nodes are linked
 * along the ramps only so that a way from the roof or the hall goes on to the other terrace.
 * Inside the hall an NPC walks round the tables and units itself. The lift is the player's.
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
  { id: "alchemia-t1-oyaji", at: on(mid("oyaji-door"), OUT) },
  { id: "alchemia-t1-east", at: on(EAST_RAMP.b.x, OUT) },
  // T0, along the car park by the back wall.
  { id: "alchemia-t0-west", at: on(WEST_RAMP.a.x, HALL.minZ - 1.2) },
  { id: "alchemia-t0-stair", at: on(401.8, HALL.minZ - 1.2) },
  { id: "alchemia-t0-roof", at: on(420, HALL.minZ - 1.2) },
  { id: "alchemia-t0-east", at: on(EAST_RAMP.a.x, HALL.minZ - 1.2) },
  // The hall's floor.
  { id: "alchemia-fumiko-in", at: { x: mid("fumiko-door"), y: F, z: IN } },
  { id: "alchemia-entrance-in", at: { x: mid("entrance"), y: F, z: IN } },
  { id: "alchemia-hall-centre", at: { x: 418, y: F, z: 50 } },
  { id: "alchemia-hall-aisle", at: { x: 418, y: F, z: 40.2 } },
  { id: "alchemia-hall-back", at: { x: 411.3, y: F, z: 38.8 } },
  { id: "alchemia-oyaji-in", at: { x: mid("oyaji-door"), y: F, z: IN } },
  // Oyaji's back room, then his shop behind the armoured counter through the door at its east end.
  { id: "alchemia-oyaji-back", at: { x: (OYAJI_BACK_DOOR.minX + OYAJI_BACK_DOOR.maxX) / 2, y: F, z: OYAJI_BACK_ROOM.minZ + 0.9 } },
  { id: "alchemia-oyaji-shop", at: { x: (OYAJI_BACK_DOOR.minX + OYAJI_BACK_DOOR.maxX) / 2, y: F, z: OYAJI_BACK_ROOM.minZ - 1.2 } },
  // The stairs and the roof.
  { id: "alchemia-stair-foot", at: { x: STAIR.footX + OFF, y: F, z: (STAIR.minZ + STAIR.maxZ) / 2 } },
  { id: "alchemia-stair-head", at: { x: STAIR_HEAD_X - OFF, y: R, z: (STAIR.minZ + STAIR.maxZ) / 2 } },
  { id: "alchemia-roof-south", at: { x: 420, y: R, z: HALL.minZ + 1.2 } },
  { id: "alchemia-roof-north", at: { x: 419, y: R, z: HALL.maxZ - 3 } },
];

const chain = (...ids: string[]): NavEdge[] => ids.slice(1).map((b, i) => ({ a: `alchemia-${ids[i]}`, b: `alchemia-${b}` }));

const EDGES: readonly NavEdge[] = [
  ...chain("t1-west", "t1-fumiko", "t1-entrance", "t1-oyaji", "t1-east"),
  ...chain("t0-west", "t0-stair", "t0-roof", "t0-east"),
  // Down the ramps beside the hall.
  { a: "alchemia-t0-west", b: "alchemia-t1-west", via: { minX: WEST_RAMP.a.x - 3, maxX: WEST_RAMP.a.x + 3, minZ: WEST_RAMP.a.z, maxZ: WEST_RAMP.b.z } },
  { a: "alchemia-t0-east", b: "alchemia-t1-east", via: { minX: EAST_RAMP.a.x - 3, maxX: EAST_RAMP.a.x + 3, minZ: EAST_RAMP.a.z, maxZ: EAST_RAMP.b.z } },
  // The doors in the front: Fumiko's bar on its own, the hall's way in, Oyaji's back door.
  ...chain("t1-fumiko", "fumiko-in"),
  ...chain("t1-entrance", "entrance-in", "hall-centre", "hall-aisle", "hall-back", "stair-foot"),
  ...chain("t1-oyaji", "oyaji-in", "oyaji-back", "oyaji-shop"),
  // The stairs up to the landing, out of the stair house onto the car park.
  { a: "alchemia-stair-foot", b: "alchemia-stair-head", via: { minX: STAIR_HEAD_X, maxX: STAIR.footX, minZ: STAIR.minZ, maxZ: STAIR.maxZ } },
  ...chain("stair-head", "t0-stair"),
  // Onto the green roof from the car park.
  ...chain("t0-roof", "roof-south", "roof-north"),
];

export const ALCHEMIA_NAV: NavGraph = { nodes: NODES, edges: EDGES };
