import type { FacadeFrame, Wall } from "./facade-frame";

/**
 * Room for a sign in front of a wall (G-157, G-159). A wall counts as a street wall unless all
 * three of its samples meet a neighbour, so a neighbour that stands out in front of the wall's
 * plane at one end leaves the wall a street wall all along, and a sign hung there reaches into
 * the neighbour's solid. Signs check the box they take in front of the wall instead.
 */

/** Step of the samples along the wall and out from it, metres. */
const STEP = 0.1;

/** Whether another building stands at `u` along the wall, `out` metres off it, higher than `y`. */
const blocked = (f: FacadeFrame, w: Wall, u: number, out: number, y: number): boolean => {
  const x = w.a.x + ((w.b.x - w.a.x) / w.length) * u + w.nx * out;
  const z = w.a.z + ((w.b.z - w.a.z) / w.length) * u + w.nz * out;
  const top = f.neighbour(x, z, f.b.id);
  return top !== null && top > y;
};

const steps = (lo: number, hi: number): number[] => {
  const n = Math.max(1, Math.ceil((hi - lo) / STEP));
  return Array.from({ length: n + 1 }, (_, k) => lo + ((hi - lo) * k) / n);
};

/** Whether the box in front of the wall, `u0`..`u1` along it, `out0`..`out1` off it and from `y` up, is clear of other buildings. */
export const signClear = (f: FacadeFrame, w: Wall, u0: number, u1: number, out0: number, out1: number, y: number): boolean => {
  const outs = out1 > out0 ? steps(out0, out1) : [out0];
  return steps(u0, u1).every((u) => outs.every((o) => !blocked(f, w, u, o, y)));
};

/** The clear stretches `[from, to]` along the wall for a flat sign `out0`..`out1` off it, from `y` up, in order. */
export const clearStretches = (f: FacadeFrame, w: Wall, out0: number, out1: number, y: number): [number, number][] => {
  const out: [number, number][] = [];
  let run: [number, number] | null = null;
  for (const u of steps(0, w.length)) {
    if (signClear(f, w, u, u, out0, out1, y)) {
      if (run) run[1] = u;
      else out.push((run = [u, u]));
    } else run = null;
  }
  return out;
};

/** The stretches of a wall `length` long between its `clear` ones (from `clearStretches`), where a sign keeps off. */
export const blockedStretches = (clear: readonly (readonly [number, number])[], length: number): [number, number][] => {
  const edges = [0, ...clear.flat(), length];
  const out: [number, number][] = [];
  for (let k = 0; k + 1 < edges.length; k += 2) if ((edges[k + 1] as number) > (edges[k] as number) + 1e-6) out.push([edges[k] as number, edges[k + 1] as number]);
  return out;
};

/**
 * A flat sign `width` wide wanted centred at `want` along the wall: the clear stretch that takes
 * it widest (no narrower than `min`), the sign moved into it as near `want` as it fits and cut to
 * it; null when no stretch has room.
 */
export const fitFlatSign = (f: FacadeFrame, w: Wall, want: number, width: number, min: number, out: number, y: number): { u: number; width: number } | null => {
  let best: { u: number; width: number } | null = null;
  for (const [a, b] of clearStretches(f, w, out, out, y)) {
    const fit = Math.min(width, b - a);
    if (fit < min) continue;
    const u = Math.max(a + fit / 2, Math.min(b - fit / 2, want));
    if (!best || fit > best.width + 1e-6 || (Math.abs(fit - best.width) <= 1e-6 && Math.abs(u - want) < Math.abs(best.u - want))) best = { u, width: fit };
  }
  return best;
};

/**
 * Where along the wall a sign sticking out of it (`out0`..`out1` off it, from `y` up) can go:
 * the first clear of `from`, then sliding in from there towards the wall's middle, then the same
 * from the other end (`to`); null when there is no room.
 */
export const clearSpotFrom = (f: FacadeFrame, w: Wall, from: number, to: number, out0: number, out1: number, y: number): number | null => {
  const mid = w.length / 2;
  for (const end of [from, to]) {
    const dir = end < mid ? 1 : -1;
    for (let u = end; dir * (mid - u) >= 0; u += dir * 0.5) if (signClear(f, w, u - 0.05, u + 0.05, out0, out1, y)) return u;
  }
  return null;
};
