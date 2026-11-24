import { FARA_FOUNDATION_TOP } from "./lublin/fara-pad";
import { groundY } from "./lublin/terrain";

/*
 * The hologram of St Michael's parish church over its foundations on Plac po Farze (demolished in the 1840s; the card
 * `docs/lokacje/plac-po-farze.md`, ADR-0062: the 2077 layer on a monument is light, never a building). Its walls stand on
 * the foundations' walls as the map has them (the ruin's low walls, `historic=ruins` r18507552 and the piers inside it,
 * `barriers.ts`): the nave between them, the chancel closed in three sides of an octagon on the apse's foundations, the
 * west tower over the nave's west bay on its four piers; the side chapels, the sacristy and the annex by the chancel on
 * the foundations round them, with lean-to roofs; pointed windows and the doors (the west portal, the south door). The heights are approximate (walls ~13 m, the ridge ~27 m, the
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

/** The hologram's foot: the foundations' top, one level over the levelled square (`fara-pad.ts`). */
const base = FARA_FOUNDATION_TOP;
const top = (x: number, h: number, z: number): HoloPoint => [x, base + h, z];
/** A wall's foot: on the foundations' top, or on the south-west chapel's walls left on the rising NMT (`fara-pad.ts`), on theirs. */
const foot = (x: number, z: number): HoloPoint => [x, Math.max(base, groundY(x, z) + 0.5), z];

/** The walls along a run of points, from the foundations' top up to `h` over it; closed or open. */
const walls = (pts: readonly (readonly [number, number])[], h: number, closed: boolean): HoloFacet[] => {
  const out: HoloFacet[] = [];
  const n = closed ? pts.length : pts.length - 1;
  for (let k = 0; k < n; k++) {
    const [ax, az] = pts[k]!;
    const [bx, bz] = pts[(k + 1) % pts.length]!;
    out.push([foot(ax, az), foot(bx, bz), top(bx, h, bz), top(ax, h, az)]);
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

/**
 * A side chapel, the sacristy or the annex by the chancel, on the foundations round the nave and the chancel (the ruin's
 * outline r18507552 and r18507551): its closed plan with one side on the wall it leans on (`wall`, a line of z), walls
 * `out` m high on its far side, a lean-to roof rising to `inner` m on the wall it leans on; `skip` the sides shared with
 * another piece (not walled twice).
 */
export interface FaraChapel {
  readonly pts: readonly (readonly [number, number])[];
  readonly wall: number;
  readonly out: number;
  readonly inner: number;
  readonly skip?: readonly number[];
}

/** The chapels between the north buttresses, the south-west chapel and the south one, the annex south of the chancel and the sacristy north of it. */
export const FARA_CHAPELS: readonly FaraChapel[] = [
  { pts: [[662.0, 52.0], [662.0, 56.6], [665.8, 56.9], [665.8, 52.0]], wall: 52.0, out: 6, inner: 8.5 },
  { pts: [[665.8, 52.0], [665.8, 57.4], [671.7, 57.6], [671.7, 52.0]], wall: 52.0, out: 6, inner: 8.5, skip: [0] },
  { pts: [[671.7, 52.0], [671.7, 57.3], [677.4, 57.3], [677.9, 56.4], [677.9, 52.0]], wall: 52.0, out: 6, inner: 8.5, skip: [0] },
  { pts: [[667.6, 32.6], [667.6, 24.6], [666.5, 24.0], [658.0, 30.2], [659.6, 32.6]], wall: 32.6, out: 6, inner: 8.5 },
  { pts: [[671.8, 32.6], [671.8, 27.7], [676.4, 27.9], [677.7, 28.9], [677.7, 32.6]], wall: 32.6, out: 6, inner: 8.5 },
  { pts: [[678.0, 37.6], [678.0, 30.4], [684.4, 30.4], [684.4, 37.6]], wall: 37.6, out: 6, inner: 9, skip: [2] },
  { pts: [[684.4, 37.6], [684.4, 33.7], [687.6, 33.7], [687.6, 37.6]], wall: 37.6, out: 6, inner: 9 },
  { pts: [[678.0, 47.2], [678.0, 51.8], [686.3, 51.8], [686.3, 47.2]], wall: 47.2, out: 6, inner: 9, skip: [0] },
];

/** A chapel's height over the square at a point: its lean-to falls from the wall it leans on to its far side. */
const chapelHeight = (c: FaraChapel, z: number): number => {
  const depth = Math.max(...c.pts.map((p) => Math.abs(p[1] - c.wall)));
  return c.inner - ((c.inner - c.out) * Math.abs(z - c.wall)) / depth;
};

const chapel = (c: FaraChapel): HoloFacet[] => {
  const out: HoloFacet[] = [];
  const n = c.pts.length;
  for (let k = 0; k < n; k++) {
    const [ax, az] = c.pts[k]!;
    const [bx, bz] = c.pts[(k + 1) % n]!;
    if (c.skip?.includes(k) || (Math.abs(az - c.wall) < 1e-6 && Math.abs(bz - c.wall) < 1e-6)) continue;
    out.push([foot(ax, az), foot(bx, bz), top(bx, chapelHeight(c, bz), bz), top(ax, chapelHeight(c, az), az)]);
  }
  // The roof: a fan of triangles from its first corner (the plans are convex), on the lean-to's plane.
  const roof = c.pts.map(([x, z]) => top(x, chapelHeight(c, z), z));
  for (let k = 1; k + 1 < n; k++) out.push([roof[0]!, roof[k]!, roof[k + 1]!]);
  return out;
};

/**
 * A window or a door in a wall from (ax, az) to (bx, bz): centred `at` of the way along, `width` wide, from `sill` up
 * `height` m to the springing of its pointed arch, the arch `rise` m higher; a pane of its own just off the wall's outer
 * face (`OFF`), so its frame of light draws the opening on the wall's pane.
 */
export interface FaraOpening {
  readonly a: readonly [number, number];
  readonly b: readonly [number, number];
  readonly at: number;
  readonly width: number;
  readonly sill: number;
  readonly height: number;
  readonly rise: number;
}

/** How far off a wall's face its openings' panes hang (m). */
const OFF = 0.06;
/** The church's middle: a wall's outer side is away from it. */
const MIDDLE = { x: 676, z: 42.4 } as const;

/** An opening's pane and its outline (its corners round it, the arch's point among them), off the wall's outer face. */
const openingShape = (o: FaraOpening): { readonly panes: HoloFacet[]; readonly outline: HoloPoint[] } => {
  const [[ax, az], [bx, bz]] = [o.a, o.b];
  const len = Math.hypot(bx - ax, bz - az);
  const u = { x: (bx - ax) / len, z: (bz - az) / len };
  const mid = { x: ax + (bx - ax) * o.at, z: az + (bz - az) * o.at };
  let n = { x: u.z, z: -u.x };
  if ((mid.x - MIDDLE.x) * n.x + (mid.z - MIDDLE.z) * n.z < 0) n = { x: -n.x, z: -n.z };
  const p = (s: number, h: number): HoloPoint => top(mid.x + u.x * s + n.x * OFF, h, mid.z + u.z * s + n.z * OFF);
  const w = o.width / 2;
  const spring = o.sill + o.height;
  return {
    panes: [
      [p(-w, o.sill), p(w, o.sill), p(w, spring), p(-w, spring)],
      [p(-w, spring), p(w, spring), p(0, spring + o.rise)],
    ],
    outline: [p(-w, o.sill), p(w, o.sill), p(w, spring), p(0, spring + o.rise), p(-w, spring)],
  };
};

/** Windows every bay of the nave over the chapels' roofs, tall lancets round the chancel, one in each chapel's far wall, the tower's belfry; the west portal under the tower and the south door between the chapels. */
const windows = (): FaraOpening[] => {
  const out: FaraOpening[] = [];
  const lancet = { width: 1.4, sill: 9.2, height: 2.4, rise: 0.8 };
  for (const x of [669.0, 674.8]) {
    out.push({ a: [659.8, 32.6], b: [678.0, 32.6], at: (x - 659.8) / 18.2, ...lancet });
    out.push({ a: [659.8, 52.0], b: [678.0, 52.0], at: (x - 659.8) / 18.2, ...lancet });
  }
  const c = FARA_CHANCEL;
  for (let k = 0; k + 1 < c.length; k++) {
    const len = Math.hypot(c[k + 1]![0] - c[k]![0], c[k + 1]![1] - c[k]![1]);
    for (const at of len > 8 ? [0.6, 0.85] : [0.5]) out.push({ a: c[k]!, b: c[k + 1]!, at, width: 1.3, sill: 3.5, height: 5.5, rise: 1.4 });
  }
  for (const ch of FARA_CHAPELS) {
    // The chapel's far side: the side whose middle lies farthest off the wall it leans on.
    const sides = ch.pts.map((p, k) => [p, ch.pts[(k + 1) % ch.pts.length]!] as const);
    const far = sides.reduce((best, s) => (Math.abs((s[0][1] + s[1][1]) / 2 - ch.wall) > Math.abs((best[0][1] + best[1][1]) / 2 - ch.wall) ? s : best));
    out.push({ a: far[0], b: far[1], at: 0.5, width: 1.2, sill: 2.0, height: 2.6, rise: 0.7 });
  }
  const t = FARA_TOWER;
  for (let k = 0; k < 4; k++) out.push({ a: t[k]!, b: t[(k + 1) % 4]!, at: 0.5, width: 1.6, sill: 25.5, height: 3.6, rise: 1.0 });
  return out;
};

/** The west portal in the tower's west wall on the nave's axis, and the south door between the chapels. */
export const FARA_DOORS: readonly FaraOpening[] = [
  { a: [659.8, 46.6], b: [659.8, 38.2], at: (46.6 - AXIS) / 8.4, width: 2.6, sill: 0, height: 3.6, rise: 1.4 },
  { a: [659.8, 32.6], b: [678.0, 32.6], at: (669.7 - 659.8) / 18.2, width: 2.2, sill: 0, height: 3.2, rise: 1.1 },
];

/** The windows (`windows`) and the doors, each a pane of its own on its wall. */
export const FARA_OPENINGS: readonly FaraOpening[] = [...windows(), ...FARA_DOORS];

/** The hologram's facets: the walls of the nave and the chancel (open to each other) and the tower, the roofs and the spire, the chapels, the windows and the doors. */
export const FARA_HOLO_FACETS: readonly HoloFacet[] = [
  ...walls(FARA_NAVE_WALLS, FARA_HEIGHTS.nave, false),
  ...walls(FARA_CHANCEL, FARA_HEIGHTS.chancel, false),
  ...walls(FARA_TOWER, FARA_HEIGHTS.tower, true),
  ...roofs(),
  ...FARA_CHAPELS.flatMap(chapel),
  ...FARA_OPENINGS.flatMap((o) => openingShape(o).panes),
];

/**
 * The openings' outlines, closed runs of points: the renderer draws them as thin tubes of light (the frame a pane's own
 * edge draws is a few centimetres on a window's pane), so the windows and the doors read on the walls' panes.
 */
export const FARA_HOLO_OUTLINES: readonly (readonly HoloPoint[])[] = FARA_OPENINGS.map((o) => openingShape(o).outline);
