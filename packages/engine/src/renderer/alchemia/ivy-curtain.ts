import type { GroundPoint, Vec3 } from "@seki/core";
import { type GeometrySink, hexRgb } from "../city-kit-data";

/*
 * Ivy over Alchemia's slab edges (the user, 20.11: realistic ivy, the board's curtains). Each curtain
 * of the simulation (`front-green.ts`: a thin prism hanging from a hand over the slab's top) is drawn
 * as the board shows it: a dense dark mass where the ivy rolls over the edge, under it strands of
 * uneven length, each a column of single leaves hanging tip down, lighter at the young tips.
 *
 * Pattern: leaf cards along strands, as procedural foliage generators place them (the "ivy generator"
 * of Thomas Luft, 2007, and the leaf cards of SpeedTree). Ours differ: the strands hang straight with
 * a little sway (no growth simulation against the wall, the slab's edge is a straight line), and a
 * leaf is a flat diamond of four corners in the kit's paint tinted (no alpha texture: the city kit
 * has none, and the ink draws a facet's outline anyway). Fixed by a hash of the place, no randomness.
 * Pure data, no Babylon.
 */

type P2 = GroundPoint;
type Tint = readonly [number, number, number];

/** Old leaves (dark, glossy), the mass under them, and the young tips' light greens. */
const OLD: readonly Tint[] = ["#3f7f3c", "#4a8a45", "#3a7038", "#55934a", "#427a3a"].map(hexRgb);
const YOUNG: readonly Tint[] = ["#6fb050", "#7cbf55", "#63a548"].map(hexRgb);
const MASS = hexRgb("#2f6030");

/** A strand every so many metres along the edge, a leaf every so many down a strand, a leaf's half length (twice a real ivy leaf's: from the square the curtain reads as a mass of leaves, as on the board). */
export const IVY_STRAND_EVERY = 0.11;
const LEAF_EVERY = 0.07;
const LEAF = 0.11;

/** A number in [0, 1) from a point and a salt. */
const hash = (x: number, y: number, z: number, salt: number): number => {
  const h = Math.sin(x * 12.9898 + y * 39.346 + z * 78.233 + salt * 11.135) * 43758.5453;
  return h - Math.floor(h);
};

const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
};

const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

/**
 * One ivy leaf at `c`, facing about `n` (out of the curtain): a diamond hanging tip down, its plane
 * tipped up or sideways by the hash, `s` its half length.
 */
const leaf = (sink: GeometrySink, uv: readonly [number, number], c: Vec3, n: Vec3, t: Vec3, s: number, tint: Tint): void => {
  const [h1, h2, h3] = [hash(c.x, c.y, c.z, 1), hash(c.x, c.y, c.z, 2), hash(c.x, c.y, c.z, 3)];
  const face = norm({ x: n.x + t.x * (h1 - 0.5) * 0.9, y: 0.25 + h2 * 0.45, z: n.z + t.z * (h1 - 0.5) * 0.9 });
  // Its tip down and a little aside; across it, in its plane.
  const lean = (h3 - 0.5) * 0.9;
  const raw = { x: t.x * lean, y: -1, z: t.z * lean };
  const d = raw.x * face.x + raw.y * face.y + raw.z * face.z;
  const down = norm({ x: raw.x - face.x * d, y: raw.y - face.y * d, z: raw.z - face.z * d });
  const side = cross(face, down);
  const at = (u: number, v: number): Vec3 => ({ x: c.x + down.x * u + side.x * v, y: c.y + down.y * u + side.y * v, z: c.z + down.z * u + side.z * v });
  sink.quad(at(-s * 0.45, 0), at(s * 0.1, s * 0.62), at(s, 0), at(s * 0.1, -s * 0.62), face, uv, tint);
};

/** The dark mass where the ivy rolls over the edge: columns of uneven depth facing out, and its top. */
const mass = (sink: GeometrySink, uv: readonly [number, number], a: P2, t: Vec3, n: Vec3, w: number, y1: number, depth: number): void => {
  const cols = Math.max(1, Math.round(w / 0.2));
  const step = w / cols;
  const out = 0.03;
  for (let k = 0; k < cols; k++) {
    const p = { x: a.x + t.x * k * step + n.x * out, z: a.z + t.z * k * step + n.z * out };
    const q = { x: p.x + t.x * step, z: p.z + t.z * step };
    const y0 = y1 - depth * (0.55 + 0.45 * hash(p.x, y1, p.z, 5));
    sink.quad({ x: p.x, y: y0, z: p.z }, { x: q.x, y: y0, z: q.z }, { x: q.x, y: y1, z: q.z }, { x: p.x, y: y1, z: p.z }, n, uv, MASS);
  }
  // Its top, back to the slab's face: nobody looking down from the terrace sees a gap behind it.
  const b = { x: a.x + t.x * w, z: a.z + t.z * w };
  const o = (p: P2): Vec3 => ({ x: p.x + n.x * out, y: y1, z: p.z + n.z * out });
  sink.quad(o(a), o(b), { x: b.x - n.x * 0.12, y: y1, z: b.z - n.z * 0.12 }, { x: a.x - n.x * 0.12, y: y1, z: a.z - n.z * 0.12 }, { x: 0, y: 1, z: 0 }, uv, MASS);
};

/**
 * A curtain of ivy from the simulation's prism: `pts` its outline counter-clockwise, its outside first
 * (outside a, outside b, b, a: `front-green.ts`), hanging from `y1` to `y0`.
 */
export const ivyCurtain = (sink: GeometrySink, uv: readonly [number, number], pts: readonly P2[], y0: number, y1: number): void => {
  const [oa, , b, a] = [pts[0]!, pts[1]!, pts[2]!, pts[3]!];
  const w = Math.hypot(b.x - a.x, b.z - a.z);
  const thick = Math.hypot(oa.x - a.x, oa.z - a.z);
  if (w < 1e-3 || y1 - y0 < 0.05) return;
  const t = { x: (b.x - a.x) / w, y: 0, z: (b.z - a.z) / w };
  const n = thick > 1e-6 ? { x: (oa.x - a.x) / thick, y: 0, z: (oa.z - a.z) / thick } : { x: t.z, y: 0, z: -t.x };
  const drop = y1 - y0;
  mass(sink, uv, a, t, n, w, y1, Math.min(0.9, drop * 0.6));
  const strands = Math.max(2, Math.round(w / IVY_STRAND_EVERY));
  for (let i = 0; i < strands; i++) {
    const along = ((i + 0.2 + 0.6 * hash(a.x, i, a.z, 6)) / strands) * w;
    const root = { x: a.x + t.x * along, z: a.z + t.z * along };
    // Most strands hang to the curtain's bottom (every third all the way), some stop short: the board's ragged hem.
    const r = i % 3 === 1 ? 0 : hash(root.x, y1, root.z, 7);
    const bottom = y0 + drop * 0.45 * r * r;
    const out = 0.05 + 0.07 * hash(root.x, y1, root.z, 8);
    const phase = hash(root.x, y1, root.z, 9) * 6.283;
    for (let y = y1 - 0.02; y > bottom; y -= LEAF_EVERY) {
      const k = (y1 - y) / Math.max(0.1, y1 - bottom);
      const sway = Math.sin(y * 2.7 + phase) * 0.05;
      const jit = (hash(root.x, y, root.z, 10) - 0.5) * 0.1;
      const c = {
        x: root.x + t.x * (sway + jit) + n.x * (out + 0.03 * k),
        y: y + (hash(root.z, y, root.x, 11) - 0.5) * 0.03,
        z: root.z + t.z * (sway + jit) + n.z * (out + 0.03 * k),
      };
      const young = k > 0.8 && hash(c.x, c.y, c.z, 12) < 0.7;
      const pal = young ? YOUNG : OLD;
      const tint = pal[Math.floor(hash(c.x, c.y, c.z, 13) * pal.length)]!;
      leaf(sink, uv, c, n, t, LEAF * (1.05 - 0.35 * k) * (0.8 + 0.4 * hash(c.z, c.y, c.x, 14)), tint);
    }
  }
};
