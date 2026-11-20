import { TREE_CROWN, TREE_TOP } from "@seki/core";
import type { MeshSink, Rgba, Vec } from "../mesh-sink";
import { norm, paint, tube, v3 } from "./prop-kit";

/*
 * A street tree in comic realism (the user's decision of 20.11, `docs/zasady-lokacji.md` §9): a
 * tapering trunk, scaffold limbs, branches off them and a crown of leaf clusters, each cluster a
 * few dozen leaf cards, instead of a few smooth blobs. The old blob crown stays as the far tree.
 *
 * Patterns: recursive branching as in L-system and procedural tree generators (Weber and Penn,
 * "Creation and Rendering of Realistic Trees", 1995: trunk, limbs and branches of given counts and
 * angles, leaves on the tips), and leaf cards with normals taken from the crown's envelope
 * ("normal transfer" of stylised foliage), so the light and the ink read the crown and its clumps,
 * not every leaf. Ours differs: no growth simulation, the envelope is the species' crown
 * ellipsoids (the importer sizes and clears trees by them, G-422), and the cards are flat diamonds
 * in the kit's paint, no alpha texture. Fixed by a hash, the same shape always the same geometry.
 */

/** A crown ellipsoid: centre, radii and colour. */
export type Crown = readonly [x: number, y: number, z: number, rx: number, ry: number, rz: number, colour: string];

/** A species' build: trunk height and radius, how many scaffold limbs and how steep they rise (degrees). */
export interface TreeForm {
  readonly h: number;
  readonly r: number;
  readonly limbs: number;
  readonly rise: readonly [number, number];
}

const BARK = paint("#4a3a2f");
/** Half the length of a leaf card: some three times a real lime leaf, so the crown reads as a summer mass at the game's distances (§9). */
const LEAF = 0.22;
/** Leaves a cluster tries to place, and a cluster's radius. */
const PER_CLUSTER = 34;
const CLUSTER = 0.75;

const hash = (a: number, b: number, c: number, salt: number): number => {
  const h = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719 + salt * 11.135) * 43758.5453;
  return h - Math.floor(h);
};

const add = (a: Vec, b: Vec, k = 1): Vec => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
const cross = (a: Vec, b: Vec): Vec => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const shade = (c: Rgba, k: number): Rgba => [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k), c[3]];

/** How deep inside a crown ellipsoid a point is: below 1 inside. */
const inside = (p: Vec, c: Crown): number => Math.hypot((p.x - c[0]) / c[3], (p.y - c[1]) / c[4], (p.z - c[2]) / c[5]);

/** The crown the point is deepest in, and how deep. */
const deepest = (p: Vec, crowns: readonly Crown[]): { readonly crown: Crown; readonly depth: number } =>
  crowns.reduce((best, c) => (inside(p, c) < best.depth ? { crown: c, depth: inside(p, c) } : best), { crown: crowns[0]!, depth: Infinity });

/** Distance along `dir` from `from` to the main crown's envelope (the first ellipsoid). */
const toEnvelope = (from: Vec, dir: Vec, c: Crown): number => {
  const o = { x: (from.x - c[0]) / c[3], y: (from.y - c[1]) / c[4], z: (from.z - c[2]) / c[5] };
  const d = { x: dir.x / c[3], y: dir.y / c[4], z: dir.z / c[5] };
  const a = d.x * d.x + d.y * d.y + d.z * d.z;
  const b = 2 * (o.x * d.x + o.y * d.y + o.z * d.z);
  const k = o.x * o.x + o.y * o.y + o.z * o.z - 1;
  const disc = b * b - 4 * a * k;
  return disc <= 0 ? 1 : Math.max(0.5, (-b + Math.sqrt(disc)) / (2 * a));
};

/** A branch from `a` along `dir` of `len`, bending up a little, radius `r0` to `r1`; returns its tip. */
const branch = (sink: MeshSink, a: Vec, dir: Vec, len: number, r0: number, r1: number, sides: number): Vec => {
  const mid = add(add(a, dir, len * 0.5), v3(0, len * 0.06, 0));
  const tip = add(add(a, dir, len), v3(0, len * 0.1, 0));
  tube(sink, a, mid, r0, BARK, sides, (r0 + r1) / 2);
  tube(sink, mid, tip, (r0 + r1) / 2, BARK, sides, r1);
  return tip;
};

/** The trunk, the scaffold limbs and two branches off each at two points: the tips the leaves gather on. */
const skeleton = (sink: MeshSink, form: TreeForm, crowns: readonly Crown[], shape: number): Vec[] => {
  const lean = v3((hash(shape, 1, 0, 1) - 0.5) * 0.3, 0, (hash(shape, 2, 0, 1) - 0.5) * 0.3);
  const top = v3(lean.x, form.h, lean.z);
  tube(sink, v3(0, -0.3, 0), v3(lean.x * 0.5, form.h * 0.55, lean.z * 0.5), form.r, BARK, 8, form.r * 0.9);
  tube(sink, v3(lean.x * 0.5, form.h * 0.55, lean.z * 0.5), top, form.r * 0.9, BARK, 8, form.r * 0.72);
  const tips: Vec[] = [];
  for (let i = 0; i < form.limbs; i++) {
    const turn = i * 2.39996 + hash(shape, i, 3, 2) * 0.6;
    const rise = ((form.rise[0] + (form.rise[1] - form.rise[0]) * hash(shape, i, 4, 3)) * Math.PI) / 180;
    const dir = norm(v3(Math.cos(turn) * Math.cos(rise), Math.sin(rise), Math.sin(turn) * Math.cos(rise)));
    const from = v3(top.x, form.h - 0.7 + 0.8 * hash(shape, i, 5, 4), top.z);
    const len = toEnvelope(from, dir, crowns[0]!) * 0.72;
    const tip = branch(sink, from, dir, len, form.r * 0.5, form.r * 0.16, 6);
    tips.push(tip);
    for (const at of [0.5, 0.8]) {
      const base = add(from, dir, len * at);
      for (const side of [-1, 1]) {
        const swing = side * (0.55 + 0.35 * hash(shape, i, at * 10, side + 6));
        const d = norm(v3(Math.cos(turn + swing), Math.sin(rise) + 0.25, Math.sin(turn + swing)));
        tips.push(branch(sink, base, d, len * (0.55 - 0.25 * at), form.r * 0.14, 0.025, 4));
      }
    }
  }
  return tips;
};

/**
 * Points spread through the crown ellipsoids (a Fibonacci sphere per ellipsoid), to fill it between
 * the tips: most in the outer shell, where a summer crown has its leaves, some deep inside, so it
 * does not read hollow from under it.
 */
const fill = (crowns: readonly Crown[]): Vec[] =>
  crowns.flatMap((c, ci) => {
    const n = Math.max(8, Math.round(c[3] * c[4] * c[5] * 2.2));
    return Array.from({ length: n }, (_, k) => {
      const y = 1 - (2 * (k + 0.5)) / n;
      const r = Math.sqrt(1 - y * y);
      const t = k * 2.39996 + ci;
      const shell = k % 4 === 0 ? 0.2 + 0.3 * hash(ci, k, 7, 8) : 0.55 + 0.35 * hash(ci, k, 7, 8);
      return v3(c[0] + Math.cos(t) * r * c[3] * shell, c[1] + y * c[4] * shell, c[2] + Math.sin(t) * r * c[5] * shell);
    });
  });

/** One leaf card at `p`, facing about `out` (the crown's envelope there), tip along the tangent the hash turns. */
const leaf = (sink: MeshSink, p: Vec, out: Vec, size: number, colour: Rgba): void => {
  const face = norm(add(out, v3(hash(p.x, p.y, p.z, 9) - 0.5, hash(p.x, p.y, p.z, 10) - 0.3, hash(p.x, p.y, p.z, 11) - 0.5), 0.9));
  const ref = Math.abs(face.y) > 0.9 ? v3(1, 0, 0) : v3(0, 1, 0);
  const u0 = norm(cross(face, ref));
  const w0 = cross(face, u0);
  const a = hash(p.z, p.x, p.y, 12) * Math.PI * 2;
  const u = add(v3(u0.x * Math.cos(a), u0.y * Math.cos(a), u0.z * Math.cos(a)), w0, Math.sin(a));
  const w = cross(face, u);
  const at = (s: number, t: number): Vec => add(add(p, u, s * size), w, t * size);
  sink.quad([at(-0.6, 0), at(0.15, 0.55), at(1, 0), at(0.15, -0.55)], out, colour);
};

/** How many leaves a cluster tries and how big they are: the full tree's, and the phones' (quality `low`, ADR-0079) with fewer and bigger leaves. */
export interface LeafDensity {
  readonly perCluster: number;
  readonly leaf: number;
}
export const FULL_LEAVES: LeafDensity = { perCluster: PER_CLUSTER, leaf: LEAF };
export const PHONE_LEAVES: LeafDensity = { perCluster: 13, leaf: LEAF * 1.6 };

/** The leaves: a cluster on every tip and on every fill point, each leaf kept inside the crown. */
const foliage = (sink: MeshSink, crowns: readonly Crown[], centres: readonly Vec[], density: LeafDensity): void => {
  const base = crowns.map((c) => paint(c[6]));
  centres.forEach((c, ci) => {
    for (let k = 0; k < density.perCluster; k++) {
      const d = norm(v3(hash(ci, k, 1, 13) - 0.5, hash(ci, k, 2, 14) - 0.5, hash(ci, k, 3, 15) - 0.5));
      const p = add(c, d, CLUSTER * Math.cbrt(hash(ci, k, 4, 16)));
      const { crown, depth } = deepest(p, crowns);
      if (depth > 0.97) continue;
      const out = norm(v3((p.x - crown[0]) / crown[3], (p.y - crown[1]) / crown[4] + 0.15, (p.z - crown[2]) / crown[5]));
      // Old leaves inside the crown darker, the sunlit top lighter.
      const light = (0.72 + 0.3 * depth) * (out.y > 0.5 ? 1.12 : 1);
      leaf(sink, p, out, density.leaf * (0.8 + 0.45 * hash(ci, k, 5, 17)), shade(base[crowns.indexOf(crown)]!, light));
    }
  });
};

/** Fits the crown (everything from `start` on) to the species' top and reach (G-422): the importer sizes and clears by them. */
const fit = (sink: MeshSink, start: number, shape: number, h: number): void => {
  const p = sink.positions;
  let top = -Infinity;
  let reach = 0;
  for (let i = start * 3; i < p.length; i += 3) {
    top = Math.max(top, p[i + 1]!);
    reach = Math.max(reach, Math.hypot(p[i]!, p[i + 2]!));
  }
  const sy = ((TREE_TOP[shape] ?? TREE_TOP[0]!) - h) / (top - h);
  const sr = ((TREE_CROWN[shape] ?? TREE_CROWN[0]!) - 0.1) / reach;
  for (let i = start * 3; i < p.length; i += 3) {
    p[i] = p[i]! * sr;
    p[i + 1] = h + (p[i + 1]! - h) * sy;
    p[i + 2] = p[i + 2]! * sr;
  }
};

/** A whole tree of `shape` into `sink`: trunk, limbs, branches and leaves, fitted to the species' size. */
export const leafyTree = (sink: MeshSink, form: TreeForm, crowns: readonly Crown[], shape: number, density: LeafDensity = FULL_LEAVES): void => {
  const start = sink.vertexCount;
  const tips = skeleton(sink, form, crowns, shape);
  foliage(sink, crowns, [...tips, ...fill(crowns)], density);
  fit(sink, start, shape, form.h);
};
