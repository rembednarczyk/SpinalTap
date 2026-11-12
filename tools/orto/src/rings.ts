/**
 * Rings on the cover grid: the samples whose middles lie inside a ring (even-odd), optionally only
 * those at least `inset` metres from its edges, and the classes counted over them.
 */
import { type Pt } from "../../osm-import/src/geometry.ts";
import { COVER_NAMES, type CoverName } from "./classify.ts";
import { type Cover, type CoverHeader } from "./cover.ts";

export type ClassCounts = Record<CoverName, number>;

export const zeroCounts = (): ClassCounts => Object.fromEntries(COVER_NAMES.map((n) => [n, 0])) as ClassCounts;

const segmentGap = (a: Pt, b: Pt, x: number, z: number): number => {
  const [dx, dz] = [b.x - a.x, b.z - a.z];
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(a.x + dx * t - x, a.z + dz * t - z);
};

/** Distance from (x, z) to the nearest edge of the ring. */
export const edgeGap = (ring: readonly Pt[], x: number, z: number): number => {
  let d = Infinity;
  for (let k = 0, m = ring.length - 1; k < ring.length; m = k++) d = Math.min(d, segmentGap(ring[m]!, ring[k]!, x, z));
  return d;
};

/** Indices (row · width + col) of the samples inside the ring, `inset` metres or more from its edges. */
export const samplesIn = (h: Pick<CoverHeader, "x0" | "z1" | "step" | "width" | "height">, ring: readonly Pt[], inset = 0): number[] => {
  const out: number[] = [];
  if (ring.length < 3) return out;
  const zs = ring.map((p) => p.z);
  const r0 = Math.max(0, Math.floor((h.z1 - Math.max(...zs)) / h.step));
  const r1 = Math.min(h.height - 1, Math.ceil((h.z1 - Math.min(...zs)) / h.step));
  for (let row = r0; row <= r1; row++) {
    const z = h.z1 - (row + 0.5) * h.step;
    const xs: number[] = [];
    for (let k = 0, m = ring.length - 1; k < ring.length; m = k++) {
      const [a, b] = [ring[m]!, ring[k]!];
      if (a.z > z !== b.z > z) xs.push(a.x + ((z - a.z) * (b.x - a.x)) / (b.z - a.z));
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const c0 = Math.max(0, Math.ceil((xs[k]! - h.x0) / h.step - 0.5));
      const c1 = Math.min(h.width - 1, Math.floor((xs[k + 1]! - h.x0) / h.step - 0.5));
      for (let col = c0; col <= c1; col++) {
        if (inset > 0 && edgeGap(ring, h.x0 + (col + 0.5) * h.step, z) < inset) continue;
        out.push(row * h.width + col);
      }
    }
  }
  return out;
};

export const countAt = (c: Cover, samples: readonly number[]): ClassCounts => {
  const out = zeroCounts();
  for (const k of samples) out[COVER_NAMES[c.cls[k]!] ?? "none"]++;
  return out;
};

export const countIn = (c: Cover, ring: readonly Pt[], inset = 0): ClassCounts => countAt(c, samplesIn(c.header, ring, inset));

/** Square metres a class. */
export const areaOf = (counts: ClassCounts, step: number): ClassCounts => Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Math.round(v * step * step * 10) / 10])) as ClassCounts;

/** The share of `of` among the classified samples (`none` left out). */
export const share = (counts: ClassCounts, of: readonly CoverName[]): number => {
  const total = COVER_NAMES.filter((n) => n !== "none").reduce((s, n) => s + counts[n], 0);
  return total ? of.reduce((s, n) => s + counts[n], 0) / total : 0;
};
