import type { NavEdge, NavGraph, NavNode } from "../builders";
import { groundY } from "../lublin/terrain";
import { HALL } from "./plan";
import { P1, P1_HALL_DOOR, P1_RAMP, P1_RAMP_WALK, P1_STAIR, P1_STAIR_HEAD_Z, p1RampY } from "./parking";

/**
 * P-1 in the level graph (ADR-0074 §5, stage 4): it lies under the car park (a vault), so its floor
 * is a level of its own under T0, the hall's floor beside it through the door in the back wall.
 * The ramp's open trench and the stair core's shaft are dug ground (cuts), walled off from the
 * car park round them: the graph says which way up. Walkers keep to the ramp's footway along its
 * east wall, nodes at its top on the car park, at the trench's end and a step under the terrace,
 * and at its foot; the stair core has its foot on P-1, its landing and a step out of its door.
 */

const F = P1.floor;
const OFF = 0.4;
const DOOR = (P1_HALL_DOOR.x0 + P1_HALL_DOOR.x1) / 2;
const STAIR_X = (P1_STAIR.minX + P1_STAIR.maxX) / 2;

const on = (x: number, z: number): { x: number; y: number; z: number } => ({ x, y: groundY(x, z), z });
const onRamp = (z: number): { x: number; y: number; z: number } => ({ x: P1_RAMP_WALK, y: p1RampY(z), z });

const NODES: readonly NavNode[] = [
  // Down the ramp's footway from the car park.
  { id: "alchemia-p1-ramp-top", at: on(P1_RAMP_WALK, P1_RAMP.top - 1.5) },
  // The car park either side of the ramp's top: the trench's parapets stand between them and the footway.
  { id: "alchemia-p1-ramp-west", at: on(P1_RAMP.minX - 1.5, P1_RAMP.top - 1.5) },
  { id: "alchemia-p1-ramp-east", at: on(P1_RAMP.maxX + 1.2, P1_RAMP.top - 1.5) },
  { id: "alchemia-p1-ramp-trench", at: onRamp(P1_RAMP.covered - 1) },
  { id: "alchemia-p1-ramp-covered", at: onRamp(P1_RAMP.covered + 1) },
  { id: "alchemia-p1-ramp-foot", at: { x: P1_RAMP_WALK, y: F, z: P1_RAMP.foot + 1 } },
  // The apron, the deck's aisle, the door to the hall.
  { id: "alchemia-p1-apron", at: { x: 410.5, y: F, z: 27.5 } },
  { id: "alchemia-p1-deck", at: { x: 402, y: F, z: 22.8 } },
  { id: "alchemia-p1-door", at: { x: DOOR, y: F, z: HALL.minZ - 1.2 } },
  { id: "alchemia-p1-door-in", at: { x: DOOR, y: F, z: HALL.minZ + 1.2 } },
  // The stair core by metro B: its foot on P-1, its landing, out of its door onto the car park.
  { id: "alchemia-p1-stair-foot", at: { x: STAIR_X, y: F, z: P1_STAIR.maxZ + OFF + 0.6 } },
  { id: "alchemia-p1-stair-head", at: { x: STAIR_X, y: P1_STAIR.top, z: P1_STAIR_HEAD_Z - OFF } },
  { id: "alchemia-p1-stair-out", at: on(STAIR_X, P1_STAIR.minZ - 1.2) },
  // Round the stair house's corners on the car park: towards metro B and towards the ramp's top.
  { id: "alchemia-p1-stair-east", at: on(P1_STAIR.maxX + 1.2, P1_STAIR.minZ - 1.2) },
];

const chain = (...ids: string[]): NavEdge[] => ids.slice(1).map((b, i) => ({ a: `alchemia-p1-${ids[i]}`, b: `alchemia-p1-${b}` }));

const EDGES: readonly NavEdge[] = [
  { a: "alchemia-p1-ramp-top", b: "alchemia-p1-ramp-trench", via: { minX: P1_RAMP.minX, maxX: P1_RAMP.maxX, minZ: P1_RAMP.top - 2, maxZ: P1_RAMP.covered } },
  ...chain("ramp-trench", "ramp-covered"),
  { a: "alchemia-p1-ramp-covered", b: "alchemia-p1-ramp-foot", via: { minX: P1_RAMP.minX, maxX: P1_RAMP.maxX, minZ: P1_RAMP.covered, maxZ: P1_RAMP.foot + 1 } },
  ...chain("ramp-foot", "apron", "door", "door-in"),
  ...chain("apron", "deck"),
  ...chain("ramp-foot", "stair-foot"),
  { a: "alchemia-p1-stair-foot", b: "alchemia-p1-stair-head", via: { minX: P1_STAIR.minX, maxX: P1_STAIR.maxX, minZ: P1_STAIR_HEAD_Z, maxZ: P1_STAIR.maxZ + 1 } },
  ...chain("stair-head", "stair-out", "stair-east"),
  ...chain("ramp-west", "ramp-top", "ramp-east"),
  // Into the hall at its stairs' foot. On the car park a walker goes on from the ramp's top and the stair core's door by himself.
  { a: "alchemia-p1-door-in", b: "alchemia-stair-foot" },
];

export const P1_NAV: NavGraph = { nodes: NODES, edges: EDGES };
