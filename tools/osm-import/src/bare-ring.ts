/** A check of the bare ground rule's pieces (`bare-cover.ts`), kept apart so that file stays within ADR-0031's 500 lines. */
import { type Pt } from "./geometry.ts";

/** Whether two non-adjacent edges of the ring properly cross (`selfIntersects`), the edges swept along x. */
export const crossesItself = (ring: readonly Pt[]): boolean => {
  const n = ring.length;
  const lo = (i: number) => Math.min(ring[i]!.x, ring[(i + 1) % n]!.x);
  const hi = (i: number) => Math.max(ring[i]!.x, ring[(i + 1) % n]!.x);
  const order = Array.from({ length: n }, (_, i) => i).sort((p, q) => lo(p) - lo(q));
  const side = (a: Pt, b: Pt, c: Pt) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  for (let s = 0; s < n; s++) {
    const i = order[s]!;
    for (let t = s + 1; t < n && lo(order[t]!) <= hi(i); t++) {
      const j = order[t]!;
      const u = Math.min(i, j);
      const v = Math.max(i, j);
      if (v - u < 2 || (u === 0 && v === n - 1)) continue;
      const a = ring[u]!;
      const b = ring[(u + 1) % n]!;
      const c = ring[v]!;
      const d = ring[(v + 1) % n]!;
      const d1 = side(c, d, a);
      const d2 = side(c, d, b);
      const d3 = side(a, b, c);
      const d4 = side(a, b, d);
      if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
    }
  }
  return false;
};
