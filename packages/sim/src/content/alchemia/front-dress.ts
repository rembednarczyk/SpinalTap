import { P1_RAMP, p1RampY } from "./parking";
import { type Piece, box, piece } from "./plan";
import { L2_SLABS, L2_TOP, L3, L3_TOP } from "./front";

/*
 * The board's details on the front (ADR-0074 B4, decisions of 19.11): umbrellas over tables on L3's roof, tall
 * screens on L3's sides and the ramp's portal lit green, as on the board. Drawn only but the tables
 * (one walks onto L3's roof from the gallery's green roof since ADR-0093 O5); the ramp's lights are in
 * its walls.
 */

/** Umbrellas over tables on L3's roof, towards its south edge: the board's top terrace. */
const umbrellas = (): Piece[] =>
  [L3.minX + 4, L3.minX + 10, L3.minX + 16, L3.minX + 22].flatMap((x, i) => {
    const z = L3.minZ + 3 + (i % 2) * 1.5;
    return [
      // Solid since ADR-0093 O5: one walks out onto L3's roof from the gallery's.
      piece(box(x - 0.5, x + 0.5, z - 0.5, z + 0.5, L3_TOP - 0.05, L3_TOP + 0.75), "table", false),
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

/**
 * Strings of paper lanterns over the hedges of L2's and L3's south terraces (ADR-0093 O5: one walks out
 * there; the board's terraces lit at night): a post in the hedge every 4 m, a cable between their tops,
 * a lantern every metre, warm, over every head.
 */
const festoons = (): Piece[] =>
  [
    { x0: 396.0, x1: 420.5, z: L2_SLABS[0]!.minZ + 0.55, y: L2_TOP },
    { x0: L3.minX + 1.5, x1: L3.maxX - 1.5, z: L3.minZ + 0.55, y: L3_TOP },
  ].flatMap(({ x0, x1, z, y }) => {
    const out: Piece[] = [piece(box(x0, x1, z - 0.01, z + 0.01, y + 2.28, y + 2.3), "cable", false, false)];
    for (let x = x0; x <= x1 + 1e-6; x += (x1 - x0) / Math.round((x1 - x0) / 4)) out.push(piece(box(x - 0.04, x + 0.04, z - 0.04, z + 0.04, y + 0.6, y + 2.35), "pergola", false, false));
    for (let x = x0 + 0.5; x < x1 - 0.3; x += 1.0) out.push(piece(box(x - 0.14, x + 0.14, z - 0.14, z + 0.14, y + 1.85, y + 2.18), "lantern", false, false));
    return out;
  });

/** Every detail of B4 on the front. */
// The fountain and the kiosks before the front went to the square of C5 (`front-plaza.ts`), round and to the board.
export const frontDressPieces = (): Piece[] => [...umbrellas(), ...sideScreens(), ...rampLights(), ...festoons()];
