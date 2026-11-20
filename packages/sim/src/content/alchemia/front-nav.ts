import type { NavEdge, NavGraph, NavNode, Rect } from "../builders";
import { groundY } from "../lublin/terrain";
import { EAST_WING, WEST_WING } from "./front";
import { FRONT_FLOORS, GALLERY_FRONT_DOOR, L1E_DOOR, L1_DOORS, L3_DOORS, L3_ROOF_WAY } from "./front-levels";
import { MALL_LEVELS } from "./mall-plan";
import { PLAZA_TOP, PODIUM } from "./front-plaza";

/*
 * The front's storeys in the level graph (ADR-0093 O5, as the gallery's in `mall-nav.ts`): few nodes
 * (every walker on a level asks each one in reach for a line of sight, every step), where a wall hides
 * the way on. L1's wings lie on the street's level (their floors a few steps over it, under 1.5 m:
 * a walker goes straight in, `nav.ts`), so only a node on the square's podium before the arches, one
 * by the west wing's east door (joined to the ramp's top), and one before the east wing's door, joined to T0 (the west wing's north door down to
 * T0's strip by the hall's stair house in the graph drew the car park's chases off the ramp through
 * the wing and the hall, 4 s longer; every node on a level costs every walker there a line of sight
 * a step); L2 from the gallery's door on P2 down its spine to the cross and the café; L3 from the
 * gallery's door on P3 to its hall, west to the aisle down to the south terrace, east out onto the
 * east terrace; L3's roof from the gallery's green roof through the gap in its balustrade.
 */

const F = FRONT_FLOORS;
const L = MALL_LEVELS;
const [W1] = WEST_WING as readonly [Rect, Rect];

const node = (id: string, x: number, y: number, z: number): NavNode => ({ id: `alchemia-${id}`, at: { x, y, z } });
const on = (id: string, x: number, z: number): NavNode => node(id, x, groundY(x, z), z);
const edge = (a: string, b: string, via?: Rect): NavEdge => ({ a: `alchemia-${a}`, b: `alchemia-${b}`, ...(via ? { via } : {}) });

const DOOR_X = (GALLERY_FRONT_DOOR.x0 + GALLERY_FRONT_DOOR.x1) / 2;
const EAST_Z = (L1_DOORS.east.z0 + L1_DOORS.east.z1) / 2;
const L1E_Z = (L1E_DOOR.z0 + L1E_DOOR.z1) / 2;
const SOUTH_X = (L3_DOORS.south.x0 + L3_DOORS.south.x1) / 2;
const EAST3_Z = (L3_DOORS.east.z0 + L3_DOORS.east.z1) / 2;

const NODES: readonly NavNode[] = [
  // L1's west wing: on the square's podium before the arches (NIGHT SILK's and the arcade's doors), inside by its east door,
  // outside past its steps in the passage under L2.
  node("f1-podium", 401.3, PLAZA_TOP, PODIUM.maxZ - 4.6),
  node("f1-east-in", 402.6, F.l1, EAST_Z),
  on("f1-east-out", W1.maxX + 1.6, EAST_Z),
  // L1's east wing: outside its unit's door past its steps (inside, in sight through it, a step up: the street's level).
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
  // From the podium between the arches' piers in by the arcade's door and down its steps.
  edge("f1-podium", "f1-east-in", { minX: L1_DOORS.arcade.x0, maxX: L1_DOORS.arcade.x1, minZ: W1.minZ - 0.2, maxZ: W1.minZ + 1.1 }),
  // In by the east door up its steps, and out south along the passage under the house with arcades to the ramp's top.
  edge("f1-east-in", "f1-east-out", { minX: W1.maxX - 0.2, maxX: W1.maxX + 1.0, minZ: L1_DOORS.east.z0, maxZ: L1_DOORS.east.z1 }),
  // Up the passage's steps onto the square's podium under the arcade and down its south stairs (stairs: a walker on them is on the way).
  edge("f1-east-out", "p1-ramp-west", { minX: PODIUM.minX + 10, maxX: PODIUM.maxX, minZ: PODIUM.minZ - 2.5, maxZ: PODIUM.maxZ + 0.8 }),
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
