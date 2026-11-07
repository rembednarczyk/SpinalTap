import { ARKADY, ARKADY_BUILDING, ARKADY_PAVEMENT, type AlchemiaBox, T2_PADS, arkadyLocal } from "../../../packages/sim/src/content/alchemia";
import { rawHeight } from "../../../packages/sim/src/content/lublin/sites";
import type { Pad } from "../../../packages/sim/src/content/lublin/shape";
import { groundY } from "../../../packages/sim/src/content/lublin/terrain";

/**
 * The glitch scan's checks of the rebuilt Arkady and T2 (ADR-0074 stage 2, review of #357): the
 * arcade's piers where the orthophoto has them (G-461), and no dip of T2's pads left uncovered
 * round the building (G-460).
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

/** What `pad-dip-uncovered` looks at: the pads, the map's terrain before them and the game's after, and what covers the ground. */
export interface DipInputs {
  readonly pads: readonly Pad[];
  readonly raw: (x: number, z: number) => number;
  readonly ground: (x: number, z: number) => number;
  /** Is (x, z) under a building, a pavement slab or a landing (the ground there unseen)? */
  readonly covered: (x: number, z: number) => boolean;
}

/** The samples' spacing, how far a pad on a grid point reaches past its blend (the coarsest grid's cell), the dip that shows. */
const STEP = 0.5;
const CELL = 4;
const DIP = 0.3;

/**
 * `pad-dip-uncovered` (G-460): the ground lowered by over 0.3 m under the map's in the reach of a
 * pad on a grid point alone (its blend and the cell round it) and left in sight: off the building,
 * its pavement and its landing. The pads with an area and their blend are the cut of the square
 * itself (ADR-0074 stage 2) and are left out. Samples every 0.5 m. Baseline 0.
 */
export const padDipUncovered = (k: DipInputs): Finding[] => {
  const grow = (p: Pad, by: number) => ({ minX: p.rect.minX - by, maxX: p.rect.maxX + by, minZ: p.rect.minZ - by, maxZ: p.rect.maxZ + by });
  const isPoint = (p: Pad) => p.rect.maxX - p.rect.minX < 1e-6 && p.rect.maxZ - p.rect.minZ < 1e-6;
  const reach = k.pads.filter(isPoint).map((p) => grow(p, p.blend + CELL));
  const cut = k.pads.filter((p) => !isPoint(p)).map((p) => grow(p, p.blend));
  if (reach.length === 0) return [];
  const inside = (r: { minX: number; maxX: number; minZ: number; maxZ: number }, x: number, z: number) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;
  const out: Finding[] = [];
  const [x0, x1] = [Math.min(...reach.map((r) => r.minX)), Math.max(...reach.map((r) => r.maxX))];
  const [z0, z1] = [Math.min(...reach.map((r) => r.minZ)), Math.max(...reach.map((r) => r.maxZ))];
  for (let x = Math.floor(x0 / STEP) * STEP; x <= x1; x += STEP) {
    for (let z = Math.floor(z0 / STEP) * STEP; z <= z1; z += STEP) {
      if (!reach.some((r) => inside(r, x, z)) || cut.some((r) => inside(r, x, z)) || k.covered(x, z)) continue;
      const d = k.raw(x, z) - k.ground(x, z);
      if (d > DIP) out.push({ at: `${x.toFixed(1)},${z.toFixed(1)}`, what: `ground ${d.toFixed(2)} m under the map's, uncovered` });
    }
  }
  return out;
};

/** Is the point of the building's frame in the box (x along it, z across it)? */
const inBox = (b: AlchemiaBox, a: number, c: number) => a >= b.x0 && a <= b.x1 && c >= b.z0 && c <= b.z1;

/** The game's own inputs of `pad-dip-uncovered`: T2's pads, the Arkady's outline, pavement and landing. */
export const dipInGame = (): DipInputs => {
  const slabs = ARKADY_PAVEMENT.map((p) => p.box);
  return {
    pads: T2_PADS,
    raw: rawHeight,
    ground: groundY,
    covered: (x, z) => {
      const q = arkadyLocal(x, z);
      const inOutline = q.a >= 0 && q.a <= ARKADY.length && q.c >= 0 && q.c <= ARKADY.depth;
      return inOutline || slabs.some((b) => inBox(b, q.a, q.c));
    },
  };
};
