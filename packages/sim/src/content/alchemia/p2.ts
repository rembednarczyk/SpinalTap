import type { GroundCut } from "../../world/ground";
import type { GroundVault } from "../../world/vault";
import type { Rect } from "../builders";
import { groundY } from "../lublin/terrain";
import { ARKADY } from "./arkady";
import { P1, P1_CAR_LIFT, P1_STAIR_DOWN } from "./parking";
import { type Piece, box, piece } from "./plan";

/**
 * The lower level of Alchemia's car park, P-2 (ADR-0074 §1 and §4, stage 5a): the automated store
 * of the investor's plan, a room in the ground (in P-1's `GroundVault`) under P-1's deck, ramp and
 * apron, its floor on T2's level (-9.2), so its north exit opens level onto T2. Under P-1's floor
 * slab (-6.7) its ceiling leaves 2.3 m: one level of pallets, a car on each, the robots on rails
 * between them (stage 5b). A flight comes down from P-1's apron by the food hall's door and lift,
 * going east along the hall's back wall to the store's north-east corner. From there a service
 * corridor runs north under the hall (beside the lift's shaft, which stops at P-2 in stage 5c) and
 * T1 to a portal under T1's north edge, and a walled cutting in the slope (a `GroundCut`, as P-1's
 * ramp's trench) goes on level to where the ground falls to T2's level, west of the Arkady's square.
 */

const W = P1.wall;
/** Its floor: T2's level, the Arkady's ground floor's (`plaza.ts`). */
const F = ARKADY.ground;
/** The underside of P-1's floor slab: P-2's ceiling's slab tops out there. */
const SLAB_TOP = P1.floor - P1.slab;
const BASE = F - W;

/** P-2's store under P-1: its outline (outer faces), floor, ceiling (its underside) and its slab's top. */
export const P2 = { minX: P1.minX, maxX: 418, minZ: P1.minZ, maxZ: P1.maxZ, wall: W, floor: F, ceiling: SLAB_TOP - 0.2, slab: SLAB_TOP } as const;
const C = P2.ceiling;

/**
 * The service corridor north under the food hall and T1: its outline (outer faces), up to its
 * portal under T1's north edge. Its west wall is the east face of the lift's shaft (`lift.ts`,
 * x 412.3..414.7), so stage 5c opens the lift into it. South of the hall it widens into the store's
 * north-east corner (`P2_ANNEX`), where the flight from P-1 comes down.
 */
export const P2_CORRIDOR = { minX: 414.4, maxX: 420.4, minZ: P2.maxZ, maxZ: 77 } as const;
/** The store's corner east of its east wall, under P-1's apron: the foot of the flight and the corridor's mouth. */
export const P2_ANNEX = { minX: P2.maxX, maxX: P2_CORRIDOR.maxX, minZ: 23, maxZ: P2.maxZ } as const;
/** The portal's wall: its north face on the corridor's end. */
const PORTAL = { z0: P2_CORRIDOR.maxZ - W, z1: P2_CORRIDOR.maxZ } as const;

/**
 * The cutting from the portal out onto T2: walls up to a parapet over the slope beside them, its
 * floor P-2's, level, as far north as the ground falls to it (z 97: -9.2..-9.3 across it). Its
 * west wall keeps 2 m off the axis of the footway along Świętoduska (w232464409).
 */
export const P2_CUTTING = { minX: P2_CORRIDOR.minX, maxX: P2_CORRIDOR.maxX, minZ: P2_CORRIDOR.maxZ, maxZ: 97 } as const;

/**
 * The stairs down from P-1 (ADR-0074 §4, the stair core by the lift): from P-1's apron by the food
 * hall's door a straight flight goes east down through the hole in the apron's floor
 * (`P1_STAIR_DOWN`) to P-2's floor in the annex, by the corridor's mouth: 16 risers of 0.175 m.
 */
export const P2_STAIR = { ...P1_STAIR_DOWN, risers: 16, going: 0.28 } as const;
export const P2_STAIR_RISE = (P1.floor - F) / P2_STAIR.risers;
/** The railing round the hole on P-1's floor: its height. */
const RAIL = 1.0;

/** The top of the step under x on the flight: P-1's floor west of it, P-2's east of its foot. */
export const p2StairY = (x: number): number => {
  const s = P2_STAIR;
  if (x < s.minX) return P1.floor;
  if (x >= s.maxX) return F;
  return P1.floor - Math.min(s.risers - 1, Math.floor((x - s.minX) / s.going) + 1) * P2_STAIR_RISE;
};

/** The ground dug out of the slope for the cutting. */
export const P2_CUT: GroundCut = { bounds: { ...P2_CUTTING }, floor: F };

/**
 * P-2's corridor in the ground (the store and its annex under P-1 are in P-1's vault, its ground
 * lowered under P-2's floor): feet deep under the hall and T1 stand on its solids, its ground 2 m
 * under its floor.
 */
export const P2_VAULT: GroundVault = { bounds: { minX: P2_CORRIDOR.minX, maxX: P2_CORRIDOR.maxX, minZ: P2_CORRIDOR.minZ, maxZ: P2_CORRIDOR.maxZ }, floor: F - 2 };

type P2Room = Rect & { readonly bottom: number; readonly top: number };
/** P-2's store as an interior of ADR-0061: the store, its annex, the flight under P-1's floor. */
export const P2_STORE_ROOMS: readonly P2Room[] = [
  { minX: P2.minX + W, maxX: P2.maxX - W, minZ: P2.minZ + W, maxZ: P2.maxZ - W, bottom: F, top: C },
  { minX: P2.maxX - W, maxX: P2_ANNEX.maxX - W, minZ: P2_ANNEX.minZ + W, maxZ: P2.maxZ, bottom: F, top: C },
  { minX: P2_STAIR.minX, maxX: P2_STAIR.maxX, minZ: P2_STAIR.minZ, maxZ: P2_STAIR.maxZ, bottom: F, top: SLAB_TOP },
];
/** Its tunnel north to the portal onto T2 (an interior of its own since 22.11, `docs/zasady-lokacji.md` §12). */
export const P2_TUNNEL_ROOMS: readonly P2Room[] = [{ minX: P2_CORRIDOR.minX + W, maxX: P2_CORRIDOR.maxX - W, minZ: P2.maxZ, maxZ: PORTAL.z0, bottom: F, top: C }];
/** P-2 whole: the store, its annex, the corridor up to its portal, the flight under P-1's floor. */
export const P2_ROOMS: readonly P2Room[] = [...P2_STORE_ROOMS.slice(0, 2), ...P2_TUNNEL_ROOMS, P2_STORE_ROOMS[2]!];

/** The store's, the annex's and the corridor's floors, ceilings and walls. */
/**
 * Where the lift's shaft meets the corridor at P-2 (stage 5c, `lift.ts`: x 412.3..414.7, z
 * 32.4..34.8, its middle z 33.6): the corridor's west wall and its ceiling leave the shaft's span,
 * the shaft's own walls and its gate at P-2 close it, so the platform runs clear of both.
 */
const LIFT_SHAFT = { maxX: 414.7, z0: 32.4, z1: 34.8 } as const;

/**
 * The shelter's steel gate in the corridor's east wall (stage 5d, `shelter.ts`): its span along the
 * corridor and its head over P-2's floor. Behind it a flight goes down to the shelter under T2.
 */
export const P2_SHELTER_GATE = { z0: 69.0, z1: 70.6, top: 2.1 } as const;

const shellPieces = (): Piece[] => {
  const k = P2_CORRIDOR;
  const a = P2_ANNEX;
  const s = P2_STAIR;
  const floor = (x0: number, x1: number, z0: number, z1: number): Piece => piece(box(x0, x1, z0, z1, BASE, F), "floor", true);
  const ceiling = (x0: number, x1: number, z0: number, z1: number): Piece => piece(box(x0, x1, z0, z1, C, SLAB_TOP), "roof", true);
  const wall = (x0: number, x1: number, z0: number, z1: number): Piece => piece(box(x0, x1, z0, z1, BASE, SLAB_TOP), "wall", true);
  return [
    floor(P2.minX, P2.maxX, P2.minZ, P2.maxZ),
    floor(a.minX, a.maxX, a.minZ, a.maxZ),
    floor(k.minX, k.maxX, k.minZ, k.maxZ),
    // Over the store and the annex but the flight, over the corridor up to its portal.
    ceiling(P2.minX, P2.maxX, P2.minZ, s.minZ),
    ceiling(a.minX, a.maxX, a.minZ, s.minZ),
    // North of the flight's line round the car lift's shaft (stage 5e).
    ceiling(P2.minX, s.minX, s.minZ, P1_CAR_LIFT.minZ),
    ceiling(P2.minX, P1_CAR_LIFT.minX, P1_CAR_LIFT.minZ, P1_CAR_LIFT.maxZ),
    ceiling(P1_CAR_LIFT.maxX, s.minX, P1_CAR_LIFT.minZ, P1_CAR_LIFT.maxZ),
    ceiling(P2.minX, s.minX, P1_CAR_LIFT.maxZ, P2.maxZ),
    ceiling(s.maxX, a.maxX, s.minZ, P2.maxZ),
    ceiling(LIFT_SHAFT.maxX, k.maxX, k.minZ, PORTAL.z0),
    ceiling(k.minX, LIFT_SHAFT.maxX, k.minZ, LIFT_SHAFT.z0),
    ceiling(k.minX, LIFT_SHAFT.maxX, LIFT_SHAFT.z1, PORTAL.z0),
    // The store's west and south walls, its east one up to the annex, its north one up to the flight's.
    wall(P2.minX, P2.minX + W, P2.minZ, P2.maxZ),
    wall(P2.minX + W, P2.maxX, P2.minZ, P2.minZ + W),
    wall(P2.maxX - W, P2.maxX, P2.minZ + W, a.minZ + W),
    wall(P2.minX + W, s.minX, P2.maxZ - W, P2.maxZ),
    // The annex's south and east walls, the east one on along the corridor; the corridor's west wall.
    wall(a.minX, a.maxX, a.minZ, a.minZ + W),
    wall(a.maxX - W, a.maxX, a.minZ + W, a.maxZ),
    // The corridor's east wall round the shelter's gate (stage 5d): either side of it and its head.
    wall(k.maxX - W, k.maxX, k.minZ, P2_SHELTER_GATE.z0),
    wall(k.maxX - W, k.maxX, P2_SHELTER_GATE.z1, PORTAL.z0),
    piece(box(k.maxX - W, k.maxX, P2_SHELTER_GATE.z0, P2_SHELTER_GATE.z1, F + P2_SHELTER_GATE.top, SLAB_TOP), "wall", true),
    piece(box(k.maxX - W, k.maxX, P2_SHELTER_GATE.z0, P2_SHELTER_GATE.z1, BASE, F), "floor", true),
    // The corridor's west wall, out of the lift's shaft (stage 5c): the shaft's walls and gate close it there.
    wall(k.minX, k.minX + W, k.minZ, LIFT_SHAFT.z0),
    wall(k.minX, k.minX + W, LIFT_SHAFT.z1, PORTAL.z0),
  ];
};

/**
 * The earth east of the store under P-1's apron, as solids: P-1's vault reaches to its east wall, and
 * in a vault a ray goes on through the ground (`GroundField.vaultExit`), so without them a shot from
 * the store's east wall started past it (`tpp-shoulder.test.ts`). Not drawn. Until ADR-0093 O2b P-1's
 * stair core's shaft stood over it here, notched out of it; the core went east, out of the vault.
 */
const earthPieces = (): Piece[] => {
  const x0 = P2.maxX;
  const x1 = P1.maxX;
  return [piece(box(x0, x1, P2.minZ, P2_ANNEX.minZ, BASE, SLAB_TOP), "wall", true), piece(box(P2_ANNEX.maxX, x1, P2_ANNEX.minZ, P2.maxZ, BASE, SLAB_TOP), "wall", true)];
};

/**
 * The flight, its walls (north under the hall's back wall, south to the store: from the flight's
 * lower steps a target in the store is under a floor's height away, and an NPC there made for it
 * straight over the side), the railing round the hole on P-1's floor.
 */
const stairPieces = (): Piece[] => {
  const s = P2_STAIR;
  const out: Piece[] = [];
  for (let k = 1; k < s.risers; k++) {
    const x0 = s.minX + (k - 1) * s.going;
    out.push(piece(box(x0, x0 + s.going, s.minZ, s.maxZ, BASE, P1.floor - k * P2_STAIR_RISE), "step", true));
  }
  const t = 0.2;
  out.push(
    piece(box(s.minX, s.maxX, s.maxZ, P2.maxZ, BASE, SLAB_TOP), "wall", true),
    piece(box(s.minX, s.maxX, s.minZ - t, s.minZ, BASE, C), "wall", true),
    // Round the hole on P-1's floor: its south and north sides and its east end; open to the west, where the flight starts.
    piece(box(s.minX, s.maxX + t, s.minZ - t, s.minZ, P1.floor, P1.floor + RAIL), "parapet", true),
    piece(box(s.minX, s.maxX + t, s.maxZ, s.maxZ + t, P1.floor, P1.floor + RAIL), "parapet", true),
    piece(box(s.maxX, s.maxX + t, s.minZ, s.maxZ, P1.floor, P1.floor + RAIL), "parapet", true),
  );
  return out;
};

/** The cutting's walls in pieces this long, each up to a parapet over the slope beside it (Alchemia's outside has some 8 thousand triangles, §7). */
const WALL_RUN = 2;

/**
 * The portal and the cutting, outside: the wall over the portal's opening up to a parapet on T1's
 * edge, the cutting's walls up to a parapet over the slope `WALL_RUN` at a time, its floor, the
 * beacon over the opening.
 */
const cuttingPieces = (): Piece[] => {
  const c = P2_CUTTING;
  const out: Piece[] = [];
  const over = Math.max(groundY(c.minX, c.minZ), groundY(c.maxX, c.minZ)) + RAIL;
  out.push(piece(box(c.minX + W, c.maxX - W, PORTAL.z0, PORTAL.z1, C, over), "parapet", false));
  for (const [x0, x1] of [[c.minX, c.minX + W], [c.maxX - W, c.maxX]] as const) out.push(piece(box(x0, x1, PORTAL.z0, PORTAL.z1, BASE, over), "parapet", false));
  for (let z = c.minZ; z < c.maxZ - 1e-6; z += WALL_RUN) {
    const z1 = Math.min(z + WALL_RUN, c.maxZ);
    for (const [x0, x1] of [[c.minX, c.minX + W], [c.maxX - W, c.maxX]] as const) {
      let g = -Infinity;
      for (let s = z; s <= z1 + 1e-6; s += 0.5) g = Math.max(g, groundY(x0 - 0.5, s), groundY(x1 + 0.5, s));
      out.push(piece(box(x0, x1, z, z1, BASE, Math.max(g, F) + RAIL), "parapet", false));
    }
  }
  out.push(piece(box(c.minX + W, c.maxX - W, c.minZ, c.maxZ, BASE, F), "floor", false, false));
  out.push(piece(box(c.minX + 0.6, c.maxX - 0.6, c.minZ, c.minZ + 0.05, C + 0.1, C + 0.25), "beacon", false, false));
  return out;
};

/** P-2's shell, under the ground: drawn near only. */
export const P2_SHELL_PIECES: readonly Piece[] = shellPieces();
/** Its store's and annex's part (under P-1) and its corridor's (north of it): solids of their own, so a query on P-1 leaves the corridor's out. */
export const P2_STORE_SHELL: readonly Piece[] = P2_SHELL_PIECES.filter((p) => p.box.z0 < P2.maxZ);
export const P2_CORRIDOR_SHELL: readonly Piece[] = P2_SHELL_PIECES.filter((p) => p.box.z0 >= P2.maxZ);
/** The earth beside the store (solid, not drawn). */
export const P2_EARTH_PIECES: readonly Piece[] = earthPieces();
/** The flight down from P-1: drawn with P-1 (`P1_ALL_PIECES`), seen from both levels. */
export const P2_STAIR_PIECES: readonly Piece[] = stairPieces();
/** The portal's parapet and the cutting: Alchemia's outside, seen from T1 and T2. */
export const P2_CUTTING_PIECES: readonly Piece[] = cuttingPieces();
