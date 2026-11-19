import type { NavEdge, NavGraph, NavNode } from "../builders";
import { groundY } from "../lublin/terrain";
import { P1 } from "./parking";
import { P2, P2_ANNEX, P2_CORRIDOR, P2_CUTTING, P2_STAIR } from "./p2";

/**
 * P-2 in the level graph (ADR-0074 §5, stage 5a): a level of its own under P-1 (in the same vault,
 * its ground under P-2's floor), with two ways out. Up the flight to P-1's apron by the food hall's
 * door; and north along the corridor and out of its portal through the cutting onto T2's ground,
 * where a walker goes on by himself. In the store an NPC walks round the racks himself: the graph
 * has a node in its service aisle.
 */

const F = P2.floor;
const STAIR_Z = (P2_STAIR.minZ + P2_STAIR.maxZ) / 2;
/** In the annex east of the flight's foot, and the corridor's axis. */
const FOOT_X = (P2_STAIR.maxX + P2_ANNEX.maxX - P2.wall) / 2;
const AXIS_X = (P2_CORRIDOR.minX + P2_CORRIDOR.maxX) / 2;

const NODES: readonly NavNode[] = [
  // On P-1's apron at the flight's head (by the hall's door); at its foot in the annex.
  { id: "alchemia-p2-stair-head", at: { x: P2_STAIR.minX - 1, y: P1.floor, z: STAIR_Z } },
  { id: "alchemia-p2-stair-foot", at: { x: FOOT_X, y: F, z: STAIR_Z } },
  // The store's service aisle along its east wall.
  { id: "alchemia-p2-aisle", at: { x: 416, y: F, z: 20 } },
  // Along the corridor to its portal, through the cutting onto T2.
  { id: "alchemia-p2-corridor", at: { x: FOOT_X, y: F, z: P2_CORRIDOR.minZ + 2 } },
  { id: "alchemia-p2-corridor-end", at: { x: AXIS_X, y: F, z: P2_CORRIDOR.maxZ - 1.5 } },
  { id: "alchemia-p2-cutting", at: { x: AXIS_X, y: F, z: P2_CORRIDOR.maxZ + 2 } },
  { id: "alchemia-p2-mouth", at: { x: AXIS_X, y: groundY(AXIS_X, P2_CUTTING.maxZ + 1.5), z: P2_CUTTING.maxZ + 1.5 } },
];

const chain = (...ids: string[]): NavEdge[] => ids.slice(1).map((b, i) => ({ a: `alchemia-p2-${ids[i]}`, b: `alchemia-p2-${b}` }));

const EDGES: readonly NavEdge[] = [
  // From P-1's door to the hall onto the flight's head, and down it.
  { a: "alchemia-p2-stair-head", b: "alchemia-p1-door" },
  { a: "alchemia-p2-stair-head", b: "alchemia-p2-stair-foot", via: { minX: P2_STAIR.minX - 1.2, maxX: P2_STAIR.maxX + 0.8, minZ: P2_STAIR.minZ, maxZ: P2_STAIR.maxZ } },
  ...chain("stair-foot", "aisle"),
  ...chain("stair-foot", "corridor", "corridor-end", "cutting", "mouth"),
];

export const P2_NAV: NavGraph = { nodes: NODES, edges: EDGES };
