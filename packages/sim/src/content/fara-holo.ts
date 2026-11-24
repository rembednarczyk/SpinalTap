import { groundY } from "./lublin/terrain";

/*
 * The hologram of St Michael's parish church over its foundations on Plac po Farze (demolished in the 1840s; the card
 * `docs/lokacje/plac-po-farze.md`, ADR-0062: the 2077 layer on a monument is light, never a building). Its walls stand on
 * the foundations' walls as the map has them (the ruin's low walls, `historic=ruins` r18507552 and the piers inside it,
 * `barriers.ts`): the nave between them, the chancel closed in three sides of an octagon on the apse's foundations, the
 * west tower over the nave's west bay on its four piers. The heights are approximate (walls ~13 m, the ridge ~27 m, the
 * spire ~50 m), to be checked on Braun and Hogenberg's view of 1618 and the bronze model by the terrace.
 *
 * Pattern: the "ghost structure" of museums' reconstructions over a ruin, as panes of light. Every facet is drawn by the
 * renderer as a hologram's pane, the building sites' boards' (`holoPanel`: a faint fill brightest at its foot, a frame of
 * light, scanlines, a flicker), so the church reads as the game's other holograms: see-through, not wholly. Pure data.
 */

/** A point of a facet: x, y (world height), z. */
export type HoloPoint = readonly [number, number, number];

/** A flat facet of the hologram: three or four corners, in order round it. */
export type HoloFacet = readonly HoloPoint[];

/** Where the hologram is drawn from: the cell holding this point draws it whole. */
export const FARA_HOLO = { x: 676.0, z: 42.3 } as const;

/** The foundations' walls' middle lines (m): the nave's, the chancel's and the tower's (`fara-holo.test.ts` holds them to the map's walls). */
export const FARA_NAVE: readonly (readonly [number, number])[] = [
  [659.8, 32.6],
  [678.0, 32.6],
  [678.0, 52.0],
  [659.8, 52.0],
];
/** The nave's walls round from the chancel's south wall to its north one: open to the chancel through the chancel arch. */
export const FARA_NAVE_WALLS: readonly (readonly [number, number])[] = [
  [678.0, 37.6],
  [678.0, 32.6],
  [659.8, 32.6],
  [659.8, 52.0],
  [678.0, 52.0],
  [678.0, 47.2],
];
/** The chancel from the nave's east wall, its apse on the foundations' three sides of an octagon. */
export const FARA_CHANCEL: readonly (readonly [number, number])[] = [
  [678.0, 37.6],
  [690.9, 37.8],
  [693.1, 40.4],
  [693.1, 43.6],
  [691.3, 46.6],
  [678.0, 47.2],
];
/** The west tower over the nave's west bay, between its four piers. */
export const FARA_TOWER: readonly (readonly [number, number])[] = [
  [659.8, 38.2],
  [666.3, 38.2],
  [666.3, 46.6],
  [659.8, 46.6],
];

/** Heights over the square (m). */
export const FARA_HEIGHTS = { nave: 13, ridge: 27, chancel: 12, chancelRidge: 19.5, tower: 32, spire: 50 } as const;

/** The nave's and the chancel's axis (z). */
const AXIS = 42.4;

const base = groundY(668, AXIS);
const top = (x: number, h: number, z: number): HoloPoint => [x, base + h, z];

/** The walls along a run of points, from the ground under each up to `h`; closed or open. */
const walls = (pts: readonly (readonly [number, number])[], h: number, closed: boolean): HoloFacet[] => {
  const out: HoloFacet[] = [];
  const n = closed ? pts.length : pts.length - 1;
  for (let k = 0; k < n; k++) {
    const [ax, az] = pts[k]!;
    const [bx, bz] = pts[(k + 1) % pts.length]!;
    out.push([[ax, groundY(ax, az), az], [bx, groundY(bx, bz), bz], top(bx, h, bz), top(ax, h, az)]);
  }
  return out;
};

const roofs = (): HoloFacet[] => {
  const h = FARA_HEIGHTS;
  const [x0, x1] = [FARA_NAVE[0]![0], FARA_NAVE[1]![0]];
  const [zs, zn] = [FARA_NAVE[0]![1], FARA_NAVE[2]![1]];
  // The nave's gable roof and its gables.
  const nave: HoloFacet[] = [
    [top(x0, h.nave, zs), top(x1, h.nave, zs), top(x1, h.ridge, AXIS), top(x0, h.ridge, AXIS)],
    [top(x1, h.nave, zn), top(x0, h.nave, zn), top(x0, h.ridge, AXIS), top(x1, h.ridge, AXIS)],
    [top(x0, h.nave, zn), top(x0, h.nave, zs), top(x0, h.ridge, AXIS)],
    [top(x1, h.nave, zs), top(x1, h.nave, zn), top(x1, h.ridge, AXIS)],
  ];
  // The chancel's roof: its ridge from the nave to the apse's middle, hipped down to the apse's three sides.
  const c = FARA_CHANCEL;
  const end = top(691.0, h.chancelRidge, AXIS);
  const from = top(c[0]![0], h.chancelRidge, AXIS);
  const chancel: HoloFacet[] = [
    [top(c[0]![0], h.chancel, c[0]![1]), top(c[1]![0], h.chancel, c[1]![1]), end, from],
    [top(c[4]![0], h.chancel, c[4]![1]), top(c[5]![0], h.chancel, c[5]![1]), from, end],
    ...[1, 2, 3].map((k): HoloFacet => [top(c[k]![0], h.chancel, c[k]![1]), top(c[k + 1]![0], h.chancel, c[k + 1]![1]), end]),
  ];
  // The tower's spire, a pyramid to its point.
  const t = FARA_TOWER;
  const apex = top((t[0]![0] + t[1]![0]) / 2, h.spire, (t[0]![1] + t[2]![1]) / 2);
  const spire = t.map((p, k): HoloFacet => [top(p[0], h.tower, p[1]), top(t[(k + 1) % 4]![0], h.tower, t[(k + 1) % 4]![1]), apex]);
  return [...nave, ...chancel, ...spire];
};

/** The hologram's facets: the walls of the nave and the chancel (open to each other) and the tower, the roofs and the spire. */
export const FARA_HOLO_FACETS: readonly HoloFacet[] = [
  ...walls(FARA_NAVE_WALLS, FARA_HEIGHTS.nave, false),
  ...walls(FARA_CHANCEL, FARA_HEIGHTS.chancel, false),
  ...walls(FARA_TOWER, FARA_HEIGHTS.tower, true),
  ...roofs(),
];
