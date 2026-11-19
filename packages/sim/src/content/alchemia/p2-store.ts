import type { Rect, StaticProp } from "../builders";
import { P2, P2_CORRIDOR } from "./p2";
import { type Piece, box, piece } from "./plan";

/**
 * The automated store of P-2 (ADR-0074 stage 5a), as it stands still: two rows of pallets along the
 * robots' lane, a car on most of them, the racks' uprights and beams, the rails down the lane, the
 * orange beacons, the control room in the south-east corner by the service aisle. The robots that
 * take the cars from P-1's hand-over cabins and put them on the pallets come in stage 5b; until
 * then nothing moves. Walkers keep to the aisle along the east wall, under P-1's ramp, and to the
 * corridor; the lane is walked too, the rows are not.
 */

const F = P2.floor;
const C = P2.ceiling;
const W = P2.wall;

/** The rows of pallets (x from-to, their ends at the lane), the lane between them, the service aisle east of them. */
export const P2_ROWS: readonly { readonly x0: number; readonly x1: number }[] = [
  { x0: P2.minX + W + 0.3, x1: 400 },
  { x0: 404.6, x1: 410 },
];
export const P2_LANE = { x0: 400, x1: 404.6 } as const;
export const P2_AISLE = { x0: 410, x1: P2.maxX - W } as const;

/** A pallet 2.5 m wide every 2.7 m from z 3, ten a row. */
const PALLET = { from: 3, pitch: 2.7, width: 2.5, count: 10, height: 0.15 } as const;

/** Pallets with no car: waiting for the next one down the cabins. */
const EMPTY: ReadonlySet<number> = new Set([2, 6, 9, 12, 15, 17]);

/** The pallets, row by row from the south, and whether a car stands on each (fixed content: the robots park them). */
export const P2_PALLETS: readonly (Rect & { readonly car: boolean })[] = P2_ROWS.flatMap((row, r) =>
  Array.from({ length: PALLET.count }, (_, i) => {
    const z0 = PALLET.from + i * PALLET.pitch;
    return { minX: row.x0, maxX: row.x1, minZ: z0, maxZ: z0 + PALLET.width, car: !EMPTY.has(r * PALLET.count + i) };
  }),
);

/** The control room in the south-east corner, its window west on the aisle, its door north. */
export const P2_CONTROL: Rect = { minX: 414.6, maxX: P2.maxX - W, minZ: P2.minZ + W, maxZ: 7.6 };
const CONTROL_DOOR = { x0: 415.2, x1: 416.2, top: 2.1 } as const;

/** A car's body clear of its pallet, and its cabin's top, over the pallet's top. */
const BODY = { lift: 0.2, top: 0.85, cabin: 0.5 } as const;

/** A car on a pallet whose top is `y`, as drawn: its body, its cabin, a tyre at each corner (its solid is the pallet's, `P2_STORE_SOLIDS`). */
const carPieces = (p: Rect, y: number): Piece[] => {
  const mx = (p.minX + p.maxX) / 2;
  const mz = (p.minZ + p.maxZ) / 2;
  const body = box(mx - 2.15, mx + 2.15, mz - 0.9, mz + 0.9, y + BODY.lift, y + BODY.top);
  const out: Piece[] = [piece(body, "car", true, false), piece(box(mx - 1.2, mx + 0.9, mz - 0.8, mz + 0.8, body.y1, body.y1 + BODY.cabin), "glass", true, false)];
  for (const dx of [-1.35, 1.35]) for (const dz of [-0.82, 0.82]) out.push(piece(box(mx + dx - 0.32, mx + dx + 0.32, mz + dz - 0.1, mz + dz + 0.1, y, y + 0.55), "tyre", true, false));
  return out;
};

/** The pallets with their cars, the racks' uprights between them and a beam over each line of them, a beacon strip along the lane's. */
const rackPieces = (): Piece[] => {
  const out: Piece[] = [];
  for (const p of P2_PALLETS) {
    out.push(piece(box(p.minX, p.maxX, p.minZ, p.maxZ, F, F + PALLET.height), "pallet", true, false));
    if (p.car) out.push(...carPieces(p, F + PALLET.height));
  }
  const ends = { z0: PALLET.from - 0.2, z1: PALLET.from + (PALLET.count - 1) * PALLET.pitch + PALLET.width + 0.2 };
  // Uprights on the lane's side of both rows and the aisle's side of the east one (the west row's back is the wall).
  const lines = [P2_ROWS[0]!.x1 - 0.15, P2_ROWS[1]!.x0, P2_ROWS[1]!.x1 - 0.15];
  for (const x of lines) {
    for (let i = 0; i <= PALLET.count; i++) {
      const z = PALLET.from + i * PALLET.pitch - (PALLET.pitch - PALLET.width) / 2;
      out.push(piece(box(x, x + 0.15, z - 0.075, z + 0.075, F, C), "rack", true));
    }
    out.push(piece(box(x, x + 0.15, ends.z0, ends.z1, C - 0.35, C - 0.2), "rack", true, false));
  }
  // The beacons along the lane, under its beams: the robots' warning light, orange.
  out.push(piece(box(lines[0]! + 0.15, lines[0]! + 0.18, ends.z0, ends.z1, C - 0.45, C - 0.35), "beacon", true, false));
  out.push(piece(box(lines[1]! - 0.03, lines[1]!, ends.z0, ends.z1, C - 0.45, C - 0.35), "beacon", true, false));
  return out;
};

/** The rails down the lane, flush with the floor, and a beacon in the ceiling over it every few metres. */
const lanePieces = (): Piece[] => {
  const out: Piece[] = [];
  const mx = (P2_LANE.x0 + P2_LANE.x1) / 2;
  for (const x of [mx - 1.1, mx + 1.1]) out.push(piece(box(x - 0.05, x + 0.05, P2.minZ + W + 0.2, P2.maxZ - W - 0.2, F - 0.02, F + 0.02), "rail", true, false));
  for (let z = 5; z < P2.maxZ - 2; z += 5.4) out.push(piece(box(mx - 0.3, mx + 0.3, z, z + 0.15, C - 0.05, C), "beacon", true, false));
  return out;
};

/** The control room: its window wall on the aisle, its north wall with the door, a console and its screens. */
const controlPieces = (): Piece[] => {
  const r = P2_CONTROL;
  const d = CONTROL_DOOR;
  const t = 0.15;
  return [
    piece(box(r.minX, r.minX + t, r.minZ, r.maxZ, F, F + 1.0), "wall", true),
    piece(box(r.minX, r.minX + t, r.minZ, r.maxZ, F + 1.0, F + 2.0), "glass", true),
    piece(box(r.minX, r.minX + t, r.minZ, r.maxZ, F + 2.0, C), "wall", true),
    piece(box(r.minX, d.x0, r.maxZ - t, r.maxZ, F, C), "wall", true),
    piece(box(d.x1, r.maxX, r.maxZ - t, r.maxZ, F, C), "wall", true),
    piece(box(d.x0, d.x1, r.maxZ - t, r.maxZ, F + d.top, C), "wall", true),
    piece(box(r.minX + 0.4, r.maxX - 0.3, r.minZ + 0.2, r.minZ + 0.9, F, F + 0.9), "machine", true),
    piece(box(r.minX + 0.5, r.maxX - 0.4, r.minZ + 0.05, r.minZ + 0.1, F + 1.1, F + 1.6), "beacon", true, false),
  ];
};

/** The corridor: a walking line down its east side, a beacon in its ceiling every 9 m. */
const corridorPieces = (): Piece[] => {
  const k = P2_CORRIDOR;
  const out: Piece[] = [piece(box(k.maxX - W - 0.6, k.maxX - W - 0.5, k.minZ + 0.5, k.maxZ - 1, F - 0.02, F + 0.005), "marking", true, false)];
  for (let z = k.minZ + 4; z < k.maxZ - 2; z += 9) out.push(piece(box((k.minX + k.maxX) / 2 - 0.3, (k.minX + k.maxX) / 2 + 0.3, z, z + 0.15, C - 0.05, C), "beacon", true, false));
  return out;
};

/** The store's fittings: drawn with P-2's shell, near it only. The pallets, the cars and the beams over head height are drawn only. */
export const P2_STORE_PIECES: readonly Piece[] = [...rackPieces(), ...lanePieces(), ...controlPieces(), ...corridorPieces()];

/**
 * The pallets with their cars as solids, not drawn: a box a pallet up to its car's cabin. A pallet
 * and the car's body and cabin were three prisms of every query on P-1 over the store (the index of
 * solids is flat, `solid-index.ts`): the ramp's traffic tests ran some 15% longer.
 */
export const P2_STORE_SOLIDS: readonly Piece[] = P2_PALLETS.map((p) =>
  piece(box(p.minX, p.maxX, p.minZ, p.maxZ, F, F + PALLET.height + (p.car ? BODY.top + BODY.cabin : 0)), "pallet", true),
);

/**
 * The robots of the store (ADR-0074 stage 5b): two low carts on the lane's rails, each running its
 * half of the lane to and fro by the clock, pausing at each end where they would take a car off a
 * pallet. A body in their way is pushed aside (the lane is 4.6 m wide, a cart 1.6 m): they never
 * pin anyone, their runs end 1.5 m short of the lane's ends and of each other.
 */
export const P2_ROBOT = { width: 1.6, length: 2.2, height: 0.9, travel: 9.5, period: 32, pause: 0.12 } as const;
const ROBOT_STARTS: readonly { readonly z: number; readonly phase: number }[] = [
  { z: 4.5, phase: 0 },
  { z: 17.8, phase: 0.5 },
];
export const P2_ROBOTS: readonly StaticProp[] = ROBOT_STARTS.map(({ z, phase }, i) => {
  const mx = (P2_LANE.x0 + P2_LANE.x1) / 2;
  const r = P2_ROBOT;
  return {
    key: `alchemia-p2-robot-${i}`,
    center: { x: mx, y: F + r.height / 2, z: z + r.length / 2 },
    view: { kind: "block", size: { x: r.width, y: r.height, z: r.length }, material: "metal" },
    solid: true,
    mechanism: { kind: "shuttle", key: `alchemia-p2-robot-${i}`, axis: "z", travel: r.travel, period: r.period, phase, pause: r.pause },
  };
});
