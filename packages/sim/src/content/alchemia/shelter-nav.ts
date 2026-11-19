import type { NavEdge, NavGraph, NavNode } from "../builders";
import { groundY } from "../lublin/terrain";
import { P2, P2_SHELTER_GATE } from "./p2";
import { T2 } from "./plaza";
import { SHELTER, SHELTER_GATE_STAIR, SHELTER_HATCH, SHELTER_HATCH_HEAD, SHELTER_STAIR_FOOT } from "./shelter";

/**
 * The shelter in the level graph (ADR-0074 §5, stage 5d1): a level of its own under T2 with two
 * ways out. Through the steel gate into P-2's corridor (an edge onto its nodes on either side) and
 * down the gate's flight; and up the hatch's flight onto T2's ground east of it, where a walker goes
 * on by himself. In the room the graph keeps to its west and north sides, round the exhibit.
 */

const F = SHELTER.floor;
const GATE_Z = (P2_SHELTER_GATE.z0 + P2_SHELTER_GATE.z1) / 2;
const STAIR_X = (SHELTER_GATE_STAIR.minX + SHELTER_GATE_STAIR.maxX) / 2;
const HATCH_Z = (SHELTER_HATCH.minZ + SHELTER_HATCH.maxZ) / 2;
const OUT_X = SHELTER_HATCH.maxX + 1.2;

const NODES: readonly NavNode[] = [
  // In P-2's corridor before the gate; on the landing behind it; at the flight's foot in the passage.
  { id: "alchemia-shelter-gate", at: { x: SHELTER_GATE_STAIR.minX - 1.8, y: P2.floor, z: GATE_Z } },
  { id: "alchemia-shelter-landing", at: { x: STAIR_X, y: P2.floor, z: GATE_Z } },
  { id: "alchemia-shelter-stair-foot", at: { x: STAIR_X, y: F, z: SHELTER_STAIR_FOOT + 1.2 } },
  // In the room's south-west corner where the passage comes in, by its west wall, before the hatch's flight.
  { id: "alchemia-shelter-hall", at: { x: STAIR_X, y: F, z: SHELTER.minZ + 2.5 } },
  { id: "alchemia-shelter-room", at: { x: STAIR_X, y: F, z: 93.8 } },
  { id: "alchemia-shelter-hatch-foot", at: { x: SHELTER.maxX - 0.8, y: F, z: HATCH_Z } },
  // On the landing under the hatch, and out on T2.
  { id: "alchemia-shelter-hatch-head", at: { x: (SHELTER_HATCH_HEAD + SHELTER_HATCH.maxX) / 2, y: T2, z: HATCH_Z } },
  { id: "alchemia-shelter-hatch", at: { x: OUT_X, y: groundY(OUT_X, HATCH_Z), z: HATCH_Z } },
];

const chain = (...ids: string[]): NavEdge[] => ids.slice(1).map((b, i) => ({ a: `alchemia-shelter-${ids[i]}`, b: `alchemia-shelter-${b}` }));

const EDGES: readonly NavEdge[] = [
  // Onto P-2's corridor's nodes south and north of the gate.
  { a: "alchemia-shelter-gate", b: "alchemia-p2-corridor" },
  { a: "alchemia-shelter-gate", b: "alchemia-p2-corridor-end" },
  // Through the gate (shut until someone comes up to it): from its doorway both its sides are in reach.
  { a: "alchemia-shelter-gate", b: "alchemia-shelter-landing", via: { minX: SHELTER_GATE_STAIR.minX - P2.wall - 0.6, maxX: SHELTER_GATE_STAIR.minX + 0.6, minZ: P2_SHELTER_GATE.z0, maxZ: P2_SHELTER_GATE.z1 } },
  { a: "alchemia-shelter-landing", b: "alchemia-shelter-stair-foot", via: { minX: SHELTER_GATE_STAIR.minX, maxX: SHELTER_GATE_STAIR.maxX, minZ: SHELTER_GATE_STAIR.minZ, maxZ: SHELTER_STAIR_FOOT + 0.6 } },
  ...chain("stair-foot", "hall", "room", "hatch-foot"),
  { a: "alchemia-shelter-hatch-foot", b: "alchemia-shelter-hatch-head", via: { minX: SHELTER.maxX - 1.2, maxX: SHELTER_HATCH.maxX, minZ: SHELTER_HATCH.minZ, maxZ: SHELTER_HATCH.maxZ } },
  ...chain("hatch-head", "hatch"),
];

export const SHELTER_NAV: NavGraph = { nodes: NODES, edges: EDGES };
