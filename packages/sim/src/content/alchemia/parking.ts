import type { GroundPoint, ViewDescriptor } from "@seki/core";
import type { GroundCut } from "../../world/ground";
import type { GroundVault } from "../../world/vault";
import type { Rect, StaticProp } from "../builders";
import { groundY } from "../lublin/terrain";
import { type Box, HALL, type Piece, box, piece } from "./plan";

/**
 * The upper level of Alchemia's car park, P-1 (ADR-0074 §1 and §4, stage 4), under T0 south of
 * the food hall: a room in the ground (a `GroundVault`, as a metro platform), so the car park over
 * it stays the map's ground for everybody on it and nothing of it shows from the street. Its floor
 * is the hall's (-6.4): a door in the hall's back wall, by Sachiko's kiosk, opens on it level.
 *
 * Cars come down from Bajkowskiego where the car park's driveway is (414; -7) by a two-way ramp
 * going north along its middle, open to the sky in a walled trench (a `GroundCut`) as far as the
 * ground over it leaves headroom, then under the terrace down to an apron at its foot. There they
 * drive into one of two hand-over cabins of the automated garage on the west (the robots of P-2,
 * stage 5, take them from there) and come out of the other. West of the ramp a deck of bays with
 * chargers along its west wall; east of it a stair core up to T0 by metro B's pavilion. Walkers
 * use the ramp on its east side, along the wall. The walls keep 2 m off metro B's shaft and hall.
 */

/** P-1: its outline (outer faces), walls, floor and ceiling (its underside), the ceiling's slab. */
export const P1 = { minX: 394, maxX: 422, minZ: 2, maxZ: HALL.minZ, wall: 0.3, floor: HALL.floor, ceiling: HALL.floor + 2.7, slab: 0.3 } as const;
const F = P1.floor;
const C = P1.ceiling;
const W = P1.wall;

/**
 * The ramp: between its walls from x 410 to 418, its top level with the car park's ground at z
 * -5.5, its foot on P-1's floor at z 24.5 (5.4 m over 30 m, 18%). Two lanes, down on the east and up
 * on the west (keep right), a footway along its east wall from `walk`. Open over it up to
 * `covered`, where the ground over its ceiling's slab is deep enough.
 */
export const P1_RAMP = {
  minX: 410,
  maxX: 418,
  walk: 416.5,
  top: -5.5,
  foot: 24.5,
  yTop: Math.round(groundY(414, -5.5) * 100) / 100,
  covered: 12,
  /** Headroom over the ramp under its stepped ceiling. */
  headroom: 2.2,
} as const;

/** The ramp's surface at z (clamped to its ends). */
export const p1RampY = (z: number): number => {
  const r = P1_RAMP;
  const t = Math.max(0, Math.min(1, (z - r.top) / (r.foot - r.top)));
  return r.yTop + (F - r.yTop) * t;
};

/** Its grade: rise over run. */
export const P1_RAMP_GRADE = (P1_RAMP.yTop - F) / (P1_RAMP.foot - P1_RAMP.top);

/**
 * The stair core by metro B (ADR-0074 §4, the second one): a straight flight rising south from
 * P-1's floor to a landing level with T0, in a shaft dug to its foot under a stair house on the
 * car park, its door south onto it. Its foot opens north onto P-1.
 */
const STAIR_TOP = Math.round(groundY(420, 11.6) * 100) / 100;
export const P1_STAIR = { minX: 418.3, maxX: 421.7, minZ: 12.4, maxZ: 22.6, wall: 0.2, risers: 28, going: 0.28, top: STAIR_TOP, house: 2.6, door: { x0: 419.3, x1: 420.7, top: 2.3 } } as const;
export const P1_STAIR_RISE = (P1_STAIR.top - F) / P1_STAIR.risers;
/** The south end of the flight's last tread: the landing's north edge. */
export const P1_STAIR_HEAD_Z = P1_STAIR.maxZ - (P1_STAIR.risers - 1) * P1_STAIR.going;

/** The door in the food hall's back wall onto P-1, by Sachiko's kiosk, at the foot of the hall's stairs. */
export const P1_HALL_DOOR = { x0: 410.5, x1: 412.2, top: 2.3 } as const;

/** The two hand-over cabins on the apron's west, their doors east to it: in (south) and out (north). */
export const P1_CABINS: readonly Rect[] = [
  { minX: 398, maxX: 404, minZ: 25.0, maxZ: 28.2 },
  { minX: 398, maxX: 404, minZ: 28.4, maxZ: 31.6 },
];
const CABIN_WALL = 0.2;
const CABIN_ROOF = 2.5;

/** The bays: two rows of 2.5 m either side of the deck's aisle, from z 3.5, nose to the walls. */
const BAY = { width: 2.5, depth: 5, rows: [{ x0: P1.minX + W, x1: P1.minX + W + 5, yaw: -Math.PI / 2 }, { x0: P1_RAMP.minX - W - 5, x1: P1_RAMP.minX - W, yaw: Math.PI / 2 }], from: 3.5, count: 7 } as const;
/** The bays along the west wall with a charger at their head. */
const CHARGED = 4;

/** The middle of each bay, the way a car in it faces (its nose to the wall), and whether it has a charger. */
export const P1_BAYS: readonly { readonly at: GroundPoint; readonly yaw: number; readonly charger: boolean }[] = BAY.rows.flatMap((row, r) =>
  Array.from({ length: BAY.count }, (_, i) => ({ at: { x: (row.x0 + row.x1) / 2, z: BAY.from + (i + 0.5) * BAY.width }, yaw: row.yaw, charger: r === 0 && i < CHARGED })),
);

/** Which bays have a car in them, and which model (fixed content: the robots park them). */
const TAKEN: readonly (readonly [number, "sedan" | "hatchback" | "van" | "taxi"])[] = [
  [0, "hatchback"],
  [1, "sedan"],
  [3, "hatchback"],
  [4, "van"],
  [5, "sedan"],
  [7, "sedan"],
  [8, "hatchback"],
  [10, "taxi"],
  [11, "sedan"],
  [13, "hatchback"],
];

export interface P1Car {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly yaw: number;
  readonly model: "sedan" | "hatchback" | "van" | "taxi";
  readonly tint: number;
}

/** A car stands this far out of its bay's middle, away from the wall at its nose (a charger's room). */
const OFF_WALL = 0.35;

/** The cars standing in the bays, on P-1's floor. */
export const P1_CARS: readonly P1Car[] = TAKEN.map(([i, model], k) => {
  const b = P1_BAYS[i]!;
  return { x: b.at.x - Math.sin(b.yaw) * OFF_WALL, y: F, z: b.at.z, yaw: b.yaw, model, tint: 7919 * (k + 3) };
});

/** The view of a car on P-1: drawn by the scenery, as a parked car. */
export const p1CarView = (c: P1Car): ViewDescriptor => ({ kind: "vehicle", model: c.model, tint: c.tint, parked: true });

/** The pay machine by the hall's door and the console by the cabins (where the attendant stands). */
export const P1_PAY: Box = box(408.4, 409.2, P1.maxZ - 0.55, P1.maxZ - 0.05, F, F + 1.6);
export const P1_CONSOLE: Box = box(404.5, 405.1, 28.0, 28.9, F, F + 1.2);

/** The ground dug out over the ramp's open part and under the stair core. */
export const P1_RAMP_CUT: GroundCut = { bounds: { minX: P1_RAMP.minX - W, maxX: P1_RAMP.maxX + W, minZ: P1_RAMP.top, maxZ: P1_RAMP.covered }, floor: Math.round((p1RampY(P1_RAMP.covered) - 1) * 100) / 100 };
export const P1_STAIR_CUT: GroundCut = { bounds: { minX: P1_STAIR.minX, maxX: P1_STAIR.maxX, minZ: P1_STAIR.minZ, maxZ: P1_STAIR.maxZ }, floor: F - 1 };

/**
 * P-1 in the ground: feet deep under the car park stand on its solids (`VAULT_COVER`). Its ground
 * lies 2 m under the floor's slab, as a metro platform's under its track bed: a body on the floor
 * is raised over the ground (`LEVEL_GAP`), so an NPC on the hall's floor after one on P-1's goes
 * by the level graph, through the door, instead of straight at the wall between them.
 */
export const P1_VAULT: GroundVault = { bounds: { minX: P1.minX, maxX: P1.maxX, minZ: P1.minZ, maxZ: P1.maxZ }, floor: F - 2 };

/** P-1 as an interior of ADR-0061: the deck, the apron with the strip by the stair core's foot. */
export const P1_ROOMS: readonly (Rect & { readonly bottom: number; readonly top: number })[] = [
  { minX: P1.minX + W, maxX: P1_RAMP.minX - W, minZ: P1.minZ + W, maxZ: P1.maxZ, bottom: F, top: C },
  { minX: P1_RAMP.minX - W, maxX: P1.maxX - W, minZ: P1_RAMP.foot, maxZ: P1.maxZ, bottom: F, top: C },
  { minX: P1_STAIR.minX, maxX: P1_STAIR.maxX, minZ: P1_STAIR.maxZ, maxZ: P1_RAMP.foot, bottom: F, top: C },
];

/** The ramp's covered ceiling in steps of this length, each one's underside the headroom over its high end. */
const RAMP_STEP = 2;

/** The ramp's walls, its trench's parapets and portal, the stepped ceiling over its covered part. */
const rampPieces = (): Piece[] => {
  const r = P1_RAMP;
  const out: Piece[] = [];
  const base = F - W;
  const cutFloor = P1_RAMP_CUT.floor;
  // In the trench: the walls up to a parapet over the ground beside them, a metre at a time.
  for (let z = r.top; z < r.covered - 1e-6; z += 1) {
    const z1 = Math.min(z + 1, r.covered);
    for (const [x0, x1] of [[r.minX - W, r.minX], [r.maxX, r.maxX + W]] as const) {
      const g = Math.max(groundY(x0 - 0.5, z), groundY(x0 - 0.5, z1), groundY(x1 + 0.5, z), groundY(x1 + 0.5, z1));
      out.push(piece(box(x0, x1, z, z1, cutFloor, g + 1.0), "parapet", false));
    }
  }
  // Under the terrace: the ceiling in steps, the walls up to it, the portal over the trench's end.
  for (let z = r.covered; z < r.foot - 1e-6; z += RAMP_STEP) {
    const z1 = Math.min(z + RAMP_STEP, r.foot);
    const bottom = Math.max(p1RampY(z) + r.headroom, C);
    out.push(piece(box(r.minX, r.maxX, z, z1, bottom, bottom + P1.slab), "roof", true));
    out.push(piece(box(r.minX - W, r.minX, z, z1, base, bottom + P1.slab), "wall", true));
    out.push(piece(box(r.maxX, r.maxX + W, z, z1, base, bottom + P1.slab), "wall", true));
  }
  const portal = Math.max(p1RampY(r.covered) + r.headroom, C);
  const over = Math.max(groundY(r.minX, r.covered), groundY(r.maxX, r.covered));
  out.push(piece(box(r.minX, r.maxX, r.covered - W, r.covered, portal, over + 1.0), "parapet", false));
  return out;
};

/** The deck's, the apron's and the stair core's strip's floor and ceiling, P-1's outer walls. */
const shellPieces = (): Piece[] => {
  const r = P1_RAMP;
  const s = P1_STAIR;
  const base = F - W;
  const top = C + P1.slab;
  const slab = (x0: number, x1: number, z0: number, z1: number): Piece[] => [piece(box(x0, x1, z0, z1, base, F), "floor", true), piece(box(x0, x1, z0, z1, C, top), "roof", true)];
  return [
    ...slab(P1.minX, r.minX - W, P1.minZ, P1.maxZ),
    ...slab(r.minX - W, P1.maxX, r.foot, P1.maxZ),
    ...slab(s.minX, P1.maxX, s.maxZ, r.foot),
    // West, south (the deck's), north west of the hall, east by the apron.
    piece(box(P1.minX, P1.minX + W, P1.minZ, P1.maxZ, base, top), "wall", true),
    piece(box(P1.minX + W, r.minX - W, P1.minZ, P1.minZ + W, base, top), "wall", true),
    piece(box(P1.minX, HALL.minX, P1.maxZ - W, P1.maxZ, base, top), "wall", true),
    // The threshold in the hall's back wall: its floor drawn across the wall's thickness.
    piece(box(P1_HALL_DOOR.x0, P1_HALL_DOOR.x1, HALL.minZ, HALL.minZ + HALL.wall, base, F), "floor", true, false),
    piece(box(P1.maxX - W, P1.maxX, s.maxZ, P1.maxZ, base, top), "wall", true),
    // The trench's west wall goes on along the deck's east side down to the covered part.
    piece(box(r.minX - W, r.minX, P1.minZ, r.covered, base, top), "wall", true),
  ];
};

/** The stair core: its shaft's walls up to the stair house, its treads and landing, the house's roof and door. */
const stairPieces = (): Piece[] => {
  const s = P1_STAIR;
  const base = F - 1;
  const roof = s.top + s.house;
  const d = s.door;
  const out: Piece[] = [
    piece(box(s.minX, s.minX + s.wall, s.minZ, s.maxZ, base, roof), "wall", false),
    piece(box(s.maxX - s.wall, s.maxX, s.minZ, s.maxZ, base, roof), "wall", false),
    // Over the foot's opening onto P-1 up to the house's roof; the south wall round the door.
    piece(box(s.minX, s.maxX, s.maxZ - s.wall, s.maxZ, C, roof), "wall", false),
    piece(box(s.minX + s.wall, d.x0, s.minZ, s.minZ + s.wall, base, roof), "wall", false),
    piece(box(d.x1, s.maxX - s.wall, s.minZ, s.minZ + s.wall, base, roof), "wall", false),
    piece(box(d.x0, d.x1, s.minZ, s.minZ + s.wall, s.top + d.top, roof), "wall", false),
    piece(box(d.x0, d.x1, s.minZ, s.minZ + s.wall, base, s.top), "wall", false),
    piece(box(s.minX - 0.1, s.maxX + 0.1, s.minZ - 0.1, s.maxZ + 0.1, roof, roof + 0.15), "roof", false),
    // The landing level with the car park outside the door.
    piece(box(s.minX + s.wall, s.maxX - s.wall, s.minZ + s.wall, P1_STAIR_HEAD_Z, base, s.top), "step", true),
  ];
  for (let k = 1; k < s.risers; k++) {
    const z1 = s.maxZ - (k - 1) * s.going;
    out.push(piece(box(s.minX + s.wall, s.maxX - s.wall, z1 - s.going, z1, base, F + k * P1_STAIR_RISE), "step", true));
  }
  return out;
};

/** The cabins (walls, roof, a shutter for a door), the bays' lines, the chargers, the columns, the pay machine and the console. */
const fittingPieces = (): Piece[] => {
  const out: Piece[] = [];
  const t = CABIN_WALL;
  for (const c of P1_CABINS) {
    out.push(
      piece(box(c.minX, c.maxX, c.minZ, c.minZ + t, F, F + CABIN_ROOF), "wall", true),
      piece(box(c.minX, c.maxX, c.maxZ - t, c.maxZ, F, F + CABIN_ROOF), "wall", true),
      piece(box(c.minX, c.minX + t, c.minZ + t, c.maxZ - t, F, F + CABIN_ROOF), "wall", true),
      piece(box(c.minX, c.maxX, c.minZ, c.maxZ, F + CABIN_ROOF, F + CABIN_ROOF + 0.12), "roof", true),
      piece(box(c.maxX - 0.1, c.maxX, c.minZ + t, c.maxZ - t, F, F + CABIN_ROOF), "shutter", true),
    );
  }
  for (const b of P1_BAYS) {
    // A line along each side of the bay: paint on the floor.
    for (const dz of [-BAY.width / 2, BAY.width / 2]) out.push(piece(box(b.at.x - BAY.depth / 2, b.at.x + BAY.depth / 2, b.at.z + dz - 0.06, b.at.z + dz + 0.06, F - 0.05, F + 0.005), "marking", true, false));
    if (b.charger) {
      const x = b.yaw < 0 ? P1.minX + W : P1_RAMP.minX - W - 0.3;
      out.push(piece(box(x, x + 0.3, b.at.z - 0.25, b.at.z + 0.25, F, F + 1.4), "charger", true));
    }
  }
  for (const z of [3.5, 11, 18.5]) for (const x of [BAY.rows[0].x1, BAY.rows[1].x0 - 0.4]) out.push(piece(box(x, x + 0.4, z - 0.2, z + 0.2, F, C), "column", true));
  out.push(piece(P1_PAY, "machine", true), piece(P1_CONSOLE, "machine", true));
  return out;
};

/** Every drawn piece of P-1 (inside: drawn near only), and those of the ramp's trench and the stair house (outside). */
export const P1_PIECES: readonly Piece[] = [...shellPieces(), ...rampPieces(), ...stairPieces(), ...fittingPieces()];

/** The ramp's solid in pieces this long: each one's box no higher than its own top, under the car park's ground. */
const WEDGE = 2;

/**
 * The ramp's solids: wedges from under P-1's floor to the ramp's surface, walked like a metro
 * pavilion's stairs (sloped blocks, ADR-0020), drawn by the engine. In pieces, so the box of none
 * reaches up to the car park over the covered part (a body there is over the wedge, not in it).
 */
export const P1_RAMP_PROPS: readonly StaticProp[] = Array.from({ length: Math.ceil((P1_RAMP.foot - P1_RAMP.top) / WEDGE) }, (_, i): StaticProp => {
  const r = P1_RAMP;
  const bottom = F - W;
  const z0 = r.top + i * WEDGE;
  const z1 = Math.min(z0 + WEDGE, r.foot);
  const high = p1RampY(z0);
  return {
    center: { x: (r.minX + r.maxX) / 2, y: (bottom + high) / 2, z: (z0 + z1) / 2 },
    view: { kind: "block", size: { x: r.maxX - r.minX, y: high - bottom, z: z1 - z0 }, material: "concrete", slope: { axis: "z", dir: -1, low: p1RampY(z1) - bottom } },
    solid: true,
    scenery: true,
  };
});

/** The middle of the ramp's footway along its east wall: where walkers go up and down it. */
export const P1_RAMP_WALK = (P1_RAMP.walk + P1_RAMP.maxX) / 2;
