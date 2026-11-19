import { ALCHEMIA_PROPS, ATRIUM, ESCALATOR_LANDINGS, MALL } from "../src";
import { type Prism, prismsAt } from "../src/world/prism";

/*
 * A floor of Alchemia's gallery as an NPC's raster sees it (`nav-raster.ts`: 0.5 m cells, a body's
 * 0.48 m clearance), measured on the simulation's own solids: which cells of the gallery's body an NPC
 * stands in from the knee to the head, and which it reaches from a cell. Shared by the shops' (ADR-0093
 * O2, P0 since O3) and the food hall's (O3) tests.
 */

export type R = { readonly x0: number; readonly x1: number; readonly z0: number; readonly z1: number };
export const within = (r: R, x: number, z: number, pad = 0): boolean => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
export const overlap = (a: R, b: R, pad = 0): boolean => a.x0 < b.x1 - pad && b.x0 < a.x1 - pad && a.z0 < b.z1 - pad && b.z0 < a.z1 - pad;

export const CELL = 0.5;
const CLEARANCE = 0.48;
export const PRISMS: readonly Prism[] = ALCHEMIA_PROPS.flatMap((p) => prismsAt(p.prisms ?? [], p.center));
/** The distance outside a prism along its farthest edge's normal (under the true distance at its corners: the stricter). */
export const outside = (q: Prism, x: number, z: number): number => Math.max(...q.normals.map((n, i) => n.x * x + n.z * z - q.offsets[i]!));

export const NZ = Math.round((MALL.z1 - MALL.z0) / CELL);
/** A cell's middle. */
export const cellCentre = (c: number): { x: number; z: number } => ({ x: MALL.x0 + (Math.floor(c / NZ) + 0.5) * CELL, z: MALL.z0 + ((c % NZ) + 0.5) * CELL });

/**
 * Which cells of a floor at `y` an NPC stands in: on the gallery's body, off the atrium (but on P0,
 * whose floor runs under it, and the escalators' landings), clear of the solids from the knee to the head.
 */
export const raster = (y: number, atriumFloor = false) => {
  const nx = Math.round((MALL.x1 - MALL.x0) / CELL);
  const nz = NZ;
  const free = new Array<boolean>(nx * nz).fill(true);
  const centre = (i: number, k: number) => ({ x: MALL.x0 + (i + 0.5) * CELL, z: MALL.z0 + (k + 0.5) * CELL });
  const landings = ESCALATOR_LANDINGS.filter((l) => Math.abs(l.y - y) < 0.01);
  if (!atriumFloor)
    for (let i = 0; i < nx; i++)
      for (let k = 0; k < nz; k++) {
        const c = centre(i, k);
        if (within(ATRIUM, c.x, c.z) && !landings.some((l) => within(l, c.x, c.z))) free[i * nz + k] = false;
      }
  for (const q of PRISMS) {
    if (q.bottom > y + 1.7 || q.top < y + 0.3) continue;
    const [i0, i1] = [Math.max(0, Math.floor((q.box.min.x - CLEARANCE - MALL.x0) / CELL)), Math.min(nx - 1, Math.floor((q.box.max.x + CLEARANCE - MALL.x0) / CELL))];
    const [k0, k1] = [Math.max(0, Math.floor((q.box.min.z - CLEARANCE - MALL.z0) / CELL)), Math.min(nz - 1, Math.floor((q.box.max.z + CLEARANCE - MALL.z0) / CELL))];
    for (let i = i0; i <= i1; i++) for (let k = k0; k <= k1; k++) if (outside(q, centre(i, k).x, centre(i, k).z) < CLEARANCE) free[i * nz + k] = false;
  }
  const cellOf = (x: number, z: number) => Math.floor((x - MALL.x0) / CELL) * nz + Math.floor((z - MALL.z0) / CELL);
  /** The cells reached from (x, z) through free cells, to their eight neighbours (a diagonal only past two free ones). */
  const reach = (x: number, z: number): Set<number> => {
    const seen = new Set<number>();
    const start = cellOf(x, z);
    if (!free[start]) return seen;
    const todo = [start];
    seen.add(start);
    while (todo.length > 0) {
      const c = todo.pop()!;
      const [i, k] = [Math.floor(c / nz), c % nz];
      for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
        const [a, b] = [i + di, k + dk];
        if (a < 0 || b < 0 || a >= nx || b >= nz) continue;
        const n = a * nz + b;
        if (seen.has(n) || !free[n]) continue;
        if (di !== 0 && dk !== 0 && (!free[a * nz + k] || !free[i * nz + b])) continue;
        seen.add(n);
        todo.push(n);
      }
    }
    return seen;
  };
  /** Is a free cell within `r` of (x, z) among `cells`? */
  const near = (cells: Set<number>, x: number, z: number, r = 0.5): boolean => {
    for (let dx = -r; dx <= r + 1e-9; dx += CELL / 2) for (let dz = -r; dz <= r + 1e-9; dz += CELL / 2) if (cells.has(cellOf(x + dx, z + dz))) return true;
    return false;
  };
  return { reach, near, free, cellOf };
};
