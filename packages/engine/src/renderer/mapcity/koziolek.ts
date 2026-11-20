import type { MeshSink, Rgba, Vec } from "../mesh-sink";
import { block, norm, paint, v3 } from "./prop-kit";
import { face, vertex } from "./sink-ops";

/**
 * The Koziołek of Lublin (the trail of the bronze goats since 2007, the goat of the town's arms):
 * a goat rearing on its hind legs, its forelegs folded, its head up with the horns swept back, a
 * beard and a short tail cocked up, in polished bronze on a granite plinth. Front +z: the goat
 * faces the passers-by (ADR-0094 stage 4 turns its back to the wall). Inside the monument's solid
 * for the Koziołek (sim `furniture.ts`: 0.9 x 0.6 m, 1.2 m tall).
 *
 * Pattern: generalized cylinders (Binford's sweep of a cross-section along an axis, as SpeedTree
 * lofts branches): the trunk, neck and head are one sweep of ellipses along a smooth spine, the
 * legs, horns, ears, beard and tail sweeps of circles along their bones, all with smooth normals,
 * so the ink draws the goat's outline and not its facets (comic realism, `docs/zasady-lokacji.md` §9).
 */

/** A point of a sweep: where it is, how wide (x) and how deep (across the spine in its plane). */
export interface SweepPoint {
  readonly p: Vec;
  readonly rx: number;
  readonly ry: number;
}

const sub = (a: Vec, b: Vec): Vec => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const cross = (a: Vec, b: Vec): Vec => v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
const lerp = (a: Vec, b: Vec, t: number): Vec => v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);

/** The points of a Catmull-Rom curve through `pts`, `steps` per span, the radii eased along. */
export const smoothSpine = (pts: readonly SweepPoint[], steps: number): SweepPoint[] => {
  const out: SweepPoint[] = [];
  for (let i = 0; i + 1 < pts.length; i++) {
    const p0 = pts[Math.max(0, i - 1)]!.p;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[Math.min(pts.length - 1, i + 2)]!.p;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const c = (a: number, b: number, d: number, e: number) => 0.5 * (2 * b + (-a + d) * t + (2 * a - 5 * b + 4 * d - e) * t2 + (-a + 3 * b - 3 * d + e) * t3);
      const ease = t * t * (3 - 2 * t);
      out.push({ p: v3(c(p0.x, p1.p.x, p2.p.x, p3.x), c(p0.y, p1.p.y, p2.p.y, p3.y), c(p0.z, p1.p.z, p2.p.z, p3.z)), rx: p1.rx + (p2.rx - p1.rx) * ease, ry: p1.ry + (p2.ry - p1.ry) * ease });
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
};

/**
 * A sweep of ellipses along the points, `sides` round, closed at both ends; the ellipse's width
 * across `side` (a fixed direction square to the spine's plane, x for the goat's midline).
 */
export const sweep = (sink: MeshSink, pts: readonly SweepPoint[], color: Rgba, sides: number, side: Vec = v3(1, 0, 0)): void => {
  const rings: number[][] = [];
  const centres: Vec[] = [];
  pts.forEach((q, i) => {
    const t = norm(sub(pts[Math.min(pts.length - 1, i + 1)]!.p, pts[Math.max(0, i - 1)]!.p));
    // The side kept square to the tangent (a bone along x takes y as its side).
    const s0 = Math.abs(t.x * side.x + t.y * side.y + t.z * side.z) > 0.95 ? v3(0, 1, 0) : side;
    const n = norm(cross(t, s0));
    const s = cross(n, t);
    const ring: number[] = [];
    for (let k = 0; k < sides; k++) {
      const a = (k / sides) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const off = v3(s.x * ca * q.rx + n.x * sa * q.ry, s.y * ca * q.rx + n.y * sa * q.ry, s.z * ca * q.rx + n.z * sa * q.ry);
      // The ellipse's normal: its gradient, not the offset.
      const nn = norm(v3(s.x * ca * q.ry + n.x * sa * q.rx, s.y * ca * q.ry + n.y * sa * q.rx, s.z * ca * q.ry + n.z * sa * q.rx));
      ring.push(vertex(sink, v3(q.p.x + off.x, q.p.y + off.y, q.p.z + off.z), nn, color));
    }
    rings.push(ring);
    centres.push(q.p);
  });
  for (let i = 0; i + 1 < rings.length; i++) {
    const a = rings[i]!;
    const b = rings[i + 1]!;
    const mid = lerp(centres[i]!, centres[i + 1]!, 0.5);
    for (let k = 0; k < sides; k++) {
      const j = (k + 1) % sides;
      const p = sink.positions;
      const out = norm(sub(v3(p[a[k]! * 3]!, p[a[k]! * 3 + 1]!, p[a[k]! * 3 + 2]!), mid));
      face(sink, a[k]!, a[j]!, b[j]!, out);
      face(sink, a[k]!, b[j]!, b[k]!, out);
    }
  }
  // The ends: a fan to the end's centre, facing out along the spine.
  for (const [ring, c, from] of [
    [rings[0]!, centres[0]!, centres[1]!],
    [rings[rings.length - 1]!, centres[centres.length - 1]!, centres[centres.length - 2]!],
  ] as const) {
    const out = norm(sub(c, from));
    const tip = vertex(sink, c, out, color);
    for (let k = 0; k < sides; k++) face(sink, ring[k]!, ring[(k + 1) % sides]!, tip, out);
  }
};

/** A limb along its bones, its radius from `r0` at the first to `r1` at the last, smooth. */
const limb = (sink: MeshSink, bones: readonly Vec[], r0: number, r1: number, color: Rgba, sides = 8): void => {
  const pts = bones.map((p, i) => ({ p, rx: r0 + ((r1 - r0) * i) / (bones.length - 1), ry: r0 + ((r1 - r0) * i) / (bones.length - 1) }));
  sweep(sink, smoothSpine(pts, 3), color, sides);
};

/** Polished bronze, a little warm: the goats' noses and horns rubbed bright by hands. */
const BRONZE = paint("#7c6a3e");
const RUBBED = paint("#b89a55");
const GRANITE = paint("#8e8d88");

/** The plinth's top (m): the goat's hooves stand on it. */
export const KOZIOLEK_PLINTH = 0.4;

/** The goat's trunk, neck and head as one sweep: from the rump up the back to the muzzle. */
const TRUNK: readonly SweepPoint[] = [
  { p: v3(0, 0.56, -0.15), rx: 0.03, ry: 0.03 },
  { p: v3(0, 0.6, -0.12), rx: 0.085, ry: 0.09 },
  { p: v3(0, 0.7, -0.07), rx: 0.105, ry: 0.115 },
  { p: v3(0, 0.81, -0.02), rx: 0.1, ry: 0.11 },
  { p: v3(0, 0.89, 0.03), rx: 0.085, ry: 0.095 },
  { p: v3(0, 0.96, 0.06), rx: 0.055, ry: 0.06 },
  { p: v3(0, 1.03, 0.08), rx: 0.05, ry: 0.055 },
  { p: v3(0, 1.08, 0.11), rx: 0.052, ry: 0.06 },
  { p: v3(0, 1.08, 0.17), rx: 0.04, ry: 0.045 },
  { p: v3(0, 1.06, 0.22), rx: 0.028, ry: 0.03 },
  { p: v3(0, 1.055, 0.235), rx: 0.012, ry: 0.012 },
];

/** Adds the goat on its plinth to the sink. */
export const koziolek = (sink: MeshSink): void => {
  block(sink, 0, -0.2, 0, 0.9, 0.6, 0.6, GRANITE);
  sweep(sink, smoothSpine(TRUNK, 4), BRONZE, 14);
  const y = KOZIOLEK_PLINTH;
  for (const sx of [-1, 1]) {
    // Hind legs: hip, stifle forward, hock back, the hoof on the plinth.
    limb(sink, [v3(sx * 0.06, 0.62, -0.1), v3(sx * 0.07, 0.52, -0.03), v3(sx * 0.065, y + 0.06, -0.12), v3(sx * 0.06, y + 0.012, -0.07)], 0.045, 0.018, BRONZE);
    // Forelegs folded at the chest: shoulder, elbow forward, the knee bent and the cannon hanging.
    limb(sink, [v3(sx * 0.065, 0.86, 0.02), v3(sx * 0.07, 0.8, 0.12), v3(sx * 0.065, 0.86, 0.2), v3(sx * 0.06, 0.79, 0.23)], 0.032, 0.015, BRONZE);
    // Horns: up off the poll and swept back in a curve, tapering, rubbed bright.
    limb(sink, [v3(sx * 0.025, 1.12, 0.09), v3(sx * 0.035, 1.165, 0.06), v3(sx * 0.055, 1.185, 0.0), v3(sx * 0.07, 1.165, -0.055), v3(sx * 0.075, 1.12, -0.07)], 0.016, 0.004, RUBBED, 6);
    // Ears out to the side under the horns.
    limb(sink, [v3(sx * 0.04, 1.1, 0.085), v3(sx * 0.075, 1.09, 0.075), v3(sx * 0.1, 1.075, 0.07)], 0.014, 0.005, BRONZE, 6);
  }
  // The beard under the chin, the tail cocked up over the rump, the muzzle rubbed bright.
  limb(sink, [v3(0, 1.03, 0.19), v3(0, 1.0, 0.195), v3(0, 0.97, 0.185)], 0.014, 0.004, BRONZE, 6);
  limb(sink, [v3(0, 0.6, -0.16), v3(0, 0.64, -0.2), v3(0, 0.69, -0.21)], 0.018, 0.006, BRONZE, 6);
  limb(sink, [v3(0, 1.055, 0.215), v3(0, 1.052, 0.238)], 0.02, 0.008, RUBBED, 8);
};
