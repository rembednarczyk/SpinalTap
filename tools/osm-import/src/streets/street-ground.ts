/**
 * The streets' ground from the street network (ADR-0104, stage E1): the carriageways, their
 * junctions' kerb corners, the sidewalks and the zebras built as one geometry, not cut and patched
 * after each other. Pure geometry: no chunks, no tables, no map tags (the caller gives each way's
 * widths from its cross section, ADR-0080).
 *
 * 1. The junctions are the points two axes or more share (one OSM node, one point of the world).
 * 2. A street's carriageway is the band of its axis, `left` and `right` m each side, round joins,
 *    square ends; the carriageways `C` are the union of all.
 * 3. A junction's kerb corners: `C` closed by the corner's radius (grown, then shrunk: a concave
 *    corner gets an arc, a convex one stays) within a disc round the junction, so two carriageways
 *    of a dual road apart elsewhere are not run into one.
 * 4. The sidewalks: `C` grown by a side's sidewalk width, within that side's corridor along its
 *    axis (and the discs of its junctions, round the corners), less `C` and the buildings. Their
 *    inner edge is the kerb: the same line as the carriageway's edge, by construction.
 * 5. A zebra: a rectangle across its street's axis at the crossing node, within `C` near it.
 *
 * Pattern: street shapes from a street graph (CityEngine; Parish and Müller, "Procedural Modeling
 * of Cities", 2001; OSM2World), kerb corners by morphological closing (Serra), the shared edge of a
 * planar partition (`difference`). Unlike a full arrangement (DCEL) the layers are areas, as the
 * game's ground is outlines.
 */
import { type Pt, offsetLine } from "../geometry.ts";
import { type Area, areaOfRing, band, disc, grown, join, less, rings, within } from "./clip.ts";

export interface StreetEdge {
  /** The OSM way (the bands' source). */
  readonly way: string;
  /** The carriageway's axis. */
  readonly axis: readonly Pt[];
  /** m from the axis to the kerb on its left (`offsetLine`'s positive side) and on its right. */
  readonly left: number;
  readonly right: number;
  /** m of sidewalk past the kerb on each side; 0, none. */
  readonly walkLeft: number;
  readonly walkRight: number;
  /** m of verge between the kerb and the sidewalk on each side (ADR-0080's `verge`); 0 or none, the sidewalk at the kerb. */
  readonly vergeLeft?: number;
  readonly vergeRight?: number;
  /** The radius of its kerb's corners at its junctions (m). */
  readonly kerbRadius: number;
}

export interface StreetCrossing {
  /** The crossing node, on its street's axis. */
  readonly at: Pt;
  /** The zebra's width along the axis (m). */
  readonly width: number;
}

export interface StreetGround {
  readonly carriageway: Pt[][];
  readonly sidewalks: Pt[][];
  readonly crossings: Pt[][];
  /** The junctions: the points three arms of the streets or more meet at. */
  readonly junctions: Pt[];
}

/** How far past the widest street's kerb and its corner a junction's disc reaches (m). */
const JUNCTION_MARGIN = 1;
/** The farthest a junction's corner may round off (m): two streets meeting at a few degrees would close for a hundred metres. */
const CORNER_REACH_MAX = 40;
/** How fast a street's kerb narrows from a wider piece to a narrower one (m a metre, ADR-0080 decision 1). */
const RAMP = 0.1;
/** The longest such ramp (m). */
const RAMP_MAX = 10;
/** Slivers of sidewalk thinner than twice this are dropped (m). */
const SLIVER = 0.02;
/** How far a sidewalk's corridor reaches past its outer edge (m): wide enough for the grown kerb, never to the next street's far side. */
const CORRIDOR_MARGIN = 0.25;

const key = (p: Pt) => `${Math.round(p.x * 1000)},${Math.round(p.z * 1000)}`;

/** A point two axes or more share: its streets and how many arms meet there (an axis through it two, one ending there one). */
export interface Node {
  readonly at: Pt;
  readonly edges: number[];
  readonly arms: number;
}

/** The points two axes or more share. Three arms and more are a junction; two, one street's two pieces in a row. */
export const nodes = (edges: readonly StreetEdge[]): Node[] => {
  const at = new Map<string, { at: Pt; edges: Set<number>; arms: number }>();
  edges.forEach((e, i) => {
    e.axis.forEach((p, k) => {
      const key_ = key(p);
      const j = at.get(key_) ?? { at: p, edges: new Set<number>(), arms: 0 };
      j.edges.add(i);
      j.arms += k === 0 || k === e.axis.length - 1 ? 1 : 2;
      at.set(key_, j);
    });
  });
  return [...at.values()].filter((j) => j.edges.size >= 2).map((j) => ({ at: j.at, edges: [...j.edges].sort((a, b) => a - b), arms: j.arms }));
};

/** A street's carriageway: the band of its axis moved to the middle of its two sides. */
const carriagewayOf = (e: StreetEdge): Area => band(Math.abs(e.left - e.right) < 1e-9 ? e.axis : offsetLine(e.axis, (e.left - e.right) / 2), (e.left + e.right) / 2);

/** The kerb's half widths of a node's streets: the widest and the narrowest. */
const halves = (edges: readonly StreetEdge[], j: Node): [number, number] => {
  const hs = j.edges.flatMap((i) => [edges[i]!.left, edges[i]!.right]);
  return [Math.max(...hs), Math.min(...hs)];
};

/** Two discs and the strip between them along their outer tangents: a kerb narrowing from `ra` round `a` to `rb` round `b`. */
const taper = (a: Pt, ra: number, b: Pt, rb: number): Area => {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  if (d <= Math.abs(ra - rb) + 1e-9) return ra >= rb ? disc(a, ra) : disc(b, rb);
  const u = { x: (b.x - a.x) / d, z: (b.z - a.z) / d };
  const n = { x: -u.z, z: u.x };
  const c = (ra - rb) / d;
  const s = Math.sqrt(1 - c * c);
  const at = (p: Pt, r: number, side: number) => ({ x: p.x + r * (c * u.x + side * s * n.x), z: p.z + r * (c * u.z + side * s * n.z) });
  return join(disc(a, ra), disc(b, rb), areaOfRing([at(a, ra, 1), at(b, rb, 1), at(b, rb, -1), at(a, ra, -1)]));
};

/** The point `len` m along an axis from its end at `p` (the axis's own end if shorter). */
const awayFrom = (axis: readonly Pt[], p: Pt, len: number): Pt => {
  const line = key(axis[0]!) === key(p) ? axis : [...axis].reverse();
  let left = len;
  for (let i = 0; i + 1 < line.length; i++) {
    const [a, b] = [line[i]!, line[i + 1]!];
    const l = Math.hypot(b.x - a.x, b.z - a.z);
    if (l >= left) return { x: a.x + ((b.x - a.x) * left) / l, z: a.z + ((b.z - a.z) * left) / l };
    left -= l;
  }
  return line[line.length - 1]!;
};

/** The directions the node's streets leave it in: one an axis ending there, two an axis through it. */
const armsAt = (edges: readonly StreetEdge[], j: Node): number[] =>
  j.edges.flatMap((i) => {
    const axis = edges[i]!.axis;
    const k = axis.findIndex((p) => key(p) === key(j.at));
    const toward = (q: Pt | undefined) => (q ? [Math.atan2(q.z - j.at.z, q.x - j.at.x)] : []);
    return k < 0 ? [] : [...toward(axis[k - 1]), ...toward(axis[k + 1])];
  });

/**
 * How far a junction's disc reaches: past where the rounding of its sharpest corner meets the two
 * kerbs. Two kerbs `wide` off axes at an angle θ meet `wide / sin(θ/2)` from the node, and an arc of
 * radius `r` touches them `r / tan(θ/2)` on from there (a fillet, the corner of two lines rounded);
 * a disc short of the touching points cut the arc and left a step in the kerb at an acute corner.
 */
export const cornerReach = (arms: readonly number[], wide: number, r: number): number => {
  const sorted = [...arms].sort((a, b) => a - b);
  const gaps = sorted.map((a, i) => (i + 1 < sorted.length ? sorted[i + 1]! - a : sorted[0]! + 2 * Math.PI - a));
  const sharp = Math.min(Math.PI, ...gaps.filter((g) => g > 1e-3));
  const t = Math.tan(sharp / 2);
  const touch = t > 1e-6 ? Math.hypot((wide + r) / t, wide) : Infinity;
  return Math.min(CORNER_REACH_MAX, Math.max(wide + r, touch)) + JUNCTION_MARGIN;
};

/** How far two arms may bend off a straight line and still be one street going on (rad): a joint, not a corner. */
const STRAIGHT_ON = Math.PI / 6;

/**
 * Whether a node's two arms run on in a line (a street's two pieces, a width step ramped between
 * them); two arms at an angle are a corner, rounded as a junction's: Lubartowska turning into Olejna
 * where the deptak, off the graph, leaves them two (its 6.35 m disc lapped 3 m over the deptak).
 */
const straightOn = (arms: readonly number[]): boolean => {
  if (arms.length !== 2) return true;
  // The angle between them, 0..π: π for a street going straight on.
  const between = Math.abs(((arms[0]! - arms[1]! + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
  return Math.PI - between <= STRAIGHT_ON;
};

/**
 * The carriageways with each junction's concave corners rounded by its streets' kerb radius, and
 * each joint of one street's two pieces closed: their square ends at a slant left a notch outside
 * the bend, and a narrower piece after a wider one a step in the kerb, ramped here over the
 * narrower piece (`RAMP`).
 */
const cornered = (base: Area, edges: readonly StreetEdge[], at: readonly Node[]): Area => {
  // A junction's concave corners rounded by its streets' kerb radius.
  const rounded = (j: Node, wide: number): Area => {
    const r = Math.max(...j.edges.map((i) => edges[i]!.kerbRadius));
    if (r <= 0) return [];
    const reach = cornerReach(armsAt(edges, j), wide, r);
    // Closed within a wider disc than kept, so the closing's own edge is out of the kept one; of the
    // node's own streets only: a carriageway near it that does not meet it (a dual road's other half)
    // is not cornered to it, or its median under 2r wide went under the asphalt.
    const near = within(join(...j.edges.map((i) => carriagewayOf(edges[i]!))), disc(j.at, reach + 2 * r));
    return within(grown(grown(near, r), -r), disc(j.at, reach));
  };
  const corners = at.map((j) => {
    const [wide, narrow] = halves(edges, j);
    if (j.arms >= 3) return rounded(j, wide);
    // Two arms at an angle: a corner, rounded inside, the notch outside its bend closed by the narrower half's disc.
    if (!straightOn(armsAt(edges, j))) return join(disc(j.at, narrow), rounded(j, wide));
    const thin = j.edges.find((i) => Math.max(edges[i]!.left, edges[i]!.right) <= narrow + 1e-9);
    if (wide - narrow < 0.01 || thin === undefined) return disc(j.at, narrow);
    return taper(j.at, wide, awayFrom(edges[thin]!.axis, j.at, Math.min((wide - narrow) / RAMP, RAMP_MAX)), narrow);
  });
  return join(base, ...corners);
};

/** A side's corridor: the strip of the side from its axis out past its sidewalk, square ends (a dead end's sidewalk stops square; a junction's corners are in its disc). */
/** A side's kerb, verge and sidewalk (m). */
const sideOf = (e: StreetEdge, side: 1 | -1): { kerb: number; verge: number; walk: number } =>
  side > 0 ? { kerb: e.left, verge: e.vergeLeft ?? 0, walk: e.walkLeft } : { kerb: e.right, verge: e.vergeRight ?? 0, walk: e.walkRight };

const corridor = (e: StreetEdge, side: 1 | -1): Area => {
  const { kerb, verge, walk } = sideOf(e, side);
  const outer = kerb + verge + walk + CORRIDOR_MARGIN;
  return band(offsetLine(e.axis, (side * outer) / 2), outer / 2);
};

/** The streets' areas: the carriageways `c`, the sidewalks, and each street's own share of both (overlapping at the junctions). */
export interface StreetAreas {
  readonly c: Area;
  readonly sidewalks: Area;
  readonly nodes: readonly Node[];
  /** Each street's carriageway (its band and its junctions' discs, within `c`) and each of its sides' sidewalk. */
  readonly own: readonly { readonly edge: number; readonly surface: "road" | "sidewalk"; readonly area: Area }[];
  /** The sidewalks no street's sides reach: of `walks` given beyond theirs. */
  readonly rest: Area;
  /** The verges between the kerbs and the sidewalks: left bare, for the orthophoto's cover to lay (`bare-cover.ts`). */
  readonly verges: Area;
}

/** A node's disc: as far as its sharpest corner's rounding (`cornerReach`) and `extra` past it. */
const nodeDisc = (edges: readonly StreetEdge[], j: Node, extra: number): Area => disc(j.at, cornerReach(armsAt(edges, j), halves(edges, j)[0], Math.max(...j.edges.map((k) => edges[k]!.kerbRadius))) + extra);

/**
 * The streets' carriageways with their corners and their sidewalks, and each street's share.
 * `walks`: more sidewalk, mapped on its own (`footway=sidewalk`), laid with the streets' as one.
 */
export const streetAreas = (edges: readonly StreetEdge[], buildings: readonly (readonly Pt[])[] = [], walks: Area = []): StreetAreas => {
  const all = nodes(edges);
  const c = cornered(join(...edges.map(carriagewayOf)), edges, all);
  const zones: { edge: number; zone: Area }[] = [];
  const grownWalks: Area[] = [walks];
  // The corridors of the sides with a sidewalk, and round each node the corners between them: the
  // node's disc within a corner's radius of them (no sidewalk wraps round a side that has none).
  const sides = edges.flatMap((e, i) => ([1, -1] as const).filter((side) => (side > 0 ? e.walkLeft : e.walkRight) > 0).map((side) => ({ edge: i, side, corridor: corridor(e, side) })));
  const corners = all.map((j) => {
    const r = Math.max(...j.edges.map((k) => edges[k]!.kerbRadius));
    const at = sides.filter((x) => j.edges.includes(x.edge));
    return at.length === 0 ? [] : within(nodeDisc(edges, j, Math.max(...at.map((x) => sideOf(edges[x.edge]!, x.side).walk + sideOf(edges[x.edge]!, x.side).verge))), grown(join(...at.map((x) => x.corridor)), r));
  });
  const verges: Area[] = [];
  edges.forEach((e, i) => {
    for (const side of [1, -1] as const) {
      const { kerb, verge, walk } = sideOf(e, side);
      if (walk <= 0) continue;
      const zone = join(corridor(e, side), ...all.flatMap((j, k) => (j.edges.includes(i) ? [corners[k]!] : [])));
      zones.push({ edge: i, zone });
      const local = within(c, grown(zone, verge + walk + kerb));
      const inner = verge > 0 ? grown(local, verge) : local;
      grownWalks.push(within(less(grown(local, verge + walk), inner), zone));
      if (verge > 0) verges.push(within(less(inner, local), zone));
    }
  });
  const built = join(...buildings.map(areaOfRing));
  // Opened by `SLIVER` (the sidewalk's end and the carriageway's, a millimetre apart, left a spike of
  // no width), then cut again: grown back round a corner it laps over the kerb by a hair.
  const sidewalks = less(grown(grown(less(less(join(...grownWalks), c), built), -SLIVER), SLIVER), join(c, built));
  const own = [
    ...edges.map((e, i) => ({ edge: i, surface: "road" as const, area: within(c, join(grown(carriagewayOf(e), SLIVER), ...all.filter((j) => j.edges.includes(i)).map((j) => nodeDisc(edges, j, 0)))) })),
    ...zones.map((z) => ({ edge: z.edge, surface: "sidewalk" as const, area: within(sidewalks, z.zone) })),
  ];
  return { c, sidewalks, nodes: all, own, rest: less(sidewalks, join(...zones.map((z) => z.zone))), verges: less(join(...verges), join(c, sidewalks, built)) };
};

/** The streets' ground: carriageways with their corners, sidewalks, zebras. */
export const streetGround = (edges: readonly StreetEdge[], crossings: readonly StreetCrossing[] = [], buildings: readonly (readonly Pt[])[] = []): StreetGround => {
  const { c, sidewalks, nodes: all } = streetAreas(edges, buildings);
  const zebras = crossings.map((x) => zebraOf(x, edges, c));
  return { carriageway: rings(c), sidewalks: rings(sidewalks), crossings: zebras.flatMap(rings), junctions: all.filter((j) => j.arms >= 3).map((j) => j.at) };
};

/** A zebra: `width` along its street's axis at the node, across all of the carriageway there. */
const zebraOf = (x: StreetCrossing, edges: readonly StreetEdge[], c: Area): Area => {
  let best: { e: StreetEdge; d: Pt; dist: number } | null = null;
  for (const e of edges)
    for (let i = 0; i + 1 < e.axis.length; i++) {
      const [a, b] = [e.axis[i]!, e.axis[i + 1]!];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 1e-9) continue;
      const t = Math.max(0, Math.min(1, ((x.at.x - a.x) * (b.x - a.x) + (x.at.z - a.z) * (b.z - a.z)) / (len * len)));
      const dist = Math.hypot(a.x + (b.x - a.x) * t - x.at.x, a.z + (b.z - a.z) * t - x.at.z);
      if (!best || dist < best.dist) best = { e, d: { x: (b.x - a.x) / len, z: (b.z - a.z) / len }, dist };
    }
  if (!best) return [];
  const across = Math.max(best.e.left, best.e.right) + best.e.kerbRadius + 1;
  const n = { x: -best.d.z, z: best.d.x };
  const half = x.width / 2;
  const rect = [
    { x: x.at.x + best.d.x * half + n.x * across, z: x.at.z + best.d.z * half + n.z * across },
    { x: x.at.x - best.d.x * half + n.x * across, z: x.at.z - best.d.z * half + n.z * across },
    { x: x.at.x - best.d.x * half - n.x * across, z: x.at.z - best.d.z * half - n.z * across },
    { x: x.at.x + best.d.x * half - n.x * across, z: x.at.z + best.d.z * half - n.z * across },
  ];
  return within(c, areaOfRing(rect));
};
