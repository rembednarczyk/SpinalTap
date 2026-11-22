import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { P2, P2_CORRIDOR, P2_SHELTER_GATE } from "./alchemia/p2";
import { P2_DETAIL } from "./alchemia/p2-detail";
import { P1, P1_BAYS, P1_CABINS, P1_CARS, P1_HALL_DOOR, P1_METRO_OPENING, P1_PIECES, P1_RAMP, P1_STAIR_DOWN, P1_STAIR_LINK } from "./alchemia/parking";
import { P1_DETAIL } from "./alchemia/p1-detail";
import { SHELTER, SHELTER_HATCH, SHELTER_PASSAGE, SHELTER_PIECES } from "./alchemia/shelter";
import { SHELTER_DETAIL } from "./alchemia/shelter-detail";
import { type DressTaken, type DressWall, type GroundRect, type RoomLayout, dressRoom, rectWalls } from "./room-dressing";
import { W3_OFFICE } from "./tessen-w3/tower-pipes";
import { W3_HALL_DETAIL } from "./tessen-w3/hall-detail";
import { W3_PALLETS } from "./tessen-w3/hall-inside";
import { AIRLOCK_N_DOOR, AIRLOCK_S_DOOR, AISLE, ARM_BASE, ARMS_X, BELT_L1, BELT_L2, BELT_X, CHAMBER_GATE_W, DOOR_W, HALL_DOORS, STAIR_N_DOOR, TRACK_LADDER } from "./tessen-w3/layout";
import { W3_ASSEMBLY } from "./tessen-w3/site";
import { W3_Y } from "./tessen-w3/site";

/*
 * The rooms the dressing generator of ADR-0099 dresses besides the metro's platforms (`metro-detail.ts`): each a
 * layout of its walls, its doors, what is kept clear and what already stands, and its kit. The things placed by
 * hand (`*-detail.ts`) are taken; the generator stands round them. Pure data.
 */

const inRect = (x: number, z: number, r: GroundRect): boolean => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
/** Things placed by hand inside a room, taken with a footprint round each (its key a hero the clutter may gather round). */
const handTaken = (items: readonly StreetPropItem[], r: GroundRect, half = 0.4): DressTaken[] =>
  items.filter((p) => inRect(p.x, p.z, r)).map((p) => ({ minX: p.x - half, maxX: p.x + half, minZ: p.z - half, maxZ: p.z + half }));

/** Alchemia's tunnel from P-2 to T2 (`docs/pomieszczenia/alchemia-p2-tunnel.md`): its walls between the store and the portal. */
const TUNNEL: GroundRect = { minX: P2_CORRIDOR.minX + P2.wall, maxX: P2_CORRIDOR.maxX - P2.wall, minZ: P2.maxZ, maxZ: P2_CORRIDOR.maxZ - P2.wall };
const GATE = P2_SHELTER_GATE;

export const P2_TUNNEL_LAYOUT: RoomLayout = {
  id: "alchemia-p2-tunnel",
  kind: "service-corridor",
  floor: P2.floor,
  ceiling: P2.ceiling - P2.floor,
  bounds: TUNNEL,
  // Open to the store at its south end and to the portal at its north one; the shelter's gate in its east wall.
  surfaces: [],
  walls: rectWalls(TUNNEL, { s: [[TUNNEL.minX, TUNNEL.maxX]], n: [[TUNNEL.minX, TUNNEL.maxX]], e: [[GATE.z0 - 0.3, GATE.z1 + 0.3]] }),
  doors: [
    { minX: TUNNEL.minX, maxX: TUNNEL.maxX, minZ: TUNNEL.maxZ - 0.3, maxZ: TUNNEL.maxZ, weather: true },
    { minX: TUNNEL.maxX - 0.3, maxX: TUNNEL.maxX, minZ: GATE.z0, maxZ: GATE.z1, top: GATE.top },
    { minX: TUNNEL.minX, maxX: TUNNEL.maxX, minZ: TUNNEL.minZ, maxZ: TUNNEL.minZ + 0.3 },
  ],
  clear: [
    { ...TUNNEL, maxZ: TUNNEL.minZ + 2 },
    { ...TUNNEL, minZ: TUNNEL.maxZ - 1.2 },
    { minX: TUNNEL.maxX - 2, maxX: TUNNEL.maxX, minZ: GATE.z0 - 0.8, maxZ: GATE.z1 + 0.8 },
  ],
  taken: handTaken(P2_DETAIL, TUNNEL),
};

/** Tessen's pass office in W-3's tower (`docs/pomieszczenia/tessen-office.md`): its door in the east wall, z 442-444. */
const OFFICE: GroundRect = { minX: W3_OFFICE.minX, maxX: W3_OFFICE.maxX, minZ: W3_OFFICE.minZ, maxZ: W3_OFFICE.maxZ };
const OFFICE_DOOR: readonly [number, number] = [442, 444];

export const TESSEN_OFFICE_LAYOUT: RoomLayout = {
  id: "tessen-office",
  kind: "office",
  floor: W3_Y,
  bounds: OFFICE,
  surfaces: [],
  walls: rectWalls(OFFICE, { e: [OFFICE_DOOR] }),
  doors: [{ minX: OFFICE.maxX - 0.3, maxX: OFFICE.maxX, minZ: OFFICE_DOOR[0], maxZ: OFFICE_DOOR[1] }],
  clear: [{ minX: OFFICE.maxX - 1.8, maxX: OFFICE.maxX, minZ: OFFICE_DOOR[0] - 0.6, maxZ: OFFICE_DOOR[1] + 0.6 }],
  // The desk along the west wall, the cabinets along the north one, the bench by the door (their solids in
  // `tower-pipes.ts`), the cork board on the south wall.
  taken: [
    { minX: 2486.6, maxX: 2487.8, minZ: 439.5, maxZ: 442.5 },
    { minX: 2489, maxX: 2491, minZ: 444.8, maxZ: 445.4 },
    { minX: 2494.6, maxX: 2495.2, minZ: 437.1, maxZ: 439.3 },
    { minX: 2489.9, maxX: 2491.1, minZ: OFFICE.minZ, maxZ: OFFICE.minZ + 0.3 },
  ],
};

/** The shelter's room under T2 (`docs/pomieszczenia/alchemia-shelter.md`): the passage from P-2's gate comes in at its south-west corner, the hatch's flight at its east wall. */
const ROOM: GroundRect = { minX: SHELTER.minX + SHELTER.wall, maxX: SHELTER.maxX - SHELTER.wall, minZ: SHELTER.minZ + SHELTER.wall, maxZ: SHELTER.maxZ - SHELTER.wall };
const PASSAGE_X: readonly [number, number] = [ROOM.minX, SHELTER_PASSAGE.maxX - SHELTER.wall];
const HATCH_Z: readonly [number, number] = [SHELTER_HATCH.minZ + SHELTER.wall, SHELTER_HATCH.maxZ - SHELTER.wall];
/** The exhibit's solids standing in the room (`exhibitPieces`): benches, the fan, columns, the cases, the photographs' panels. */
const EXHIBIT = new Set(["bench", "machine", "column", "counter", "vitrine", "screen"]);
/** The Hebi's cover crate (`market.ts`, 1 x 1.1 x 2.4 m at 424.6, 92.4): his laptop on it, its top the cluster's. */
const COVER: GroundRect = { minX: 424.1, maxX: 425.1, minZ: 91.2, maxZ: 93.6 };
const COVER_TOP = 1.1;

export const SHELTER_LAYOUT: RoomLayout = {
  id: "alchemia-shelter",
  kind: "shelter",
  floor: SHELTER.floor,
  ceiling: SHELTER.ceiling - SHELTER.floor,
  bounds: ROOM,
  surfaces: [{ ...COVER, top: SHELTER.floor + COVER_TOP, yaw: Math.PI / 2 }],
  walls: rectWalls(ROOM, { s: [PASSAGE_X], e: [HATCH_Z] }),
  doors: [
    { minX: PASSAGE_X[0], maxX: PASSAGE_X[1], minZ: ROOM.minZ, maxZ: ROOM.minZ + 0.3 },
    { minX: ROOM.maxX - 0.3, maxX: ROOM.maxX, minZ: HATCH_Z[0], maxZ: HATCH_Z[1] },
  ],
  clear: [
    // The ways in, the boot prints' path from the passage up the west wall, the stash in the north-west corner.
    { minX: PASSAGE_X[0], maxX: PASSAGE_X[1] + 0.6, minZ: ROOM.minZ, maxZ: ROOM.minZ + 1.8 },
    { minX: ROOM.maxX - 1.8, maxX: ROOM.maxX, minZ: HATCH_Z[0] - 0.6, maxZ: HATCH_Z[1] + 0.6 },
    { minX: ROOM.minX, maxX: ROOM.minX + 1.4, minZ: ROOM.minZ, maxZ: ROOM.maxZ },
    { minX: ROOM.minX, maxX: ROOM.minX + 2.6, minZ: ROOM.maxZ - 2.2, maxZ: ROOM.maxZ },
  ],
  taken: [
    ...SHELTER_PIECES.filter((p) => EXHIBIT.has(p.kind) && inRect((p.box.x0 + p.box.x1) / 2, (p.box.z0 + p.box.z1) / 2, ROOM)).map((p) => ({ minX: p.box.x0, maxX: p.box.x1, minZ: p.box.z0, maxZ: p.box.z1 })),
    COVER,
    // The crate that takes a body (`market.ts`, 1.6 x 1.4 m at 433.6, 88.0), up to the wall behind it: 1.4 m high, it hides what hangs there.
    { minX: 432.8, maxX: ROOM.maxX, minZ: 87.3, maxZ: 88.7 },
    ...handTaken(SHELTER_DETAIL.filter((p) => p.variant !== roomDetailShape("rd-shelter-hebi")), ROOM),
    // The Hebi's laptop on the crate: the hero his bottles and his cup gather round.
    { minX: 424.3, maxX: 424.9, minZ: 92.1, maxZ: 92.7, key: "rd-shelter-hebi", onTop: true },
  ],
};

/**
 * Alchemia's P-1 (`docs/pomieszczenia/alchemia-parking.md`): the deck of bays west of the ramp and the apron at its foot
 * with the hand-over cabins, one room to the walls' faces; the ramp and the stair core's ways out of it kept clear.
 */
const P1W = P1.wall;
const DECK: GroundRect = { minX: P1.minX + P1W, maxX: P1.maxX - P1W, minZ: P1.minZ + P1W, maxZ: P1.maxZ };
const RAMP_WEST = P1_RAMP.minX - P1W;
/** A parked car's footprint (the game's sedans, hatchbacks, vans and taxis, nose to the wall). */
const CAR_HALF = { long: 2.45, wide: 1.05 };
const cars: DressTaken[] = P1_CARS.map((c) => {
  const [hx, hz] = Math.abs(Math.sin(c.yaw)) > 0.5 ? [CAR_HALF.long, CAR_HALF.wide] : [CAR_HALF.wide, CAR_HALF.long];
  return { minX: c.x - hx, maxX: c.x + hx, minZ: c.z - hz, maxZ: c.z + hz };
});
/** The bays nobody parked in: their middles, short of the charger at a head, open floor for a puddle. */
const EMPTY_BAYS: GroundRect[] = P1_BAYS.filter((b) => !P1_CARS.some((c) => Math.abs(c.z - b.at.z) < 1 && Math.abs(c.x - b.at.x) < 1.5)).map((b) => ({
  minX: b.at.x - 1.6,
  maxX: b.at.x + 1.6,
  minZ: b.at.z - 0.8,
  maxZ: b.at.z + 0.8,
}));
const wall = (ax: number, az: number, bx: number, bz: number, ix: number, iz: number): DressWall => ({ a: { x: ax, z: az }, b: { x: bx, z: bz }, inward: { x: ix, z: iz } });
/** The fittings standing in P-1 (`fittingPieces`): the chargers, the columns, the pay machine and the console. */
const P1_FITTINGS = new Set(["charger", "column", "machine"]);
const APRON_Z = P1_RAMP.foot;

export const P1_LAYOUT: RoomLayout = {
  id: "alchemia-parking",
  kind: "car-park",
  floor: P1.floor,
  ceiling: P1.ceiling - P1.floor,
  bounds: DECK,
  surfaces: [],
  walls: [
    wall(DECK.minX, DECK.minZ, DECK.minX, DECK.maxZ, 1, 0),
    wall(DECK.minX, DECK.minZ, RAMP_WEST, DECK.minZ, 0, 1),
    wall(RAMP_WEST, DECK.minZ, RAMP_WEST, APRON_Z, -1, 0),
    // The in-cabin's south wall, facing the deck's north end (its shutter east, to the apron).
    wall(P1_CABINS[0]!.minX, P1_CABINS[0]!.minZ, P1_CABINS[0]!.maxX - 0.3, P1_CABINS[0]!.minZ, 0, -1),
    ...rectWalls(DECK, { n: [[P1_HALL_DOOR.x0, P1_HALL_DOOR.x1]] }).filter((w) => w.inward.z === -1),
    wall(DECK.maxX, APRON_Z, DECK.maxX, P1_METRO_OPENING.minZ, -1, 0),
    wall(DECK.maxX, P1_METRO_OPENING.maxZ, DECK.maxX, DECK.maxZ, -1, 0),
  ],
  doors: [
    { minX: P1_HALL_DOOR.x0, maxX: P1_HALL_DOOR.x1, minZ: DECK.maxZ - 0.3, maxZ: DECK.maxZ, top: P1_HALL_DOOR.top },
    { minX: DECK.maxX - 0.3, maxX: DECK.maxX, minZ: P1_METRO_OPENING.minZ, maxZ: P1_METRO_OPENING.maxZ },
    { minX: P1_STAIR_LINK.minX, maxX: DECK.maxX, minZ: APRON_Z - 0.3, maxZ: APRON_Z, inward: { x: 0, z: 1 } },
  ],
  open: EMPTY_BAYS,
  clear: [
    // The ramp and what lies east of it short of the apron; the deck's aisle; the apron where the cars turn.
    { minX: RAMP_WEST, maxX: DECK.maxX, minZ: DECK.minZ, maxZ: APRON_Z },
    { minX: P1_BAYS[0]!.at.x + 2.5, maxX: P1_BAYS[13]!.at.x - 2.5, minZ: DECK.minZ, maxZ: P1_CABINS[0]!.minZ },
    { minX: P1_CABINS[0]!.maxX, maxX: P1_STAIR_DOWN.maxX, minZ: APRON_Z, maxZ: P1_STAIR_DOWN.minZ },
    // The ways to the hall's door, to metro B's passage and from the stair core's link.
    { minX: P1_HALL_DOOR.x0 - 0.6, maxX: P1_HALL_DOOR.x1 + 0.6, minZ: DECK.maxZ - 1.8, maxZ: DECK.maxZ },
    { minX: DECK.maxX - 2.5, maxX: DECK.maxX, minZ: P1_METRO_OPENING.minZ - 0.5, maxZ: P1_METRO_OPENING.maxZ + 0.5 },
    { minX: P1_STAIR_LINK.minX, maxX: DECK.maxX, minZ: APRON_Z, maxZ: P1_METRO_OPENING.minZ },
    P1_STAIR_DOWN,
  ],
  taken: [
    ...cars,
    ...P1_CABINS,
    ...P1_PIECES.filter((p) => P1_FITTINGS.has(p.kind)).map((p) => ({ minX: p.box.x0, maxX: p.box.x1, minZ: p.box.z0, maxZ: p.box.z1 })),
    ...handTaken(P1_DETAIL.filter((p) => p.y < P1.floor + 2), DECK),
  ],
};

/**
 * Tessen's W-3 assembly hall (`docs/pomieszczenia/w3-hall.md`): its floor between the walls' faces, the line's belts with
 * the arms' bases and the stations taken, the aisle between them kept for the wagon and the walkers; things stand by the
 * long walls' strips and the west wall, oil pools by the arms' bases on the walls' side.
 */
const HALL_IN: GroundRect = { minX: W3_ASSEMBLY.minX + 0.3, maxX: W3_ASSEMBLY.maxX - 0.3, minZ: W3_ASSEMBLY.minZ + 0.3, maxZ: W3_ASSEMBLY.maxZ - 0.3 };
const ARM = ARM_BASE.size;
const WEST_DOORS: readonly (readonly [number, number])[] = [
  [AIRLOCK_S_DOOR - DOOR_W / 2, AIRLOCK_S_DOOR + DOOR_W / 2],
  [413.1, 422.9],
  [AIRLOCK_N_DOOR - DOOR_W / 2, AIRLOCK_N_DOOR + DOOR_W / 2],
  [STAIR_N_DOOR.z - STAIR_N_DOOR.width / 2, STAIR_N_DOOR.z + STAIR_N_DOOR.width / 2],
];
const NORTH_DOORS: readonly (readonly [number, number])[] = HALL_DOORS.map((x) => [x - DOOR_W / 2, x + DOOR_W / 2] as const);
const CHAMBER_GATE: readonly [number, number] = [CHAMBER_GATE_W.minZ, CHAMBER_GATE_W.maxZ];

export const W3_HALL_LAYOUT: RoomLayout = {
  id: "w3-hall",
  kind: "assembly-hall",
  floor: W3_Y,
  bounds: HALL_IN,
  surfaces: [],
  walls: rectWalls(HALL_IN, { w: WEST_DOORS, n: NORTH_DOORS, e: [CHAMBER_GATE] }),
  doors: [
    ...WEST_DOORS.map(([a, b]) => ({ minX: HALL_IN.minX, maxX: HALL_IN.minX + 0.3, minZ: a, maxZ: b })),
    ...NORTH_DOORS.map(([a, b]) => ({ minX: a, maxX: b, minZ: HALL_IN.maxZ - 0.3, maxZ: HALL_IN.maxZ })),
    { minX: HALL_IN.maxX - 0.3, maxX: HALL_IN.maxX, minZ: CHAMBER_GATE[0], maxZ: CHAMBER_GATE[1] },
  ],
  // Oil under the arms' bases: a patch on each one's walls' side, short of the walls' strips' things.
  open: ARMS_X.flatMap((x) => [
    { minX: x - ARM, maxX: x + ARM, minZ: BELT_L1.minZ - 0.1 - ARM - 1.1, maxZ: BELT_L1.minZ - 0.1 - ARM },
    { minX: x - ARM, maxX: x + ARM, minZ: BELT_L2.maxZ + 0.1 + ARM, maxZ: BELT_L2.maxZ + 0.1 + ARM + 0.9 },
  ]),
  clear: [
    { minX: HALL_IN.minX, maxX: HALL_IN.maxX, minZ: AISLE.minZ, maxZ: AISLE.maxZ },
    ...WEST_DOORS.map(([a, b]) => ({ minX: HALL_IN.minX, maxX: HALL_IN.minX + 2, minZ: a - 0.6, maxZ: b + 0.6 })),
    ...NORTH_DOORS.map(([a, b]) => ({ minX: a - 0.6, maxX: b + 0.6, minZ: HALL_IN.maxZ - 2, maxZ: HALL_IN.maxZ })),
    { minX: HALL_IN.maxX - 2, maxX: HALL_IN.maxX, minZ: CHAMBER_GATE[0] - 0.6, maxZ: CHAMBER_GATE[1] + 0.6 },
    // The ladder up to track N's walk, and its foot.
    { minX: TRACK_LADDER.x - 0.9, maxX: TRACK_LADDER.x + 0.9, minZ: TRACK_LADDER.z - 1.4, maxZ: HALL_IN.maxZ },
  ],
  taken: [
    // The belts with the arms' bases on their walls' sides, the stations on the aisle's.
    { minX: BELT_X.minX, maxX: BELT_X.maxX, minZ: BELT_L1.minZ - 0.1 - ARM, maxZ: BELT_L1.maxZ + 0.5 },
    { minX: BELT_X.minX, maxX: BELT_X.maxX, minZ: BELT_L2.minZ - 0.5, maxZ: BELT_L2.maxZ + 0.1 + ARM },
    ...W3_PALLETS,
    ...handTaken(W3_HALL_DETAIL.filter((p) => p.y < W3_Y + 3), HALL_IN, 0.7),
  ],
};

export const P2_TUNNEL_DRESSING: readonly StreetPropItem[] = dressRoom(P2_TUNNEL_LAYOUT);
export const TESSEN_OFFICE_DRESSING: readonly StreetPropItem[] = dressRoom(TESSEN_OFFICE_LAYOUT);
export const SHELTER_DRESSING: readonly StreetPropItem[] = dressRoom(SHELTER_LAYOUT);
export const P1_DRESSING: readonly StreetPropItem[] = dressRoom(P1_LAYOUT);
export const W3_HALL_DRESSING: readonly StreetPropItem[] = dressRoom(W3_HALL_LAYOUT);
