import { FARA_FOUNDATION_TOP } from "./lublin/fara-pad";
import { FARA_AXIS, FARA_CHANCEL, FARA_HEIGHTS, FARA_LEAN_TOS, FARA_NAVE, FARA_TOWER, type PlanPoint, leanHeight } from "./fara-holo-plan";

/*
 * The parish church's hologram's detail after the bronze model by the terrace and the lithograph of the 1840s (the
 * user's request of 24.11: every detail they show, far more of it): stepped buttresses round the apse, on the nave over
 * the chapels and on the chancel over the annexes; the cornices and string courses (the eaves, the tower's storeys, the
 * sills); the ridge turret (sygnaturka) on the nave; dormers in its roof; the cross laid in the chancel's roof tiles; the
 * north chapels' gables; crosses on the gables. Panes and lines of light as the rest (`fara-holo.ts`). Pure data.
 */

type P3 = readonly [number, number, number];
type Facet = readonly P3[];

const base = FARA_FOUNDATION_TOP;
const at = (x: number, h: number, z: number): P3 => [x, base + h, z];

/** A buttress's tier: out from the wall to `depth`, up to `top`, its cap falling from the wall to its face. */
interface Tier {
  readonly depth: number;
  readonly top: number;
}

/**
 * A stepped buttress at a wall's foot point, out along (ox, oz), `width` wide, its tiers from `from` m up, each with a
 * sloped cap (the weathering of a Gothic buttress: each set-off slopes to shed the rain).
 */
const buttress = (p: PlanPoint, o: PlanPoint, width: number, from: number, tiers: readonly Tier[]): Facet[] => {
  const l = Math.hypot(o[0], o[1]);
  const [ox, oz] = [o[0] / l, o[1] / l];
  const [sx, sz] = [-oz * (width / 2), ox * (width / 2)];
  const q = (d: number, s: number, h: number): P3 => at(p[0] + ox * d + sx * s, h, p[1] + oz * d + sz * s);
  const out: Facet[] = [];
  let lo = from;
  for (const t of tiers) {
    const cap = Math.min(0.5, (t.top - lo) / 3);
    out.push([q(t.depth, -1, lo), q(t.depth, 1, lo), q(t.depth, 1, t.top - cap), q(t.depth, -1, t.top - cap)]);
    for (const s of [-1, 1]) out.push([q(0, s, lo), q(t.depth, s, lo), q(t.depth, s, t.top - cap), q(0, s, t.top)]);
    out.push([q(t.depth, -1, t.top - cap), q(t.depth, 1, t.top - cap), q(0, 1, t.top), q(0, -1, t.top)]);
    lo = t.top - cap;
  }
  return out;
};

const [north, south, southEast, northEast] = FARA_LEAN_TOS as readonly [(typeof FARA_LEAN_TOS)[number], (typeof FARA_LEAN_TOS)[number], (typeof FARA_LEAN_TOS)[number], (typeof FARA_LEAN_TOS)[number]];

/** The apse's buttresses: at its corners, out along the foundations' spurs. */
const APSE_BUTTRESSES: readonly (readonly [PlanPoint, PlanPoint])[] = [
  [[690.4, 38.6], [1.2, -3.0]],
  [[692.3, 40.8], [3.0, -1.4]],
  [[692.3, 43.2], [2.8, 2.6]],
  [[690.7, 45.8], [1.0, 3.0]],
];

/** The apse's buttresses on the foundations' spurs (their 4 m stubs, `faraWallHeight`), and the nave's and chancel's over the lean-tos. */
const buttresses = (): Facet[] => [
  ...APSE_BUTTRESSES.flatMap(([p, o]) => buttress(p, o, 0.9, FARA_HEIGHTS.buttress, [{ depth: 2.0, top: 7.5 }, { depth: 1.1, top: 10.6 }])),
  ...[665.8, 671.7].flatMap((x) => buttress([x, FARA_NAVE.maxZ], [0, 1], 0.9, north.high, [{ depth: 0.9, top: 11.8 }])),
  ...[671.6, 675.4].flatMap((x) => buttress([x, FARA_NAVE.minZ], [0, -1], 0.9, south.high, [{ depth: 0.9, top: 11.8 }])),
  ...[682.2, 686.5].flatMap((x) => [
    ...buttress([x, 38.5], [0, -1], 0.8, southEast.high, [{ depth: 0.8, top: 11.0 }]),
    ...buttress([x, 46.2], [0, 1], 0.8, northEast.high, [{ depth: 0.8, top: 11.0 }]),
  ]),
];

/** The west bay's side roofs, from the nave's walls up to the tower's sides, and their ends: the tower stands before the nave's roof. */
export const TOWER_SIDE_ROOF = 18;
const westBay = (): Facet[] => {
  const [x0, x1] = [FARA_NAVE.minX, FARA_TOWER[1]![0]];
  const [zs, zn, ts, tn] = [FARA_NAVE.minZ, FARA_NAVE.maxZ, FARA_TOWER[0]![1], FARA_TOWER[2]![1]];
  const [e, r] = [FARA_HEIGHTS.nave, TOWER_SIDE_ROOF];
  return [
    [at(x0, e, zs), at(x1, e, zs), at(x1, r, ts), at(x0, r, ts)],
    [at(x1, e, zn), at(x0, e, zn), at(x0, r, tn), at(x1, r, tn)],
    [at(x0, e, zs), at(x0, r, ts), at(x0, e, ts)],
    [at(x0, e, tn), at(x0, r, tn), at(x0, e, zn)],
  ];
};

/** A closed run there and back along an open one: the renderer's outlines are closed, so a line is drawn as one. */
const line = (pts: readonly P3[]): P3[] => [...pts, ...pts.slice(1, -1).reverse()];
const loop = (pts: readonly PlanPoint[], h: number, out = 0.08): P3[] => {
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cz = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return pts.map(([x, z]) => {
    const l = Math.hypot(x - cx, z - cz) || 1;
    return at(x + ((x - cx) / l) * out, h, z + ((z - cz) / l) * out);
  });
};

/** The cornices and string courses: the eaves of the nave and the chancel, the tower's storeys, the sill courses. */
const courses = (): P3[][] => {
  const n = FARA_NAVE;
  const nave: PlanPoint[] = [[n.minX, n.minZ], [n.maxX, n.minZ], [n.maxX, n.maxZ], [n.minX, n.maxZ]];
  const apse = FARA_CHANCEL.slice(1, 5);
  return [
    loop(nave, FARA_HEIGHTS.nave),
    loop(FARA_CHANCEL, FARA_HEIGHTS.chancel),
    ...[FARA_HEIGHTS.ridge + 0.6, 32.4, FARA_HEIGHTS.tower - 0.4].map((h) => loop(FARA_TOWER, h, 0.12)),
    line(apse.map(([x, z]) => at(x + (x > 691 ? 0.08 : 0), 3.3, z))),
    line([at(n.minX, 9.0, n.minZ - 0.08), at(n.maxX, 9.0, n.minZ - 0.08)]),
    line([at(n.minX, 9.0, n.maxZ + 0.08), at(n.maxX, 9.0, n.maxZ + 0.08)]),
  ];
};

/** An octagon's rings round (cx, cz), (radius, height) from the bottom up, eight panes between each two. */
export const revolve = (cx: number, cz: number, profile: readonly PlanPoint[]): Facet[] => {
  const ring = ([r, h]: PlanPoint, k: number): P3 => {
    const a = (2 * Math.PI * k) / 8 + Math.PI / 8;
    return at(cx + r * Math.cos(a), h, cz + r * Math.sin(a));
  };
  const out: Facet[] = [];
  for (let i = 0; i + 1 < profile.length; i++) for (let k = 0; k < 8; k++) out.push([ring(profile[i]!, k), ring(profile[i]!, k + 1), ring(profile[i + 1]!, k + 1), ring(profile[i + 1]!, k)]);
  return out;
};

/** A cross of light at (x, z) from `h` up `tall` m, its arms `span` m across, facing along x. */
export const cross = (x: number, z: number, h: number, tall: number, span: number): Facet[] => {
  const w = 0.06;
  const arms = h + tall * 0.68;
  return [
    [at(x - w, h, z), at(x + w, h, z), at(x + w, h + tall, z), at(x - w, h + tall, z)],
    [at(x - span / 2, arms - w, z), at(x + span / 2, arms - w, z), at(x + span / 2, arms + w, z), at(x - span / 2, arms + w, z)],
  ];
};

/** The ridge turret on the nave's ridge over its east bay (the bronze model): a lantern, a small onion and a spire. */
const RIDGE_TURRET: readonly PlanPoint[] = [
  [0.55, FARA_HEIGHTS.ridge - 0.6],
  [0.55, FARA_HEIGHTS.ridge + 1.6],
  [0.7, FARA_HEIGHTS.ridge + 2.2],
  [0.35, FARA_HEIGHTS.ridge + 2.9],
  [0.05, FARA_HEIGHTS.ridge + 6.0],
];
const RIDGE_TURRET_AT = { x: 675.6, z: FARA_AXIS } as const;

/** The nave's main roof's height at z: from the eaves on its walls to the ridge on the axis. */
const naveRoofAt = (z: number): number => {
  const half = z < FARA_AXIS ? FARA_AXIS - FARA_NAVE.minZ : FARA_NAVE.maxZ - FARA_AXIS;
  return FARA_HEIGHTS.ridge - ((FARA_HEIGHTS.ridge - FARA_HEIGHTS.nave) * Math.abs(z - FARA_AXIS)) / half;
};

/** Small dormers in the nave's roof (the lithograph's roof lights): a gabled front standing on the roof, its window's outline. */
const DORMERS: readonly PlanPoint[] = [
  [670.0, 36.2],
  [675.0, 36.2],
  [670.0, 48.6],
  [675.0, 48.6],
];
const dormers = (): { facets: Facet[]; lines: P3[][] } => {
  const facets: Facet[] = [];
  const lines: P3[][] = [];
  for (const [x, z] of DORMERS) {
    const h = naveRoofAt(z);
    const w = 0.6;
    facets.push([at(x - w, h, z), at(x + w, h, z), at(x + w, h + 0.7, z), at(x - w, h + 0.7, z)]);
    facets.push([at(x - w, h + 0.7, z), at(x + w, h + 0.7, z), at(x, h + 1.2, z)]);
    lines.push([at(x - 0.25, h + 0.15, z), at(x + 0.25, h + 0.15, z), at(x + 0.25, h + 0.6, z), at(x - 0.25, h + 0.6, z)]);
  }
  return { facets, lines };
};

/** The cross laid in the chancel's south roof (the lithograph), a closed outline in the roof's plane. */
const roofCross = (): P3[] => {
  const [z0, h0] = [38.5, FARA_HEIGHTS.chancel];
  const roof = (x: number, z: number): P3 => at(x, h0 + ((FARA_HEIGHTS.chancelRidge - h0) * (z - z0)) / (FARA_AXIS - z0) + 0.05, z);
  const [cx, w] = [685.0, 0.25];
  const [zb, zt, za] = [39.2, 41.9, 41.1];
  const arm = 1.3;
  return [
    roof(cx - w, zb), roof(cx + w, zb), roof(cx + w, za - w), roof(cx + arm, za - w), roof(cx + arm, za + w),
    roof(cx + w, za + w), roof(cx + w, zt), roof(cx - w, zt), roof(cx - w, za + w), roof(cx - arm, za + w),
    roof(cx - arm, za - w), roof(cx - w, za - w),
  ];
};

/** The north chapels' gables on their outer walls (the bronze model): each bay's (x0, x1, its outer wall's z). */
const NORTH_GABLES: readonly (readonly [number, number, number])[] = [
  [662.1, 665.1, 56.5],
  [666.3, 670.9, 57.6],
  [672.5, 677.9, 57.3],
];
const gables = (): Facet[] =>
  NORTH_GABLES.map(([x0, x1, z]): Facet => {
    const h = leanHeight(north, z);
    return [at(x0, h, z + 0.05), at(x1, h, z + 0.05), at((x0 + x1) / 2, h + 2.2, z + 0.05)];
  });

/** The detail's panes. */
export const FARA_DETAIL_FACETS: readonly Facet[] = [
  ...buttresses(),
  ...westBay(),
  ...revolve(RIDGE_TURRET_AT.x, RIDGE_TURRET_AT.z, RIDGE_TURRET),
  ...cross(RIDGE_TURRET_AT.x, RIDGE_TURRET_AT.z, FARA_HEIGHTS.ridge + 6.0, 1.2, 0.6),
  ...dormers().facets,
  ...gables(),
  ...cross(FARA_TOWER[1]![0] + 0.05, FARA_AXIS, FARA_HEIGHTS.ridge, 1.6, 0.9),
  ...cross(690.9, FARA_AXIS, FARA_HEIGHTS.chancelRidge, 1.4, 0.8),
  ...NORTH_GABLES.flatMap(([x0, x1, z]) => cross((x0 + x1) / 2, z + 0.05, leanHeight(north, z) + 2.2, 0.8, 0.45)),
];

/** The detail's lines of light: the courses, the dormers' windows, the roof's cross. */
export const FARA_DETAIL_LINES: readonly (readonly P3[])[] = [...courses(), ...dormers().lines, roofCross()];
