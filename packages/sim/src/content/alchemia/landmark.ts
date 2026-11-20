import type { StreetPropItem } from "@seki/core";
import type { Rect } from "../builders";
import { HALL, type Piece, box, piece } from "./plan";

/**
 * P0's landmark in the atrium (ADR-0093 §2, built in O3, `docs/zasady-lokacji.md` §9): a fountain
 * with a hologram over it in the middle of the atrium's floor, seen from the way in from T1, from the
 * escalators and from every gallery over it. Pattern: the mall's atrium feature (a fountain or a
 * sculpture under the skylight as the place to meet and find one's way). North of the escalators'
 * lanes and off the level graph's ways round it (`nav.ts`): the way in's aisle passes west of it, the
 * north and east galleries' ways north and east. A basin knee high of four solid walls with its
 * water, a column in it and a koi of light turning over it in slices of a screen's glow, one slice
 * out of step (a cracked hologram, §3); two of the game's benches by it and planters at its corners.
 */

const F = HALL.floor;

/** The basin's outline: 3.2 m square round the atrium's middle, north of the escalators. */
export const FOUNTAIN_P0: Rect = { minX: 416.9, maxX: 420.1, minZ: 44.9, maxZ: 48.1 };

const T = 0.25;
const RIM = 0.5;

/** The basin, its water, the column and the hologram over it. */
export const landmarkPieces = (): Piece[] => {
  const f = FOUNTAIN_P0;
  const cx = (f.minX + f.maxX) / 2;
  const cz = (f.minZ + f.maxZ) / 2;
  const out: Piece[] = [
    piece(box(f.minX, f.maxX, f.minZ, f.minZ + T, F - 0.05, F + RIM), "parapet", true),
    piece(box(f.minX, f.maxX, f.maxZ - T, f.maxZ, F - 0.05, F + RIM), "parapet", true),
    piece(box(f.minX, f.minX + T, f.minZ + T, f.maxZ - T, F - 0.05, F + RIM), "parapet", true),
    piece(box(f.maxX - T, f.maxX, f.minZ + T, f.maxZ - T, F - 0.05, F + RIM), "parapet", true),
    piece(box(f.minX + T, f.maxX - T, f.minZ + T, f.maxZ - T, F - 0.05, F + RIM - 0.12), "water", true),
    // The column with the projector on it, solid in the water.
    piece(box(cx - 0.18, cx + 0.18, cz - 0.18, cz + 0.18, F - 0.05, F + 1.1), "column", true),
    piece(box(cx - 0.12, cx + 0.12, cz - 0.12, cz + 0.12, F + 1.1, F + 1.25), "led", true, false),
  ];
  // The koi: slices of light, wide in the middle, curving round the column as they rise.
  for (let k = 0; k < 9; k++) {
    const t = k / 8;
    const half = 0.18 + Math.sin(t * Math.PI) * 0.55;
    const swing = Math.sin(t * Math.PI * 1.5) * 0.6;
    const y = F + 1.6 + k * 0.24;
    const off = k === 5 ? 0.35 : 0;
    out.push(piece(box(cx + swing - half + off, cx + swing + half + off, cz - 0.06, cz + 0.06, y, y + 0.05), k === 5 ? "error" : "display", true, false));
  }
  // Two rings of light round it, the upper one flickering out of true.
  for (const [y, r] of [
    [F + 1.4, 0.9],
    [F + 3.3, 0.7],
  ] as const) {
    out.push(
      piece(box(cx - r, cx + r, cz - r, cz - r + 0.04, y, y + 0.03), "led", true, false),
      piece(box(cx - r, cx + r, cz + r - 0.04, cz + r, y, y + 0.03), "led", true, false),
      piece(box(cx - r, cx - r + 0.04, cz - r, cz + r, y, y + 0.03), "led", true, false),
      piece(box(cx + r - 0.04, cx + r, cz - r, cz + r, y, y + 0.03), "led", true, false),
    );
  }
  // Coins and a paper cup in the water, flyers by the rim: somebody threw one in and walked on (§5).
  out.push(
    piece(box(cx + 0.5, cx + 0.6, cz - 0.7, cz - 0.62, F + RIM - 0.12, F + RIM - 0.11), "goods", true, false),
    piece(box(cx - 0.8, cx - 0.72, cz + 0.4, cz + 0.48, F + RIM - 0.12, F + RIM - 0.02), "cup", true, false),
    piece(box(f.minX - 0.5, f.minX - 0.25, f.maxZ - 0.6, f.maxZ - 0.3, F + 0.003, F + 0.008), "paper", true, false),
    piece(box(f.maxX + 0.3, f.maxX + 0.52, f.minZ + 0.2, f.minZ + 0.5, F + 0.003, F + 0.008), "paper", true, false),
  );
  return out;
};

/** The game's benches by it (the long ława, its back to the basin) and planters at two of its corners. */
export const LANDMARK_PROPS: readonly StreetPropItem[] = [
  { prop: "bench", x: (FOUNTAIN_P0.minX + FOUNTAIN_P0.maxX) / 2, y: F, z: FOUNTAIN_P0.maxZ + 0.9, yaw: 0, variant: 0 },
  { prop: "bench", x: FOUNTAIN_P0.maxX + 2.0, y: F, z: (FOUNTAIN_P0.minZ + FOUNTAIN_P0.maxZ) / 2, yaw: Math.PI / 2, variant: 0 },
  { prop: "planter", x: FOUNTAIN_P0.minX - 0.6, y: F, z: FOUNTAIN_P0.minZ - 0.6, yaw: 0, variant: 3 },
  { prop: "planter", x: FOUNTAIN_P0.maxX + 0.6, y: F, z: FOUNTAIN_P0.maxZ + 0.6, yaw: 0, variant: 5 },
];
