import { P1_RAMP, p1RampY } from "./parking";
import { type Piece, box, piece } from "./plan";
import { L2_SLABS, L2_TOP, L3, L3_TOP } from "./front";

/*
 * The board's details on the front (ADR-0074 B4, decisions of 19.11): green hanging over the
 * storeys' edges, trees in planters on L2's terrace, umbrellas over tables on L3's roof, tall
 * screens on L3's sides and the ramp's portal lit green, as on the board. Drawn only: nobody climbs
 * to L2's terrace or L3's roof (no stairs lead there), and the ramp's lights are in its walls.
 */

/** A slab's overhang past its glass (as `front.ts`). */
const OVER = 0.3;
const L2 = L2_SLABS[0]!;

/**
 * Green hanging over L2's and L3's south edges, narrow strands with gaps, as on the board: on L2
 * clear of its screen, on L3 only by its corners, clear of the sign.
 */
const vines = (): Piece[] => {
  const out: Piece[] = [];
  const strand = (x: number, z: number, top: number, drop: number) => out.push(piece(box(x, x + 1.2, z - 0.2, z, top - drop, top + 0.4), "green", false, false));
  for (let x = L2.minX + 11; x < L2.maxX - 2; x += 4.5) strand(x, L2.minZ - OVER - 0.02, L2_TOP, 1.8);
  for (const x of [L3.minX + 0.6, L3.minX + 2.6, L3.maxX - 1.8, L3.maxX - 3.8]) strand(x, L3.minZ - OVER - 0.02, L3_TOP, 1.4);
  return out;
};

/** Trees in planters along L2's south terrace, between L3's front and L2's edge. */
const trees = (): Piece[] =>
  [L2.minX + 4, L2.minX + 13, L2.maxX - 6].flatMap((x) => [
    piece(box(x - 0.8, x + 0.8, 7.2, 8.8, L2_TOP, L2_TOP + 0.7), "green", false, false),
    piece(box(x - 0.12, x + 0.12, 7.88, 8.12, L2_TOP + 0.7, L2_TOP + 2.6), "frame", false, false),
    piece(box(x - 1.3, x + 1.3, 6.7, 9.3, L2_TOP + 2.2, L2_TOP + 3.4), "green", false, false),
    piece(box(x - 0.8, x + 0.8, 7.2, 8.8, L2_TOP + 3.4, L2_TOP + 4.0), "green", false, false),
  ]);

/** Umbrellas over tables on L3's roof, towards its south edge: the board's top terrace. */
const umbrellas = (): Piece[] =>
  [L3.minX + 4, L3.minX + 10, L3.minX + 16, L3.minX + 22].flatMap((x, i) => {
    const z = L3.minZ + 3 + (i % 2) * 1.5;
    return [
      piece(box(x - 0.5, x + 0.5, z - 0.5, z + 0.5, L3_TOP, L3_TOP + 0.75), "table", false, false),
      piece(box(x - 0.04, x + 0.04, z - 0.04, z + 0.04, L3_TOP + 0.75, L3_TOP + 2.3), "column", false, false),
      piece(box(x - 1.3, x + 1.3, z - 1.3, z + 1.3, L3_TOP + 2.3, L3_TOP + 2.45), "umbrella", false, false),
    ];
  });

/** Tall screens on L3's west and east faces, the board's billboards on the top storey. */
const sideScreens = (): Piece[] => [
  piece(box(L3.minX - 0.06, L3.minX, L3.minZ + 3, L3.minZ + 7, L2_TOP + 0.6, L3_TOP - 0.6), "screen", false, false),
  piece(box(L3.maxX, L3.maxX + 0.06, L3.minZ + 3, L3.minZ + 7, L2_TOP + 0.6, L3_TOP - 0.6), "screen", false, false),
];

/** The ramp's portal lit green: strips along both walls a metre over the ramp, and a band over its mouth under L2. */
const rampLights = (): Piece[] => {
  const r = P1_RAMP;
  const out: Piece[] = [];
  for (let z = r.top + 1; z < r.covered + 6; z += 2) {
    const y = p1RampY(z + 1) + 0.9;
    out.push(piece(box(r.minX + 0.01, r.minX + 0.05, z, z + 2, y, y + 0.06), "led-green", false, false));
    out.push(piece(box(r.maxX - 0.05, r.maxX - 0.01, z, z + 2, y, y + 0.06), "led-green", false, false));
  }
  // On the portal beam's face over the trench (its underside the ramp's headroom over the ramp at the cover's start).
  const beam = p1RampY(r.covered) + r.headroom;
  out.push(piece(box(r.minX + 0.2, r.maxX - 0.2, r.covered - 0.36, r.covered - 0.3, beam + 0.12, beam + 0.24), "led-green", false, false));
  return out;
};

/** Every detail of B4 on the front. */
export const frontDressPieces = (): Piece[] => [...vines(), ...trees(), ...umbrellas(), ...sideScreens(), ...rampLights()];
