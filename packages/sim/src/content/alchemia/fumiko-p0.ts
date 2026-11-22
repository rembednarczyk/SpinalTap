import type { Vec3 } from "@seki/core";
import type { Rect } from "../builders";
import { ground } from "../lublin/terrain";
import { opening } from "./foodhall";
import { HALL, HALL_INNER, NORTH, type Piece, box, piece } from "./plan";

/**
 * Fumiko's second place on P0 (ADR-0093 O3): when the food hall went up to P3 her ramen bar went
 * with it (`units.ts`), and the corner of the old hall where it stood kept its hatch through the
 * front onto T1 and its own door beside it, a small kitchen of its own shut off from the gallery's
 * shops. After midnight, the food hall shut, she serves the night market on T1 across this hatch;
 * by day she sits on the last stool before it (`schedules.ts`). The stools of the passers-by stand
 * before it too (`activity-spots.ts`). Three layers (`docs/zasady-lokacji.md` §2): its partitions
 * and a hood with its duct; the stove, the pots and the fridge; the cups, the cartons and the steam.
 */

const F = HALL.floor;
const C = HALL.ceiling;
const W = 0.2;

/** The place: from the hall's west wall to the gallery's west strip's front, back from the front to its partition. */
export const FUMIKO_WINDOW: Rect = { minX: HALL_INNER.minX, maxX: 408, minZ: 53.4, maxZ: HALL.maxZ };

const hatch = opening("fumiko-hatch");
/** Its counter in the hatch, in the front wall's opening (as her old counter was). */
const COUNTER = box(hatch.x0, hatch.x1, HALL.maxZ - 0.8, HALL.maxZ, F - 0.05, F + 1.0);
/** The middle of the hatch along the front. */
const HATCH_X = (hatch.x0 + hatch.x1) / 2;

/** Where she stands behind her hatch, facing T1. */
export const FUMIKO_WINDOW_SPOT: Vec3 = { x: HATCH_X, y: F, z: HALL.maxZ - 1.3 };
export const FUMIKO_WINDOW_YAW = NORTH;

/** A point on T1 `out` metres out of the hatch (a customer's 0.9 m, the stools' 1.2), `across` it from its middle. */
export const beforeHatch = (out = 0.9, across = 0): Vec3 => ground(HATCH_X + across, HALL.maxZ + out);

/** The kitchen line along its back partition: a worktop with the stove, the pots on it, the hood over it. */
/**
 * Fumiko's round things for the rooms' detail (`foodhall-detail.ts`, ADR-0098): the two pots on her stove, the stack of
 * bowls by it, the cup on the counter in the hatch, each in the box it had as a piece.
 */
export const FUMIKO_P0_ROUND: readonly { readonly key: "rd-fh-pot" | "rd-fh-bowls" | "rd-fh-teacup"; readonly box: Piece["box"] }[] = (() => {
  const z0 = FUMIKO_WINDOW.minZ + W;
  return [
    { key: "rd-fh-pot", box: box(401.35, 401.85, z0 + 0.12, z0 + 0.6, F + 0.95, F + 1.3) },
    { key: "rd-fh-pot", box: box(401.95, 402.45, z0 + 0.12, z0 + 0.6, F + 0.95, F + 1.22) },
    { key: "rd-fh-bowls", box: box(403.0, 403.3, z0 + 0.15, z0 + 0.45, F + 0.9, F + 1.08) },
    { key: "rd-fh-teacup", box: box(hatch.x1 - 0.5, hatch.x1 - 0.42, HALL.maxZ - 0.5, HALL.maxZ - 0.42, F + 1.0, F + 1.11) },
  ];
})();

const kitchen = (): Piece[] => {
  const z0 = FUMIKO_WINDOW.minZ + W;
  const z1 = z0 + 0.7;
  const [x0, x1] = [FUMIKO_WINDOW.minX + 0.2, 405.4];
  const out: Piece[] = [
    piece(box(x0, x1, z0, z1, F - 0.05, F + 0.9), "counter", true),
    // The stove's two burners and the steam off its pots (round, `FUMIKO_P0_ROUND`): the broth on since four in the afternoon.
    piece(box(401.2, 402.6, z0 + 0.05, z1 - 0.05, F + 0.9, F + 0.95), "machine", true, false),
    piece(box(401.55, 401.62, z0 + 0.32, z0 + 0.39, F + 1.32, F + 1.75), "steam", true, false),
    piece(box(402.15, 402.21, z0 + 0.34, z0 + 0.4, F + 1.25, F + 1.6), "steam", true, false),
    // The hood over the stove and its duct up to the ceiling along the partition.
    piece(box(400.9, 402.9, z0, z1 + 0.15, F + 2.05, F + 2.4), "duct", true, false),
    piece(box(401.7, 402.1, z0, z0 + 0.4, F + 2.4, C), "duct", true, false),
    // The cartons of noodles at the worktop's end (bowls stacked by the stove: `FUMIKO_P0_ROUND`).
    piece(box(403.5, 404.4, z0 + 0.05, z0 + 0.6, F + 0.9, F + 1.25), "carton", true, false),
    piece(box(404.6, 405.2, z0 + 0.1, z0 + 0.6, F + 0.9, F + 1.05), "carton", true, false),
    // A lamp over the worktop, the cable down to it taped to the partition.
    piece(box(x0 + 0.3, x1 - 0.3, z0 + 0.3, z0 + 0.4, C - 0.06, C - 0.02), "lamp", true, false),
    piece(box(405.3, 405.33, z0 + 0.02, z0 + 0.05, F + 1.0, C), "cable", true, false),
  ];
  return out;
};

/**
 * The place's pieces: its partitions to the gallery's shops (0.2 m, ceiling high, no door: it is
 * reached from T1), the counter in the hatch with a cup on it, the kitchen, a fridge in the corner
 * by the door, and the noodles' cartons by it. Inside the hall: drawn near only.
 */
export const fumikoWindowPieces = (): Piece[] => {
  const q = FUMIKO_WINDOW;
  return [
    piece(box(q.maxX - W, q.maxX, q.minZ, HALL_INNER.maxZ, F - 0.05, C), "partition", true),
    piece(box(q.minX, q.maxX - W, q.minZ, q.minZ + W, F - 0.05, C), "partition", true),
    piece(COUNTER, "counter", true),
    // The steam off the cup left on the counter in the hatch (the cup: `FUMIKO_P0_ROUND`): she was here a moment ago (§5).
    piece(box(hatch.x1 - 0.47, hatch.x1 - 0.45, HALL.maxZ - 0.48, HALL.maxZ - 0.45, F + 1.14, F + 1.4), "steam", true, false),
    ...kitchen(),
    // The fridge in the corner by the partition to the gallery: a tall box, humming.
    piece(box(q.maxX - W - 0.75, q.maxX - W - 0.05, q.minZ + W + 0.05, q.minZ + W + 0.75, F - 0.05, F + 1.9), "machine", true),
    piece(box(q.maxX - W - 0.7, q.maxX - W - 0.1, q.minZ + W + 0.76, q.minZ + W + 0.78, F + 1.0, F + 1.6), "display", true, false),
  ];
};
