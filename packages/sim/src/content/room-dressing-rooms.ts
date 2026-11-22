import { type StreetPropItem, roomDetailShape } from "@seki/core";
import { P2, P2_CORRIDOR, P2_SHELTER_GATE } from "./alchemia/p2";
import { P2_DETAIL } from "./alchemia/p2-detail";
import { SHELTER, SHELTER_HATCH, SHELTER_PASSAGE, SHELTER_PIECES } from "./alchemia/shelter";
import { SHELTER_DETAIL } from "./alchemia/shelter-detail";
import { type DressTaken, type GroundRect, type RoomLayout, dressRoom, rectWalls } from "./room-dressing";
import { W3_OFFICE } from "./tessen-w3/tower-pipes";
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
  bounds: TUNNEL,
  // Open to the store at its south end and to the portal at its north one; the shelter's gate in its east wall.
  surfaces: [],
  walls: rectWalls(TUNNEL, { s: [[TUNNEL.minX, TUNNEL.maxX]], n: [[TUNNEL.minX, TUNNEL.maxX]], e: [[GATE.z0 - 0.3, GATE.z1 + 0.3]] }),
  doors: [
    { minX: TUNNEL.minX, maxX: TUNNEL.maxX, minZ: TUNNEL.maxZ - 0.3, maxZ: TUNNEL.maxZ, weather: true },
    { minX: TUNNEL.maxX - 0.3, maxX: TUNNEL.maxX, minZ: GATE.z0, maxZ: GATE.z1 },
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

export const P2_TUNNEL_DRESSING: readonly StreetPropItem[] = dressRoom(P2_TUNNEL_LAYOUT);
export const TESSEN_OFFICE_DRESSING: readonly StreetPropItem[] = dressRoom(TESSEN_OFFICE_LAYOUT);
export const SHELTER_DRESSING: readonly StreetPropItem[] = dressRoom(SHELTER_LAYOUT);
