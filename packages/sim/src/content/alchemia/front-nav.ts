import type { NavEdge, NavGraph, NavNode, Rect } from "../builders";
import { groundY } from "../lublin/terrain";
import { EAST_WING, WEST_WING } from "./front";
import { FRONT_FLOORS, GALLERY_FRONT_DOOR, L1E_DOOR, L1_DOORS, L3_DOORS, L3_ROOF_WAY } from "./front-levels";
import { PLAZA_TOP } from "./front-plaza";
import { MALL_LEVELS } from "./mall-plan";

/*
 * The front's storeys in the level graph (ADR-0093 O5, as the gallery's in `mall-nav.ts`): few nodes
 * (every walker on a level asks each one in reach for a line of sight, every step), where a wall hides
 * the way on. L1's west wing from the arcade's podium through its arcade to its east door and down its
 * north flight to T0's strip by the hall's stair house; its east wing's door from the walk to
 * Lubartowska; L2 from the gallery's door on P2 down its spine to the cross and the café; L3 from the
 * gallery's door on P3 to its hall, west to the aisle down to the south terrace, east out onto the
 * east terrace; L3's roof from the gallery's green roof through the gap in its balustrade.
 */

const F = FRONT_FLOORS;
const L = MALL_LEVELS;
const [W1, W2] = WEST_WING as readonly [Rect, Rect];

const node = (id: string, x: number, y: number, z: number): NavNode => ({ id: `alchemia-${id}`, at: { x, y, z } });
const on = (id: string, x: number, z: number): NavNode => node(id, x, groundY(x, z), z);
const edge = (a: string, b: string, via?: Rect): NavEdge => ({ a: `alchemia-${a}`, b: `alchemia-${b}`, ...(via ? { via } : {}) });

const DOOR_X = (GALLERY_FRONT_DOOR.x0 + GALLERY_FRONT_DOOR.x1) / 2;
const ARCADE_X = (L1_DOORS.arcade.x0 + L1_DOORS.arcade.x1) / 2;
const EAST_Z = (L1_DOORS.east.z0 + L1_DOORS.east.z1) / 2;
const NORTH_X = (L1_DOORS.north.x0 + L1_DOORS.north.x1) / 2;
const L1E_Z = (L1E_DOOR.z0 + L1E_DOOR.z1) / 2;
const SOUTH_X = (L3_DOORS.south.x0 + L3_DOORS.south.x1) / 2;
const EAST3_Z = (L3_DOORS.east.z0 + L3_DOORS.east.z1) / 2;

const NODES: readonly NavNode[] = [
  // L1's west wing: on the arcade's podium before its door, inside by its east door and its north door, outside past its east steps.
  node("f1-arcade-out", ARCADE_X, PLAZA_TOP, W1.minZ - 1.0),
  node("f1-east-in", 402.6, F.l1, EAST_Z),
  on("f1-east-out", W1.maxX + 1.6, EAST_Z),
  node("f1-north-in", NORTH_X, F.l1, W2.maxZ - 1.0),
  // L1's east wing: inside its unit's door and outside past its step.
  node("f1e-in", EAST_WING.maxX - 1.4, F.l1e, L1E_Z),
  on("f1e-out", EAST_WING.maxX + 1.4, L1E_Z),
  // L2: on P2 in the passage before the door, in the spine at the cross arcade (south of its benches) and before the café.
  node("f2-door-n", DOOR_X, L.p2, 34.4),
  node("f2-cross", DOOR_X, F.l2, 18.6),
  node("f2-cafe", 418.6, F.l2, 7.6),
  // L3: on P3 before the door, in its hall, west on the cross aisle over the aisle to the south door, out on both terraces.
  node("f3-door-n", DOOR_X, L.p3, 34.6),
  node("f3-hall", DOOR_X, F.l3, 24.4),
  node("f3-mid-w", SOUTH_X, F.l3, 24.0),
  node("f3-south-out", SOUTH_X, F.l3, 10.4),
  node("f3-east-out", 430.0, F.l3, EAST3_Z),
  // L3's roof: by the gap in the gallery's roof balustrade, and in the gallery's south pergola beyond it.
  node("fr-l3-way", (L3_ROOF_WAY.x0 + L3_ROOF_WAY.x1) / 2, L.roof, 31.0),
  node("gr-pergola-s", 423.6, L.roof, 35.5),
];

const EDGES: readonly NavEdge[] = [
  // In by the arcade's door, down its steps (a walker on them is on the way).
  edge("f1-arcade-out", "f1-east-in", { minX: L1_DOORS.arcade.x0, maxX: L1_DOORS.arcade.x1, minZ: W1.minZ - 0.2, maxZ: W1.minZ + 1.1 }),
  edge("f1-east-in", "f1-east-out", { minX: W1.maxX - 0.2, maxX: W1.maxX + 1.0, minZ: L1_DOORS.east.z0, maxZ: L1_DOORS.east.z1 }),
  edge("f1-east-in", "f1-north-in"),
  // Down the north flight onto T0's strip before the hall's stair house.
  // The way's rect reaches back over the node inside: a walker that has just reached it is on the way, not hunting round it.
  edge("f1-north-in", "t0-stair", { minX: L1_DOORS.north.x0, maxX: L1_DOORS.north.x1, minZ: W2.maxZ - 1.3, maxZ: W2.maxZ + 2.2 }),
  edge("f1e-in", "f1e-out", { minX: EAST_WING.maxX - 0.2, maxX: EAST_WING.maxX + 0.7, minZ: L1E_DOOR.z0, maxZ: L1E_DOOR.z1 }),
  edge("f1e-out", "t0-east"),
  // From the gallery's south side on P2 through the passage and the door down the spine.
  edge("g2-s", "f2-door-n"),
  edge("f2-door-n", "f2-cross"),
  edge("f2-cross", "f2-cafe"),
  // From the food hall's south side on P3 through the door into L3, out onto the terraces.
  edge("g3-s", "f3-door-n"),
  edge("f3-door-n", "f3-hall"),
  edge("f3-hall", "f3-mid-w"),
  edge("f3-mid-w", "f3-south-out"),
  edge("f3-hall", "f3-east-out"),
  // From the green roof's ring through the south pergola onto L3's roof.
  edge("gr-se", "gr-pergola-s"),
  edge("gr-pergola-s", "fr-l3-way"),
];

/** The front's graph, joined to the gallery's (`mall-nav.ts`) and the hall's (`nav.ts`) at T0's and the floors' nodes. */
export const FRONT_NAV: NavGraph = { nodes: NODES, edges: EDGES };
