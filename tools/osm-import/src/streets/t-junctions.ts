import { type Pt } from "../geometry.ts";

/**
 * T-junction removal (the mesh repair of a BSP compiler, qbsp's `tjunc.c`): a vertex of one ring
 * that lies on an edge of another, within `eps`, is put into that edge too. Two pieces cut by
 * different operations along one line (a street's mapped sidewalks and the gaps closed beside them)
 * kept it as edges with different ends; rounded to 0.1 m each on its own, the two lines came apart
 * by up to 0.05 m, a seam of bare ground (Lubartowska's west sidewalk, the curator's review of E3,
 * P1). With the same vertices on both sides the shared edge rounds the same. The shapes stay as
 * they were: only points on their edges are added.
 */
export const weldTJunctions = (rings: readonly (readonly Pt[])[], eps = 0.005): Pt[][] => {
  const CELL = 1;
  const cell = (x: number, z: number) => `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
  const grid = new Map<string, { p: Pt; ring: number }[]>();
  rings.forEach((r, i) =>
    r.forEach((p) => {
      const k = cell(p.x, p.z);
      const list = grid.get(k) ?? [];
      list.push({ p, ring: i });
      grid.set(k, list);
    }),
  );
  return rings.map((r, i) => {
    const out: Pt[] = [];
    for (let k = 0; k < r.length; k++) {
      const [a, b] = [r[k]!, r[(k + 1) % r.length]!];
      out.push(a);
      const [dx, dz] = [b.x - a.x, b.z - a.z];
      const len = Math.hypot(dx, dz);
      if (len < 2 * eps) continue;
      const on: { t: number; p: Pt }[] = [];
      const [x0, x1] = [Math.floor((Math.min(a.x, b.x) - eps) / CELL), Math.floor((Math.max(a.x, b.x) + eps) / CELL)];
      const [z0, z1] = [Math.floor((Math.min(a.z, b.z) - eps) / CELL), Math.floor((Math.max(a.z, b.z) + eps) / CELL)];
      for (let cx = x0; cx <= x1; cx++)
        for (let cz = z0; cz <= z1; cz++)
          for (const v of grid.get(`${cx},${cz}`) ?? []) {
            if (v.ring === i) continue;
            const t = ((v.p.x - a.x) * dx + (v.p.z - a.z) * dz) / (len * len);
            if (t * len <= eps || (1 - t) * len <= eps) continue;
            const off = Math.abs((v.p.x - a.x) * dz - (v.p.z - a.z) * dx) / len;
            if (off <= eps && !on.some((o) => Math.hypot(o.p.x - v.p.x, o.p.z - v.p.z) <= eps)) on.push({ t, p: v.p });
          }
      for (const o of on.sort((m, n) => m.t - n.t)) out.push(o.p);
    }
    return out;
  });
};
