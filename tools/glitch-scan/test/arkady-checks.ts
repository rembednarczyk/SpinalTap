import { ARKADY, ARKADY_BUILDING, type AlchemiaBox } from "../../../packages/sim/src/content/alchemia";

/**
 * The glitch scan's checks of the rebuilt Arkady (ADR-0074 stage 2, review of #357): the arcade's
 * piers where the orthophoto has them (G-461).
 */

type Finding = { readonly at: string; readonly what: string };

/**
 * The middles of the arcade's piers along the west face from the south corner, measured on the
 * PZGiK orthophoto at 5 cm/px (±0.15 m): 13 piers, 14 spans. The scan's own copy, so the game's
 * list is checked against it and not against itself.
 */
export const ORTHO_PIERS: readonly number[] = [2.95, 6.25, 9.9, 13.6, 17.2, 20.8, 24.55, 28.25, 31.75, 35.4, 39.1, 42.95, 46.4];
/** How far a game's pier may stand off the orthophoto's, and the piers' width on it. */
const PIER_TOLERANCE = 0.3;
const PIER_WIDTH = { min: 0.45, max: 0.65 } as const;

/**
 * The arcade's piers in the game: the walls of the building's frame standing on the west face
 * (across from 0), at most a metre on a side, from under the arcade's floor; not the north corner's.
 */
export const gamePiers = (): AlchemiaBox[] =>
  ARKADY_BUILDING.filter((p) => p.kind === "wall" && p.solid)
    .map((p) => p.box)
    .filter((b) => Math.abs(b.z0) < 1e-6 && b.z1 - b.z0 <= 1 && b.x1 - b.x0 <= 1 && b.y0 < ARKADY.ground && b.x1 < ARKADY.length - 1e-6);

/**
 * `arcade-rhythm` (G-461): the Arkady's piers against the orthophoto's: one within 0.3 m of each
 * of its piers, none where it has none, each about its width. Baseline 0.
 */
export const arcadeRhythm = (piers: readonly AlchemiaBox[], ortho: readonly number[] = ORTHO_PIERS): Finding[] => {
  const mids = piers.map((b) => (b.x0 + b.x1) / 2);
  const off = (a: number, list: readonly number[]) => Math.min(...list.map((m) => Math.abs(m - a)));
  return [
    ...ortho.flatMap((a) => (off(a, mids) > PIER_TOLERANCE ? [{ at: `a ${a.toFixed(2)}`, what: `the orthophoto's pier at ${a.toFixed(2)} m has none in the game` }] : [])),
    ...piers.flatMap((b) => {
      const m = (b.x0 + b.x1) / 2;
      const w = b.x1 - b.x0;
      if (off(m, ortho) > PIER_TOLERANCE) return [{ at: `a ${m.toFixed(2)}`, what: `a pier at ${m.toFixed(2)} m where the orthophoto has none` }];
      return w < PIER_WIDTH.min || w > PIER_WIDTH.max ? [{ at: `a ${m.toFixed(2)}`, what: `the pier at ${m.toFixed(2)} m is ${w.toFixed(2)} m wide` }] : [];
    }),
  ];
};
