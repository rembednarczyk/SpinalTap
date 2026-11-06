import { type GroundSurface, SURFACE_LIFT } from "../../../packages/core/src";
import { planGround } from "../../../packages/engine/src/renderer/mapcity/cell-ground";
import { DRAPE_GRID, type DrapeCells, SURFACE_CODE } from "../../../packages/engine/src/renderer/mapcity/ground-plan";
import type { MapEntries } from "../../../packages/engine/src/renderer/mapcity/map-entries";
import { BinIndex } from "../../../packages/engine/src/renderer/mapcity/map-index";
import { type Box2, type P2, boundsOf, triangulate } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { MeshSink } from "../../../packages/engine/src/renderer/mesh-sink";

/**
 * `paving-coplanar`: two pieces of the drawn ground overlapping in one plane (G-320). Since G-301
 * every piece is draped on one surface, so two of the same lift (a square and a cobbled street,
 * two squares) lie at exactly the same height where they overlap, and the depth buffer picks
 * either, pixel by pixel and anew with every move of the camera: large ragged triangles of one
 * paving through the other, worst on a phone's coarser depth. Read off the triangles the cell
 * builder lays for each entry (`planGround`), whatever decides which of them it draws. Only pairs
 * of one lift whose outlines overlap are laid and compared: pieces of other lifts lie a lift's
 * difference apart, and most pairs of boxes that meet are neighbours sharing an edge.
 */

type Finding = { readonly at: string; readonly what: string };
type Tri = { readonly p: readonly [P2, P2, P2]; readonly y: readonly [number, number, number]; readonly box: Box2 };

/** The surfaces drawn as a plain drape (paint, steps and fountains have their own shapes and lie over them). */
const PAVED: ReadonlySet<GroundSurface> = new Set(["road", "sidewalk", "square", "cobble", "footway", "grass", "rail", "water"]);
/** How near two triangles lie to be in one plane (m): a tenth of the 1 cm between the nearest lifts. */
const SAME_PLANE = 0.001;
/** The least area two pieces overlap by in one plane to count (m²): over float noise on shared edges. */
const MIN_AREA = 0.01;

const cross = (a: P2, b: P2, p: P2): number => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);

/** The triangles of the entry's own surface as laid (not its kerbs, deck's edges or underside). */
const pieceTris = (entries: MapEntries, id: number, surface: GroundSurface, within: DrapeCells): Tri[] => {
  const ground = new MeshSink();
  const water = new MeshSink();
  planGround(ground, water, entries, id, within);
  const sink = surface === "water" ? water : ground;
  const code = surface === "water" ? null : SURFACE_CODE[surface as keyof typeof SURFACE_CODE];
  const out: Tri[] = [];
  const pos = sink.positions;
  for (let t = 0; t + 2 < sink.indices.length; t += 3) {
    const ids = [sink.indices[t]!, sink.indices[t + 1]!, sink.indices[t + 2]!] as const;
    // Rounded: a corner `cutCovers` interpolates carries the code as 2.9999999.
    if (code !== null && ids.some((i) => Math.round(sink.uvs2[i * 2]!) !== code)) continue;
    const p = ids.map((i) => ({ x: pos[i * 3]!, z: pos[i * 3 + 2]! })) as unknown as [P2, P2, P2];
    if (Math.abs(cross(p[0], p[1], p[2])) < 1e-9) continue;
    out.push({ p, y: ids.map((i) => pos[i * 3 + 1]!) as unknown as [number, number, number], box: boundsOf(p) });
  }
  return out;
};

/** The part of the convex polygon `poly` left of the line a → b (Sutherland–Hodgman). */
const clipLeft = (poly: readonly P2[], a: P2, b: P2, sign: number): P2[] => {
  const out: P2[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    const sp = cross(a, b, p) * sign;
    const sq = cross(a, b, q) * sign;
    if (sp >= 0) out.push(p);
    if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) {
      const t = sp / (sp - sq);
      out.push({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t });
    }
  }
  return out;
};

const areaOf = (poly: readonly P2[]): number => {
  let s = 0;
  for (let i = 0; i < poly.length; i++) s += cross({ x: 0, z: 0 }, poly[i]!, poly[(i + 1) % poly.length]!);
  return Math.abs(s) / 2;
};

/** The height of a triangle's plane at (x, z). */
const yAt = (t: Tri, x: number, z: number): number => {
  const [a, b, c] = t.p;
  const d = cross(a, b, c);
  const wa = cross(b, c, { x, z }) / d;
  const wb = cross(c, a, { x, z }) / d;
  return wa * t.y[0] + wb * t.y[1] + (1 - wa - wb) * t.y[2];
};

/** The area two triangles overlap by where they lie in one plane, 0 elsewhere. */
const coplanarArea = (s: Tri, t: Tri): number => {
  const [a, b, c] = t.p;
  const sign = Math.sign(cross(a, b, c));
  const poly = clipLeft(clipLeft(clipLeft(s.p, a, b, sign), b, c, sign), c, a, sign);
  if (poly.length < 3) return 0;
  const area = areaOf(poly);
  if (area < 1e-6) return 0;
  // Planes: the gap at the overlap's corners is the most it is anywhere over it.
  return poly.every((p) => Math.abs(yAt(s, p.x, p.z) - yAt(t, p.x, p.z)) <= SAME_PLANE) ? area : 0;
};

const meets = (a: Box2, b: Box2): boolean => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;

/** A piece's triangles by the cells of the drape's grid their boxes touch. */
type Piece = { readonly tris: readonly Tri[]; readonly bins: ReadonlyMap<number, readonly Tri[]> };
const BIN = 2.5;
const keys = (b: Box2): number[] => {
  const out: number[] = [];
  for (let i = Math.floor(b.minX / BIN); i <= Math.floor(b.maxX / BIN); i++) for (let k = Math.floor(b.minZ / BIN); k <= Math.floor(b.maxZ / BIN); k++) out.push((i + 1e5) * 2e5 + k + 1e5);
  return out;
};
const pieceOf = (tris: readonly Tri[]): Piece => {
  const bins = new Map<number, Tri[]>();
  for (const t of tris) {
    for (const k of keys(t.box)) {
      const bin = bins.get(k);
      if (bin) bin.push(t);
      else bins.set(k, [t]);
    }
  }
  return { tris, bins };
};

/** The area pieces `a` and `b` overlap by in one plane, and a point of it. */
const overlapOf = (a: Piece, b: Piece): { area: number; at: P2 } => {
  let area = 0;
  let at: P2 = { x: 0, z: 0 };
  for (const s of a.tris) {
    const seen = new Set<Tri>();
    for (const k of keys(s.box)) {
      for (const t of b.bins.get(k) ?? []) {
        if (seen.has(t) || !meets(s.box, t.box)) continue;
        seen.add(t);
        const da = coplanarArea(s, t);
        if (da > 0 && area === 0) at = { x: (s.p[0].x + s.p[1].x + s.p[2].x) / 3, z: (s.p[0].z + s.p[1].z + s.p[2].z) / 3 };
        area += da;
      }
    }
  }
  return { area, at };
};

const cellKey = (i: number, k: number): number => (i + 1e5) * 2e5 + k + 1e5;

/** The area two outlines overlap by and the boxes of where, from their triangulations (the plan's data, nothing laid). */
const outlineOverlap = (a: readonly P2[], b: readonly P2[]): { area: number; boxes: Box2[] } => {
  const tris = (ring: readonly P2[]) => {
    const t = triangulate(ring);
    const out: [P2, P2, P2][] = [];
    for (let k = 0; k + 2 < t.length; k += 3) out.push([ring[t[k]!]!, ring[t[k + 1]!]!, ring[t[k + 2]!]!]);
    return out.filter((tri) => Math.abs(cross(tri[0], tri[1], tri[2])) > 1e-9).map((p) => ({ p, box: boundsOf(p) }));
  };
  const tb = tris(b);
  let area = 0;
  const boxes: Box2[] = [];
  for (const s of tris(a)) {
    for (const t of tb) {
      if (!meets(s.box, t.box)) continue;
      const [p, q, r] = t.p;
      const sign = Math.sign(cross(p, q, r));
      const poly = clipLeft(clipLeft(clipLeft(s.p, p, q, sign), q, r, sign), r, p, sign);
      if (poly.length < 3) continue;
      area += areaOf(poly);
      boxes.push(boundsOf(poly));
    }
  }
  return { area, boxes };
};

/** `paving-coplanar`: one per pair of drawn pieces overlapping in one plane by `MIN_AREA` or more. */
export const pavingCoplanar = (entries: MapEntries): Finding[] => {
  const ids = [...entries.grounds.entries()].filter(([, g]) => !g.marking && PAVED.has(g.surface)).map(([id]) => id);
  const index = new BinIndex();
  for (const id of ids) index.add(id, entries.grounds.get(id)!.bounds);
  // The pairs of one lift whose outlines overlap, and the cells of the drape's grid each piece overlaps another in.
  const pairs: [number, number][] = [];
  const cells = new Map<number, Set<number>>();
  const mark = (id: number, boxes: readonly Box2[]) => {
    let set = cells.get(id);
    if (!set) cells.set(id, (set = new Set()));
    for (const b of boxes) for (let i = Math.floor(b.minX / DRAPE_GRID); i <= Math.floor(b.maxX / DRAPE_GRID); i++) for (let k = Math.floor(b.minZ / DRAPE_GRID); k <= Math.floor(b.maxZ / DRAPE_GRID); k++) set.add(cellKey(i, k));
  };
  for (const i of ids) {
    const gi = entries.grounds.get(i)!;
    for (const j of index.within(gi.bounds)) {
      const gj = entries.grounds.get(j)!;
      if (j <= i || !meets(gi.bounds, gj.bounds) || SURFACE_LIFT[gi.surface] !== SURFACE_LIFT[gj.surface]) continue;
      const { area, boxes } = outlineOverlap(gi.ring, gj.ring);
      if (area < MIN_AREA) continue;
      pairs.push([i, j]);
      mark(i, boxes);
      mark(j, boxes);
    }
  }
  // Each laid once, in those cells only: the same triangles there as the cell builder lays.
  const pieces = new Map<number, Piece>();
  const pieceAt = (id: number): Piece => {
    let t = pieces.get(id);
    if (!t) pieces.set(id, (t = pieceOf(pieceTris(entries, id, entries.grounds.get(id)!.surface, (ci, ck) => cells.get(id)!.has(cellKey(ci, ck))))));
    return t;
  };
  const out: Finding[] = [];
  for (const [i, j] of pairs) {
    const { area, at } = overlapOf(pieceAt(i), pieceAt(j));
    if (area >= MIN_AREA) out.push({ at: `${at.x.toFixed(1)},${at.z.toFixed(1)}`, what: `${entries.grounds.get(i)!.surface} and ${entries.grounds.get(j)!.surface}: ${area.toFixed(2)} m² in one plane` });
  }
  return out;
};
