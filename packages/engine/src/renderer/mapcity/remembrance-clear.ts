import { MEMORIAL_CLEAR, type RemembrancePlace, remembranceOff } from "@seki/sim";
import type { Wall } from "./facade-frame";
import type { P2 } from "./polygon";

/**
 * The map's signs keep off the places of remembrance (ADR-0074 §6, G-943): no board, blade,
 * venue board, tube, hologram, billboard, banner or curtain of neon comes nearer than
 * `MEMORIAL_CLEAR` across the plan to the memorial stone of Plac Ofiar Getta or a stumbling stone.
 * An exclusion zone as the placement masks of procedural dressing have it: a sign that would
 * reach into it is not drawn, and the others keep their places and their draws, so none of them
 * moves into its room. Every sign's footprint on the plan is a segment (its quads stand upright),
 * and the distance to a box along a segment is convex, so its least is found by halving.
 */

const point = (a: P2, b: P2, t: number): P2 => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });

/** Where a convex `f` is least over [lo, hi], to a hair. */
const lowest = (f: (t: number) => number, lo: number, hi: number): number => {
  for (let i = 0; i < 48; i++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    if (f(m1) <= f(m2)) hi = m2;
    else lo = m1;
  }
  return (lo + hi) / 2;
};

/** Does the segment from `a` to `b` (a point when `b` is left out) come nearer than `MEMORIAL_CLEAR` to one of the places? */
export const hushed = (places: readonly RemembrancePlace[] | undefined, a: P2, b: P2 = a): boolean =>
  !!places?.some((r) => {
    const off = (t: number) => remembranceOff(point(a, b, t), r);
    return off(lowest(off, 0, 1)) < MEMORIAL_CLEAR;
  });

/** A point `u` metres along the wall, `out` metres off it. */
const onWall = (w: Wall, u: number, out: number): P2 => ({ x: w.a.x + ((w.b.x - w.a.x) / w.length) * u + w.nx * out, z: w.a.z + ((w.b.z - w.a.z) / w.length) * u + w.nz * out });

/** Does a sign `u0`..`u1` along the wall, `out0`..`out1` off it, reach into a place's zone? Its box's edges come nearest. */
export const hushedOnWall = (places: readonly RemembrancePlace[] | undefined, w: Wall, u0: number, u1: number, out0: number, out1 = out0): boolean => {
  if (!places?.length) return false;
  const [a, b, c, d] = [onWall(w, u0, out0), onWall(w, u1, out0), onWall(w, u1, out1), onWall(w, u0, out1)];
  return hushed(places, a, b) || hushed(places, b, c) || hushed(places, c, d) || hushed(places, d, a);
};

/** The `t` in [lo, hi] where `f` crosses `MEMORIAL_CLEAR`, on the side of `outside` (where f is at least that). */
const edge = (f: (t: number) => number, outside: number, inside: number): number => {
  for (let i = 0; i < 40; i++) {
    const m = (outside + inside) / 2;
    if (f(m) >= MEMORIAL_CLEAR) outside = m;
    else inside = m;
  }
  return outside;
};

/**
 * The stretches `[from, to]` along the wall `out` metres off it left of the given ones once the
 * places' zones are cut out of them (a long sign along the wall, the cornice's tube, G-943).
 */
export const quietStretches = (places: readonly RemembrancePlace[] | undefined, w: Wall, out: number, stretches: readonly (readonly [number, number])[]): [number, number][] => {
  let left = stretches.map(([a, b]) => [a, b] as [number, number]);
  for (const r of places ?? []) {
    const f = (u: number) => remembranceOff(onWall(w, u, out), r);
    const m = lowest(f, 0, w.length);
    if (f(m) >= MEMORIAL_CLEAR) continue;
    const lo = f(0) < MEMORIAL_CLEAR ? -Infinity : edge(f, 0, m);
    const hi = f(w.length) < MEMORIAL_CLEAR ? Infinity : edge(f, w.length, m);
    left = left.flatMap(([a, b]): [number, number][] => [...(a < lo ? [[a, Math.min(b, lo)] as [number, number]] : []), ...(b > hi ? [[Math.max(a, hi), b] as [number, number]] : [])]);
  }
  return left;
};
