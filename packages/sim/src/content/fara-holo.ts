import { FARA_FOUNDATION_TOP } from "./lublin/fara-pad";
import { groundY } from "./lublin/terrain";
import { distanceToBarrier } from "./lublin/barriers";
import { WORLD_BARRIERS } from "./world-barriers";
import {
  FARA_AXIS,
  FARA_CHANCEL,
  FARA_CROSS,
  FARA_FOUNDATIONS,
  FARA_HEIGHTS,
  FARA_HELMET,
  FARA_LEAN_TOS,
  FARA_NAVE,
  FARA_TOWER,
  type LeanTo,
  type PlanPoint,
  faraWallHeight,
  inPlan,
  leanHeight,
} from "./fara-holo-plan";
import { FARA_DETAIL_FACETS, FARA_DETAIL_LINES } from "./fara-holo-detail";

/*
 * The hologram of St Michael's parish church over its foundations on Plac po Farze (demolished in the 1840s; the card
 * `docs/lokacje/plac-po-farze.md`, ADR-0062: the 2077 layer on a monument is light, never a building). V2 (the user's
 * request of 24.11): its walls rise from every face of the foundations' masonry on the map (`fara-holo-plan.ts`), so the
 * hologram covers them 1:1; over the rooms they close lie the nave's steep gable roof, the chancel's lower one closed on
 * three sides of an octagon, the chapels' and the annexes' lean-tos; the west tower on its four piers carries the
 * lithograph's helmet (an onion, an open lantern, a second onion, the spire and its cross). Pointed windows over the
 * lean-tos and round the apse, a window in each chapel's outer wall, the west portal and the south door.
 *
 * Pattern: the "ghost structure" of museums' reconstructions over a ruin, as panes of light. Every facet is drawn by the
 * renderer as a hologram's pane, the building sites' boards' (`holoPanel`: a faint fill brightest at its foot, a frame of
 * light, scanlines, a flicker), so the church reads as the game's other holograms: see-through, not wholly. Pure data.
 */

export { FARA_CHANCEL, FARA_FOUNDATIONS, FARA_HEIGHTS, FARA_LEAN_TOS, FARA_NAVE, FARA_TOWER, faraWallHeight, leanHeight } from "./fara-holo-plan";

/** A point of a facet: x, y (world height), z. */
export type HoloPoint = readonly [number, number, number];

/** A flat facet of the hologram: three or four corners, in order round it. */
export type HoloFacet = readonly HoloPoint[];

/** Where the hologram is drawn from: the cell holding this point draws it whole. */
export const FARA_HOLO = { x: 676.0, z: 42.3 } as const;

/** The hologram's foot: the foundations' top, one level over the levelled square (`fara-pad.ts`). */
const base = FARA_FOUNDATION_TOP;
const top = (x: number, h: number, z: number): HoloPoint => [x, base + h, z];
/** The foundations' walls in the game (`world-barriers.ts`): cut where a route crosses (Archidiakońska over the south-west chapel's face). */
const RUIN_PIECES = Object.values(WORLD_BARRIERS)
  .flat()
  .filter((p) => p.x > FARA_HOLO.x - 45 && p.x < FARA_HOLO.x + 45 && p.z > FARA_HOLO.z - 45 && p.z < FARA_HOLO.z + 45);
const onMasonry = (x: number, z: number): boolean => RUIN_PIECES.some((p) => distanceToBarrier(p, x, z) < 0.25);
/**
 * A wall's foot: on the foundations' top (their walls level, `levelTop`), on the south-west chapel's walls left on the
 * rising NMT (`fara-pad.ts`) on theirs, and on the paving where the game keeps no wall under it (the curator's review).
 */
const foot = (x: number, z: number): HoloPoint => [x, onMasonry(x, z) ? Math.max(base, groundY(x, z) + 0.5) : groundY(x, z), z];

/** A wall from (a) to (b), from `lo` m (null: its foot) up to `hiA` and `hiB` m over the foundations' top. */
const wall = (a: PlanPoint, b: PlanPoint, hiA: number, hiB: number, lo: number | null = null): HoloFacet => [
  lo === null ? foot(a[0], a[1]) : top(a[0], lo, a[1]),
  lo === null ? foot(b[0], b[1]) : top(b[0], lo, b[1]),
  top(b[0], hiB, b[1]),
  top(a[0], hiA, a[1]),
];

/** Is a point outside the church: off the masonry, the nave, the chancel and every lean-to? */
const outside = (x: number, z: number): boolean =>
  !FARA_FOUNDATIONS.some((r) => inPlan(r, x, z)) &&
  !(x > FARA_NAVE.minX && x < FARA_NAVE.maxX && z > FARA_NAVE.minZ && z < FARA_NAVE.maxZ) &&
  !inPlan(FARA_CHANCEL, x, z) &&
  !FARA_LEAN_TOS.some((l) => inPlan(l.plan, x, z));

/** Does the face from (a) to (b) of a run of masonry look out of the church (else into a room, or a pier's face)? */
const outerFace = (run: readonly PlanPoint[], a: PlanPoint, b: PlanPoint): boolean => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const [mx, mz, nx, nz] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[1] - b[1]) / len, (b[0] - a[0]) / len];
  const off = inPlan(run, mx + nx * 0.4, mz + nz * 0.4) ? -0.4 : 0.4;
  return outside(mx + nx * off, mz + nz * off);
};

/** Every face of the foundations' masonry raised to its zone's height (the hologram stands on them 1:1), outer or inner. */
const masonryWalls = (outer: boolean): HoloFacet[] =>
  FARA_FOUNDATIONS.flatMap((run) =>
    run.slice(1).flatMap((b, k) => {
      const a = run[k]!;
      return outerFace(run, a, b) === outer ? [wall(a, b, faraWallHeight(a[0], a[1]), faraWallHeight(b[0], b[1]))] : [];
    }),
  );

/** The nave's and the chancel's walls over the lean-tos leaning on them, whole between the chapels' partitions. */
const UPPER: readonly { readonly a: PlanPoint; readonly b: PlanPoint; readonly lo: number; readonly hi: number }[] = [
  { a: [FARA_NAVE.minX, FARA_NAVE.minZ], b: [FARA_NAVE.maxX, FARA_NAVE.minZ], lo: FARA_LEAN_TOS[1]!.high, hi: FARA_HEIGHTS.nave },
  { a: [FARA_NAVE.minX, FARA_NAVE.maxZ], b: [FARA_NAVE.maxX, FARA_NAVE.maxZ], lo: FARA_LEAN_TOS[0]!.high, hi: FARA_HEIGHTS.nave },
  { a: FARA_CHANCEL[0]!, b: FARA_CHANCEL[1]!, lo: FARA_LEAN_TOS[2]!.high, hi: FARA_HEIGHTS.chancel },
  { a: FARA_CHANCEL[5]!, b: FARA_CHANCEL[4]!, lo: FARA_LEAN_TOS[3]!.high, hi: FARA_HEIGHTS.chancel },
];

/** The south door's head: the wall over it up to the lean-to's eaves, in the foundations' gap. */
const DOOR_HEAD = { a: [668.0, FARA_NAVE.minZ] as PlanPoint, b: [669.4, FARA_NAVE.minZ] as PlanPoint, lo: 3.6, hi: FARA_LEAN_TOS[1]!.high };

/** The nave's gable roof from the tower's east face to the chancel arch (the tower stands before it, the lithograph's). */
const naveRoof = (): HoloFacet[] => {
  const h = FARA_HEIGHTS;
  const { maxX: x1, minZ: zs, maxZ: zn } = FARA_NAVE;
  const x0 = FARA_TOWER[1]![0];
  return [
    [top(x0, h.nave, zs), top(x1, h.nave, zs), top(x1, h.ridge, FARA_AXIS), top(x0, h.ridge, FARA_AXIS)],
    [top(x1, h.nave, zn), top(x0, h.nave, zn), top(x0, h.ridge, FARA_AXIS), top(x1, h.ridge, FARA_AXIS)],
    [top(x0, h.nave, zn), top(x0, h.nave, zs), top(x0, h.ridge, FARA_AXIS)],
    [top(x1, h.nave, zs), top(x1, h.nave, zn), top(x1, h.ridge, FARA_AXIS)],
  ];
};

/** The chancel's roof: its ridge from the nave to the apse's middle, hipped down to the apse's three sides. */
const chancelRoof = (): HoloFacet[] => {
  const h = FARA_HEIGHTS;
  const c = FARA_CHANCEL;
  const at = (k: number): HoloPoint => top(c[k]![0], h.chancel, c[k]![1]);
  const end = top(690.9, h.chancelRidge, FARA_AXIS);
  const from = top(c[0]![0], h.chancelRidge, FARA_AXIS);
  return [[at(0), at(1), end, from], [at(4), at(5), from, end], ...[1, 2, 3].map((k): HoloFacet => [at(k), at(k + 1), end])];
};

const area2 = (p: readonly PlanPoint[]): number => p.reduce((s, [x, z], i) => s + x * p[(i + 1) % p.length]![1] - p[(i + 1) % p.length]![0] * z, 0);
const insideTri = (p: PlanPoint, a: PlanPoint, b: PlanPoint, c: PlanPoint): boolean => {
  const s = (u: PlanPoint, v: PlanPoint) => (v[0] - u[0]) * (p[1] - u[1]) - (v[1] - u[1]) * (p[0] - u[0]);
  return s(a, b) >= 0 && s(b, c) >= 0 && s(c, a) >= 0;
};

/** Ear clipping of a simple plan (Meisters, 1975): its triangles, each counter-clockwise. */
export const triangulate = (plan: readonly PlanPoint[]): [PlanPoint, PlanPoint, PlanPoint][] => {
  const pts = area2(plan) < 0 ? [...plan].reverse() : [...plan];
  const out: [PlanPoint, PlanPoint, PlanPoint][] = [];
  while (pts.length > 3) {
    const n = pts.length;
    const k = pts.findIndex((b, i) => {
      const [a, c] = [pts[(i + n - 1) % n]!, pts[(i + 1) % n]!];
      if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) <= 0) return false;
      return !pts.some((p) => p !== a && p !== b && p !== c && insideTri(p, a, b, c));
    });
    const i = k < 0 ? 0 : k;
    out.push([pts[(i + n - 1) % n]!, pts[i]!, pts[(i + 1) % n]!]);
    pts.splice(i, 1);
  }
  out.push([pts[0]!, pts[1]!, pts[2]!]);
  return out;
};

/** A lean-to's roof on its plane: its plan's triangles at its height. */
const leanRoof = (l: LeanTo): HoloFacet[] => triangulate(l.plan).map((t) => t.map(([x, z]) => top(x, leanHeight(l, z), z)));

/** The tower's middle, its walls on its piers from the foundations up, its cornice's cap. */
const TOWER_MID = { x: (FARA_TOWER[0]![0] + FARA_TOWER[1]![0]) / 2, z: (FARA_TOWER[0]![1] + FARA_TOWER[2]![1]) / 2 } as const;
const tower = (): HoloFacet[] => [
  ...FARA_TOWER.map((a, k) => wall(a, FARA_TOWER[(k + 1) % 4]!, FARA_HEIGHTS.tower, FARA_HEIGHTS.tower, FARA_HEIGHTS.nave)),
  FARA_TOWER.map(([x, z]) => top(x, FARA_HEIGHTS.tower, z)),
];
/** The tower's walls in the nave, under its roof: from the foundations to the nave's eaves. */
const towerInNave = (): HoloFacet[] => FARA_TOWER.map((a, k) => wall(a, FARA_TOWER[(k + 1) % 4]!, FARA_HEIGHTS.nave, FARA_HEIGHTS.nave));

/** The helmet: an octagon's rings after the lithograph, a band of eight panes between each two, and the spire's cross. */
const HELMET_SIDES = 8;
const helmet = (): HoloFacet[] => {
  const ring = ([r, h]: PlanPoint, k: number): HoloPoint => {
    const a = (2 * Math.PI * k) / HELMET_SIDES + Math.PI / HELMET_SIDES;
    return top(TOWER_MID.x + r * Math.cos(a), h, TOWER_MID.z + r * Math.sin(a));
  };
  const out: HoloFacet[] = [];
  for (let i = 0; i + 1 < FARA_HELMET.length; i++)
    for (let k = 0; k < HELMET_SIDES; k++) out.push([ring(FARA_HELMET[i]!, k), ring(FARA_HELMET[i]!, k + 1), ring(FARA_HELMET[i + 1]!, k + 1), ring(FARA_HELMET[i + 1]!, k)]);
  const c = FARA_CROSS;
  const w = 0.07;
  const { x, z } = TOWER_MID;
  out.push([top(x - w, c.foot, z), top(x + w, c.foot, z), top(x + w, c.top, z), top(x - w, c.top, z)]);
  out.push([top(x - c.half, c.arms - w, z), top(x + c.half, c.arms - w, z), top(x + c.half, c.arms + w, z), top(x - c.half, c.arms + w, z)]);
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
const MIDDLE = { x: 676, z: FARA_AXIS } as const;

/** An opening's pane and its outline (its corners round it, the arch's point among them), off the wall's outer face. */
const openingShape = (o: FaraOpening): { readonly panes: HoloFacet[]; readonly outline: HoloPoint[]; readonly more: HoloPoint[][] } => {
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
    more: tracery(o, p),
  };
};

/**
 * A window's tracery and a door's archivolts (the bronze model's pointed windows and stepped portals): a mullion up a
 * window wide and tall enough and a small round (an oculus) in its arch; two arches round a door, each wider and higher.
 */
const tracery = (o: FaraOpening, p: (s: number, h: number) => HoloPoint): HoloPoint[][] => {
  const w = o.width / 2;
  const spring = o.sill + o.height;
  if (o.sill === 0)
    return [0.3, 0.6].map((d) => [p(-w - d, 0), p(-w - d, spring + d * 0.4), p(0, spring + o.rise + d * 1.1), p(w + d, spring + d * 0.4), p(w + d, 0), p(w + d, spring + d * 0.4), p(0, spring + o.rise + d * 1.1), p(-w - d, spring + d * 0.4)]);
  if (o.width < 1.1 || o.height < 1.8) return [];
  const r = o.width * 0.2;
  const c = spring + o.rise * 0.35;
  const oculus = Array.from({ length: 6 }, (_, k) => p(r * Math.cos((k * Math.PI) / 3), c + r * Math.sin((k * Math.PI) / 3)));
  return [[p(0, o.sill), p(0, c - r)], oculus];
};

/** A window in each long enough outer face of the chapels and the annexes: the masonry's faces with the outside before them. */
const chapelWindows = (): FaraOpening[] =>
  FARA_FOUNDATIONS.flatMap((run) =>
    run.slice(1).flatMap((b, k): FaraOpening[] => {
      const a = run[k]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const [mx, mz] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const h = Math.min(faraWallHeight(a[0], a[1]), faraWallHeight(b[0], b[1]));
      if (len < 2.4 || h > FARA_LEAN_TOS[2]!.high + 0.01 || mx >= 690.6) return [];
      const [nx, nz] = [(a[1] - b[1]) / len, (b[0] - a[0]) / len];
      if (outside(mx + nx * 0.8, mz + nz * 0.8) === outside(mx - nx * 0.8, mz - nz * 0.8)) return [];
      return [{ a, b, at: 0.5, width: 1.1, sill: 2.0, height: Math.min(2.6, h - 2.0 - 0.7 - 0.6), rise: 0.7 }];
    }),
  ).filter((o) => o.height >= 1.2);

/** Lancets in the nave's walls over the chapels, round the apse and in the chancel's over the annexes, the chapels', the tower's belfry. */
const windows = (): FaraOpening[] => {
  const out: FaraOpening[] = [];
  const naveLen = FARA_NAVE.maxX - FARA_NAVE.minX;
  for (const x of [669.1, 674.6])
    for (const z of [FARA_NAVE.minZ, FARA_NAVE.maxZ]) out.push({ a: [FARA_NAVE.minX, z], b: [FARA_NAVE.maxX, z], at: (x - FARA_NAVE.minX) / naveLen, width: 1.4, sill: 9.2, height: 2.4, rise: 0.8 });
  const c = FARA_CHANCEL;
  for (const k of [1, 2, 3]) out.push({ a: c[k]!, b: c[k + 1]!, at: 0.5, width: 1.3, sill: 3.5, height: 5.0, rise: 1.4 });
  for (const [a, b] of [[c[0]!, c[1]!], [c[5]!, c[4]!]] as const) for (const at of [0.4, 0.75]) out.push({ a, b, at, width: 1.1, sill: 9.4, height: 1.5, rise: 0.5 });
  out.push(...chapelWindows());
  const t = FARA_TOWER;
  for (let k = 0; k < 4; k++) {
    out.push({ a: t[k]!, b: t[(k + 1) % 4]!, at: 0.5, width: 1.6, sill: 33.0, height: 3.6, rise: 1.0 });
    // The storey under the belfry, over the nave's ridge: a pair of narrow windows on each face (the bronze model).
    for (const at of [0.32, 0.68]) out.push({ a: t[k]!, b: t[(k + 1) % 4]!, at, width: 0.8, sill: 28.2, height: 2.4, rise: 0.6 });
  }
  // Over the west portal, a tall window lighting the tower's ground storey.
  out.push({ a: [659.8, 46.6], b: [659.8, 38.2], at: (46.6 - FARA_AXIS) / 8.4, width: 1.6, sill: 7.8, height: 3.2, rise: 1.0 });
  return out;
};

/** The west portal in the tower's west wall on the nave's axis, in the foundations' gap there, and the south door in the gap of the south wall. */
export const FARA_DOORS: readonly FaraOpening[] = [
  { a: [659.8, 46.6], b: [659.8, 38.2], at: (46.6 - FARA_AXIS) / 8.4, width: 2.6, sill: 0, height: 3.6, rise: 1.4 },
  // In the foundations' gap of the south wall (x 668.1-669.3, between r18507551 and r18507552), the porch south of it.
  { a: [667.6, FARA_NAVE.minZ], b: [669.8, FARA_NAVE.minZ], at: 0.5, width: 1.2, sill: 0, height: 2.8, rise: 0.8 },
];

/** The windows (`windows`) and the doors, each a pane of its own on its wall. */
export const FARA_OPENINGS: readonly FaraOpening[] = [...windows(), ...FARA_DOORS];

/** The hologram's shell: the masonry's outer faces, the walls over the lean-tos, the roofs, the tower and its helmet, the openings. */
export const FARA_HOLO_FACETS: readonly HoloFacet[] = [
  ...masonryWalls(true),
  ...UPPER.map((u) => wall(u.a, u.b, u.hi, u.hi, u.lo)),
  wall(DOOR_HEAD.a, DOOR_HEAD.b, DOOR_HEAD.hi, DOOR_HEAD.hi, DOOR_HEAD.lo),
  ...naveRoof(),
  ...chancelRoof(),
  ...FARA_LEAN_TOS.flatMap(leanRoof),
  ...tower(),
  ...helmet(),
  ...FARA_DETAIL_FACETS,
  ...FARA_OPENINGS.flatMap((o) => openingShape(o).panes),
];

/**
 * Inside the shell, drawn fainter (else the panes of a hall church's thick walls and piers pile up into a glare): the
 * masonry's faces towards the rooms, the piers' faces, the tower's walls down in the nave.
 */
export const FARA_HOLO_INNER: readonly HoloFacet[] = [...masonryWalls(false), ...towerInNave()];

/**
 * The openings' outlines, closed runs of points: the renderer draws them as thin tubes of light (the frame a pane's own
 * edge draws is a few centimetres on a window's pane), so the windows and the doors read on the walls' panes.
 */
export const FARA_HOLO_OUTLINES: readonly (readonly HoloPoint[])[] = [
  ...FARA_OPENINGS.flatMap((o) => {
    const s = openingShape(o);
    return [s.outline, ...s.more];
  }),
  ...FARA_DETAIL_LINES,
];
