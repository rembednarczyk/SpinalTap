/**
 * A deptak's setts end square across it (`CarFreeWay.trim`, user's notes of 21.11: the deptak "evenly
 * finished"): after the ground's partition (`partitionGround`) the junction's asphalt cut the setts'
 * band along the other streets' slanting edges, and its round end lapped past them; here the setts past
 * a line square to the way's axis, at the kerb of the street it meets, become the junction's asphalt.
 * Only the pieces' surface changes, along that line: the partition stays one piece under each point
 * (a piece is split in two), the ground's outline and the deptak's width do not change.
 * Pattern: a mesh (here a polygon) cut by a half-plane, as a game's street generator ends a pedestrian
 * zone at the kerb line of the crossing street; Clipper2's intersection and difference, in millimetres.
 */
import { FillRule, type Path64, difference, intersect, isPositive } from "clipper2-ts";
import { CAR_FREE_WAYS } from "./corrections-car-free.ts";
import { type Area, type Line } from "./features.ts";
import { type Pt, ccw, pointAlong, r1 } from "./geometry.ts";
import { type GroundSurface } from "../../../packages/core/src/world/city-geo.ts";
import { type GroundOut } from "./model.ts";

const SCALE = 1000;
/** How far across and past the line the setts turn to asphalt (m): the deptak's width and its junction's, no more. */
const ACROSS = 9;
const PAST = 8;
/** Under this a piece's bit past the line does not split it (m²); a bit kept under it goes with the asphalt, so no ground is lost. */
const CRUMB = 0.05;

/** A line the setts end at: a point on the way's axis and the unit direction out of the deptak. */
export interface DeptakCut {
  readonly at: Pt;
  readonly out: Pt;
}

/** The cuts of the car-free ways' trimmed ends, from the map's lines. */
export const deptakCuts = (lines: readonly Pick<Line, "id" | "line">[]): DeptakCut[] =>
  CAR_FREE_WAYS.flatMap((w) => {
    const l = lines.find((x) => x.id === w.id);
    if (!w.trim || !l || l.line.length < 2) return [];
    const cut = (node: Pt, along: readonly Pt[], d: number): DeptakCut => {
      const at = pointAlong(along, d);
      const len = Math.hypot(node.x - at.x, node.z - at.z) || 1;
      return { at, out: { x: (node.x - at.x) / len, z: (node.z - at.z) / len } };
    };
    return [
      ...(w.trim.start !== undefined ? [cut(l.line[0]!, l.line, w.trim.start)] : []),
      ...(w.trim.end !== undefined ? [cut(l.line[l.line.length - 1]!, [...l.line].reverse(), w.trim.end)] : []),
    ];
  });

const toPath = (flat: readonly number[]): Path64 => Array.from({ length: flat.length >> 1 }, (_, i) => ({ x: Math.round(flat[2 * i]! * SCALE), y: Math.round(flat[2 * i + 1]! * SCALE) }));
const area = (p: Path64): number => p.reduce((s, a, i) => s + a.x * p[(i + 1) % p.length]!.y - p[(i + 1) % p.length]!.x * a.y, 0) / 2 / (SCALE * SCALE);
const outline = (p: Path64): number[] => ccw(p.map((q) => ({ x: q.x / SCALE, z: q.y / SCALE }))).flatMap((q) => [q.x, q.z]);

/** The box past a cut: `ACROSS` either side of the axis, `PAST` out of the deptak. */
const pastBox = (c: DeptakCut): Path64 => {
  const [nx, nz] = [-c.out.z, c.out.x];
  const pts: Pt[] = [
    { x: c.at.x + nx * ACROSS, z: c.at.z + nz * ACROSS },
    { x: c.at.x - nx * ACROSS, z: c.at.z - nz * ACROSS },
    { x: c.at.x - nx * ACROSS + c.out.x * PAST, z: c.at.z - nz * ACROSS + c.out.z * PAST },
    { x: c.at.x + nx * ACROSS + c.out.x * PAST, z: c.at.z + nz * ACROSS + c.out.z * PAST },
  ];
  return toPath(ccw(pts).flatMap((p) => [p.x, p.z]));
};

/** How far the deptak's side of a cut reaches (m): the whole map. */
const FAR = 2000;

/** The deptak's side of a cut: a box `FAR` across and back from it. */
const insideBox = (c: DeptakCut): Path64 => {
  const [nx, nz] = [-c.out.z, c.out.x];
  const pts: Pt[] = [
    { x: c.at.x + nx * FAR, z: c.at.z + nz * FAR },
    { x: c.at.x - nx * FAR, z: c.at.z - nz * FAR },
    { x: c.at.x - nx * FAR - c.out.x * FAR, z: c.at.z - nz * FAR - c.out.z * FAR },
    { x: c.at.x + nx * FAR - c.out.x * FAR, z: c.at.z + nz * FAR - c.out.z * FAR },
  ];
  return toPath(ccw(pts).flatMap((p) => [p.x, p.z]));
};

/** The car-free ways' lanes (`CarFreeWay.lanes`) on the deptak's side of every cut: the ground the setts take over. */
export const deptakLanes = (areas: readonly Pick<Area, "id" | "ring">[], cuts: readonly DeptakCut[]): Path64[] => {
  const ids = new Set(CAR_FREE_WAYS.flatMap((w) => w.lanes ?? []));
  // At the ground's 0.1 m, as its pieces are laid: the map's ring would leave a sliver of asphalt along the lane's edge.
  let lanes = areas.filter((a) => ids.has(a.id)).map((a) => toPath(ccw([...a.ring]).flatMap((p) => [r1(p.x), r1(p.z)])));
  for (const c of cuts) lanes = intersect(lanes, [insideBox(c)], FillRule.NonZero);
  return lanes.filter((p) => isPositive(p) && area(p) >= CRUMB);
};

/**
 * A piece split along a region: its part inside laid as `into`, the rest as it was. A bit of either
 * under `CRUMB` goes with the part inside, so no ground is lost; a piece with a hole is left as it is.
 */
const split = (g: GroundOut, region: readonly Path64[], into: GroundSurface): GroundOut[] => {
  const path = toPath(g.outline);
  const inside = intersect([path], [...region], FillRule.NonZero);
  if (!inside.some((p) => area(p) >= CRUMB)) return [g];
  const outside = difference([path], [...region], FillRule.NonZero);
  if ([...inside, ...outside].some((p) => !isPositive(p))) return [g];
  const { outline: _, ...rest } = g;
  return [
    ...outside.filter((p) => area(p) >= CRUMB).map((p): GroundOut => ({ ...rest, outline: outline(p) })),
    ...[...inside, ...outside.filter((p) => area(p) < CRUMB)].map((p): GroundOut => ({ ...rest, surface: into, outline: outline(p) })),
  ];
};

/** How far into the deptak a cut moves to the kerb of the street it meets (m), and the step it reads that by. */
const KERB_SEARCH = 3;
const KERB_STEP = 0.05;
/** Under this the crossing street's asphalt past the cut is the ground's rounding, not its kerb (m). */
const KERB_SLACK = 0.2;

/** Whether the ground (off the bridges) lies under `p` as `surface`. */
const onSurface = (ground: readonly GroundOut[], p: Pt, surface: GroundSurface): boolean =>
  ground.some((g) => g.surface === surface && !g.bridge && pointInFlat(g.outline, p));
const onRoad = (ground: readonly GroundOut[], p: Pt): boolean => onSurface(ground, p, "road");

const pointInFlat = (o: readonly number[], p: Pt): boolean => {
  let inside = false;
  for (let i = 0, j = o.length - 2; i < o.length; j = i, i += 2) {
    const [xi, zi, xj, zj] = [o[i]!, o[i + 1]!, o[j]!, o[j + 1]!];
    if (zi > p.z !== zj > p.z && p.x < ((xj - xi) * (p.z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};

/** How far either side of the deptak's axis its width is read for the kerb (m): the setts' 9.5 m. */
const HALF_WIDTH = 4.5;

/**
 * The cuts moved into the deptak to the kerb of the street each meets as the ground lays it, where
 * that street's asphalt reaches past the trim somewhere across the deptak (its width from BDOT10k on
 * the street graph, ADR-0104 pkt 4: Olejna's carriageway 2 m past the trim of 1.8 m): to the farthest
 * reach, so past the line it is all asphalt and the setts still end square. The trim where it does not.
 */
export const cutsAtKerb = (ground: readonly GroundOut[], cuts: readonly DeptakCut[]): DeptakCut[] =>
  cuts.map((c) => {
    const [nx, nz] = [-c.out.z, c.out.x];
    let d = 0;
    for (let o = -HALF_WIDTH; o <= HALF_WIDTH + 1e-9; o += 0.5) {
      const from = { x: c.at.x + nx * o, z: c.at.z + nz * o };
      // Across the setts only: not its parking lane, asphalt till `deptakLanes` lays it.
      if (!onSurface(ground, { x: from.x - c.out.x * KERB_SEARCH, z: from.z - c.out.z * KERB_SEARCH }, "cobble")) continue;
      let e = 0;
      while (e + KERB_STEP <= KERB_SEARCH && onRoad(ground, { x: from.x - c.out.x * (e + KERB_STEP), z: from.z - c.out.z * (e + KERB_STEP) })) e += KERB_STEP;
      d = Math.max(d, e);
    }
    return d < KERB_SLACK ? c : { at: { x: c.at.x - c.out.x * d, z: c.at.z - c.out.z * d }, out: c.out };
  });

/**
 * The ground with the setts past each cut laid as asphalt, and the deptak's lanes before the cuts
 * laid as setts (`deptakLanes`). A bridge's piece is left as it is.
 */
export const squareDeptakEnds = (ground: readonly GroundOut[], cuts: readonly DeptakCut[], lanes: readonly Path64[] = []): GroundOut[] => {
  if (cuts.length === 0 && lanes.length === 0) return [...ground];
  const boxes = cuts.map(pastBox);
  return ground.flatMap((g): GroundOut[] => {
    if (g.bridge) return [g];
    if (g.surface === "cobble" && boxes.length > 0) return split(g, boxes, "road");
    if (g.surface === "road" && lanes.length > 0) return split(g, lanes, "cobble");
    return [g];
  });
};
