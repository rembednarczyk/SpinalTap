import type { GroundCut } from "../../world/ground";
import type { GroundVault } from "../../world/vault";
import { type StaticProp, ladderParts, stairs, v } from "../builders";
import { box, indoor, lockers, railing } from "./parts";
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
import { W3_STORE_FLOOR } from "./rows-s";
import { W3_Y, type W3Rect } from "./site";

/**
 * The stores' basement and the culvert (ADR-0082 stage 2, picture 03's section, P6): a room in
 * the ground under the parts line and the workshops (a `GroundVault`: the hall's floor over it
 * stays whole), the floor −4.5 and the ceiling −0.4. Down into it: stair A from store S, stair B
 * from workshop W2 (both shafts dug, `GroundCut`), the goods lift's shaft with the player's
 * ladder. Into it from the river: the culvert, its mouth dug into the river's bench, then 37 m
 * of crawl 1.5 m high under the terrace, the west yard and airlock S (only a crouching body
 * fits), and a flight down into the basement's west end. The locker room's lockers line its
 * north wall.
 */

const F = BASEMENT_FLOOR;
const B = BASEMENT;
const C = CULVERT_Z;
const y = (h: number) => W3_Y + h;

/** The shafts dug down from the hall's floor, the culvert's mouth dug into the bench, store S's floor levelled. */
export const W3_CUTS: readonly GroundCut[] = [
  ...W3_STORE_FLOOR.map((r) => ({ bounds: r, floor: y(0) })),
  { bounds: { minX: STAIR_A.minX, maxX: STAIR_A.maxX, minZ: STAIR_A.minZ, maxZ: STAIR_A.maxZ }, floor: y(F) },
  { bounds: { minX: STAIR_B.minX, maxX: STAIR_B.maxX, minZ: STAIR_B.minZ, maxZ: STAIR_B.maxZ }, floor: y(F) },
  { bounds: { minX: LIFT_SHAFT.minX, maxX: LIFT_SHAFT.maxX, minZ: LIFT_SHAFT.minZ, maxZ: LIFT_SHAFT.maxZ }, floor: y(F) },
  // The mouth with its wing walls' footing.
  { bounds: { minX: CULVERT_MOUTH.minX, maxX: CULVERT_MOUTH.maxX, minZ: C.minZ - WALL, maxZ: C.maxZ + WALL }, floor: y(CULVERT_MOUTH.floor) },
];

/** The rooms in the ground with their walls (as a metro platform's): the basement, the culvert's crawl, its flight down. */
export const W3_VAULTS: readonly GroundVault[] = [
  { bounds: { minX: B.minX - WALL, maxX: B.maxX + WALL, minZ: B.minZ - WALL, maxZ: B.maxZ + WALL }, floor: y(F) },
  { bounds: { minX: CULVERT_CRAWL.minX, maxX: CULVERT_CRAWL.maxX, minZ: C.minZ - WALL, maxZ: C.maxZ + WALL }, floor: y(CULVERT_CRAWL.floor) },
  { bounds: { minX: CULVERT_FLIGHT.minX, maxX: CULVERT_FLIGHT.maxX, minZ: C.minZ - WALL, maxZ: C.maxZ + WALL }, floor: y(F) },
];

/** A slab over `r` from y0 to y1 less the holes in it: strips between the holes' x edges, each less the holes over it. */
const slabWithHoles = (r: W3Rect, y0: number, y1: number, holes: readonly W3Rect[]): StaticProp[] => {
  const xs = [...new Set([r.minX, r.maxX, ...holes.flatMap((h) => [h.minX, h.maxX])])].sort((a, b) => a - b);
  return xs.slice(1).flatMap((x1, i) => {
    const x0 = xs[i] as number;
    const over = holes.filter((h) => h.minX < x1 && h.maxX > x0).sort((a, b) => a.minZ - b.minZ);
    const zs = [r.minZ, ...over.flatMap((h) => [h.minZ, h.maxZ]), r.maxZ];
    const out: StaticProp[] = [];
    for (let k = 0; k < zs.length; k += 2) if ((zs[k + 1] as number) > (zs[k] as number)) out.push(box(x0, x1, y0, y1, zs[k] as number, zs[k + 1] as number));
    return out;
  });
};

/** The basement's walls (the west one open on the culvert's flight), its ceiling round the shafts, its columns and lockers. */
const basement = (): StaticProp[] => {
  const top = BASEMENT_CEILING;
  const t = WALL;
  return [
    box(B.minX - t, B.minX, F, top, B.minZ - t, C.minZ),
    box(B.minX - t, B.minX, F, top, C.maxZ, B.maxZ + t),
    box(B.maxX, B.maxX + t, F, top, B.minZ - t, B.maxZ + t),
    box(B.minX, B.maxX, F, top, B.minZ - t, B.minZ),
    box(B.minX, B.maxX, F, top, B.maxZ, B.maxZ + t),
    ...slabWithHoles(B, top, -0.05, [STAIR_A, STAIR_B, LIFT_SHAFT]),
    // Its floor: the ground of a room in the ground is not drawn.
    box(B.minX, B.maxX, F - 0.25, F, B.minZ, B.maxZ),
    // Columns, the four lockers of the locker room (one body hides in each), a bench.
    ...[2522, 2536].map((x) => box(x - 0.25, x + 0.25, F, top, 400.75, 401.25)),
    ...lockers(2517, 2528, F, F + 2, B.maxZ - 0.6, B.maxZ, 4),
    box(2518, 2524, F, F + 0.45, 397, 397.4),
  ];
};

/** Stair A from the parts line, rising east to its top by the room's door; the rails round its shaft on the floor. */
const stairA = (): StaticProp[] => {
  const s = STAIR_A;
  return [
    stairs(s.minX, s.maxX, s.minZ, s.maxZ, y(F), y(0), "x", 1),
    railing(s.minX, s.maxX, s.minZ - 0.12, s.minZ, 0),
    railing(s.minX - 0.12, s.minX, s.minZ - 0.12, s.maxZ, 0),
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
    // The mouth dug into the bench: its floor (the dug ground is not drawn), its wing walls, the headwall up past the bank.
    box(m.minX, k.minX, m.floor - 0.25, m.floor, C.minZ, C.maxZ),
    box(m.minX, k.minX, m.floor - 0.25, k.ceiling, C.minZ - t, C.minZ),
    box(m.minX, k.minX, m.floor - 0.25, k.ceiling, C.maxZ, C.maxZ + t),
    box(k.minX - 0.2, k.minX + 0.2, k.ceiling, 0.6, C.minZ - t, C.maxZ + t),
    // The crawl and the flight under the terrace and the hall: their floors, the walls from a slab under each.
    box(k.minX, f.minX, k.floor - 0.25, k.floor, C.minZ, C.maxZ),
    box(f.minX, f.maxX, F - 0.25, F, C.minZ, C.maxZ),
    box(k.minX, f.minX, k.floor - 0.25, k.ceiling, C.minZ - t, C.minZ),
    box(k.minX, f.minX, k.floor - 0.25, k.ceiling, C.maxZ, C.maxZ + t),
    box(f.minX, f.maxX, F, k.ceiling, C.minZ - t, C.minZ),
    box(f.minX, f.maxX, F, k.ceiling, C.maxZ, C.maxZ + t),
    box(k.minX, f.maxX, k.ceiling, -0.05, C.minZ - t, C.maxZ + t),
    stairs(f.minX, f.maxX, C.minZ, C.maxZ, y(F), y(k.floor), "x", -1),
  ];
};

/** The basement, the culvert and the shafts, in the world. */
export const W3_BASEMENT_PROPS: readonly StaticProp[] = [...indoor([...basement(), ...stairA(), ...stairB(), ...liftShaft(), ...culvert()])];
