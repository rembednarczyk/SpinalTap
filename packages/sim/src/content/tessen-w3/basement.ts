import type { GroundCut } from "../../world/ground";
import type { GroundVault } from "../../world/vault";
import { type StaticProp, ladderParts, stairs, v } from "../builders";
import { box, indoor, railing } from "./parts";
import {
  BASEMENT,
  BASEMENT_CEILING,
  BASEMENT_FLOOR,
  CULVERT_CRAWL,
  CULVERT_FLIGHT,
  CULVERT_MOUTH,
  CULVERT_Z,
  LIFT_SHAFT,
  SHAFT_LADDER,
  STAIR_A,
  STAIR_B,
  WALL,
} from "./layout";
import { W3_Y } from "./site";

/**
 * The stores' basement and the culvert (ADR-0082 stage 2, picture 03's section, P6): a room in
 * the ground under the parts line and the workshops (a `GroundVault`: the hall's floor over it
 * stays whole), the floor −4.5 and the ceiling −0.4. Down into it: stair A from store S, stair B
 * from workshop W2 (both shafts dug, `GroundCut`), the goods lift's shaft with the player's
 * ladder. Into it from the river: the culvert, its mouth dug into the river's bench, then 38 m
 * of crawl 1.4 m high under the terrace and store S (only a crouching body fits), and a flight
 * down into the basement's west end. The locker room's lockers line its north wall.
 */

const F = BASEMENT_FLOOR;
const B = BASEMENT;
const C = CULVERT_Z;
const y = (h: number) => W3_Y + h;

/** The shafts dug down from the hall's floor and the culvert's mouth dug into the bench. */
export const W3_CUTS: readonly GroundCut[] = [
  { bounds: { minX: STAIR_A.minX, maxX: STAIR_A.maxX, minZ: STAIR_A.minZ, maxZ: STAIR_A.maxZ }, floor: y(F) },
  { bounds: { minX: STAIR_B.minX, maxX: STAIR_B.maxX, minZ: STAIR_B.minZ, maxZ: STAIR_B.maxZ }, floor: y(F) },
  { bounds: { minX: LIFT_SHAFT.minX, maxX: LIFT_SHAFT.maxX, minZ: LIFT_SHAFT.minZ, maxZ: LIFT_SHAFT.maxZ }, floor: y(F) },
  { bounds: { minX: CULVERT_MOUTH.minX, maxX: CULVERT_MOUTH.maxX, minZ: C.minZ, maxZ: C.maxZ }, floor: y(CULVERT_MOUTH.floor) },
];

/** The rooms in the ground: the basement, the culvert's crawl, its flight down. */
export const W3_VAULTS: readonly GroundVault[] = [
  { bounds: { minX: B.minX, maxX: B.maxX, minZ: B.minZ, maxZ: B.maxZ }, floor: y(F) },
  { bounds: { minX: CULVERT_CRAWL.minX, maxX: CULVERT_CRAWL.maxX, minZ: C.minZ, maxZ: C.maxZ }, floor: y(CULVERT_CRAWL.floor) },
  { bounds: { minX: CULVERT_FLIGHT.minX, maxX: CULVERT_FLIGHT.maxX, minZ: C.minZ, maxZ: C.maxZ }, floor: y(F) },
];

/** The basement's walls, its ceiling round the shafts, its columns and lockers. */
const basement = (): StaticProp[] => {
  const top = BASEMENT_CEILING;
  const t = WALL;
  const sb = STAIR_B;
  const ls = LIFT_SHAFT;
  return [
    // West: round the openings of the culvert's flight and stair A.
    box(B.minX - t, B.minX, F, top, B.minZ - t, C.minZ - t),
    box(B.minX - t, B.minX, F, top, STAIR_A.maxZ + t, B.maxZ + t),
    box(B.maxX, B.maxX + t, F, top, B.minZ - t, B.maxZ + t),
    box(B.minX, B.maxX, F, top, B.minZ - t, B.minZ),
    box(B.minX, B.maxX, F, top, B.maxZ, B.maxZ + t),
    // The ceiling round stair B's and the lift's shafts.
    box(B.minX, ls.minX, top, -0.05, B.minZ, B.maxZ),
    box(ls.maxX, sb.minX, top, -0.05, B.minZ, B.maxZ),
    box(sb.maxX, B.maxX, top, -0.05, B.minZ, B.maxZ),
    box(ls.minX, ls.maxX, top, -0.05, B.minZ, ls.minZ),
    box(ls.minX, ls.maxX, top, -0.05, ls.maxZ, B.maxZ),
    box(sb.minX, sb.maxX, top, -0.05, B.minZ, sb.minZ),
    box(sb.minX, sb.maxX, top, -0.05, sb.maxZ, B.maxZ),
    // Columns, the lockers of the locker room (bodies hide in them, stage 3), a bench.
    ...[2522, 2536].map((x) => box(x - 0.25, x + 0.25, F, top, 400.75, 401.25)),
    box(2516, 2527, F, F + 2, B.maxZ - 0.6, B.maxZ),
    box(2518, 2524, F, F + 0.45, 397, 397.4),
  ];
};

/** Stair A from store S, its shaft's lining down from the floor and its rail on the floor. */
const stairA = (): StaticProp[] => {
  const s = STAIR_A;
  const t = WALL;
  return [
    stairs(s.minX, s.maxX, s.minZ, s.maxZ, y(F), y(0), "x", -1),
    box(s.minX, s.maxX, F, -0.05, s.minZ - t, s.minZ),
    box(s.minX, s.maxX, F, -0.05, s.maxZ, s.maxZ + t),
    railing(s.minX, s.maxX, s.minZ - 0.12, s.minZ, 0),
  ];
};

/** Stair B up into workshop W2, rising south; the rails round its shaft on the workshop's floor. */
const stairB = (): StaticProp[] => {
  const s = STAIR_B;
  return [
    stairs(s.minX, s.maxX, s.minZ, s.maxZ, y(F), y(0), "z", -1),
    railing(s.minX - 0.12, s.minX, s.minZ, s.maxZ, 0),
    railing(s.maxX, s.maxX + 0.12, s.minZ, s.maxZ, 0),
    railing(s.minX, s.maxX, s.maxZ, s.maxZ + 0.12, 0),
  ];
};

/** The goods lift's shaft: rails round it on the parts line's floor, the ladder up its north side. */
const liftShaft = (): StaticProp[] => {
  const s = LIFT_SHAFT;
  const l = SHAFT_LADDER;
  return [
    railing(s.minX - 0.12, s.minX, s.minZ - 0.12, s.maxZ + 0.12, 0),
    railing(s.maxX, s.maxX + 0.12, s.minZ - 0.12, s.maxZ + 0.12, 0),
    railing(s.minX, s.maxX, s.minZ - 0.12, s.minZ, 0),
    railing(s.minX, s.maxX, s.maxZ, s.maxZ + 0.12, 0),
    ...ladderParts({ key: l.key, x: l.x, z: l.z, yaw: 0, bottom: y(F), top: y(0), exit: v(l.x, y(0), s.maxZ + 0.7) }),
  ];
};

/**
 * The culvert: its walls from the mouth to the basement, its ceiling (a crouching body passes
 * under it, a standing one does not), the headwall over its mouth, the flight down at its end.
 */
const culvert = (): StaticProp[] => {
  const t = WALL;
  const m = CULVERT_MOUTH;
  const k = CULVERT_CRAWL;
  const f = CULVERT_FLIGHT;
  return [
    box(m.minX, f.maxX, F, k.ceiling, C.minZ - t, C.minZ),
    box(m.minX, f.maxX, F, k.ceiling, C.maxZ, C.maxZ + t),
    box(k.minX, f.maxX, k.ceiling, -0.05, C.minZ - t, C.maxZ + t),
    // The headwall over the mouth up past the bank.
    box(k.minX - 0.2, k.minX + 0.2, k.ceiling, 0.6, C.minZ - t, C.maxZ + t),
    stairs(f.minX, f.maxX, C.minZ, C.maxZ, y(F), y(k.floor), "x", -1),
  ];
};

/** The basement, the culvert and the shafts, in the world. */
export const W3_BASEMENT_PROPS: readonly StaticProp[] = [...indoor([...basement(), ...stairA(), ...stairB(), ...liftShaft(), ...culvert()])];
