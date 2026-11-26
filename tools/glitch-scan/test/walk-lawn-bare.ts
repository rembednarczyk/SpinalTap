import { COVER } from "../../orto/src/classify.ts";
import { type Cover, coverAt, coverFor } from "../../orto/src/cover.ts";
import { BARE_GRID, Grid, HAIRLINE, flatRing } from "./landuse-bare";

/**
 * `walk-lawn-bare` (G-902): a 0.5 m sample of the cover's grid on bare terrain the orthophoto shows
 * as light paving, in a strip at most `BAND` across between a pavement or a footway and a lawn of
 * the game: the steps from the nearest of each, through bare cells (8 round a cell, as the import's
 * `kerbStrips` walks them), add up to the strip's width and one. Podzamcze (1066-1070, 479.5-488):
 * the paving between the sidewalk w793299545 and the lawn w804709930 lay 5 m and more off the
 * asphalt, past the kerbs' strips the bare ground rule lays however narrow, so a region too narrow
 * for the rule's loose regions stayed bare. Read off the tables and the cover alone: a strip laid
 * anew by any rule shows. Between two pavements, or by a pavement with no lawn past it, nothing.
 */

type Finding = { readonly at: string; readonly what: string };
type Bounds = { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };

/** A chunk as the tables keep it: its ground, flat outlines, and its buildings round their origins. */
export interface WalkLawnChunk {
  readonly id: string;
  readonly bounds: Bounds;
  readonly ground: readonly { readonly surface: string; readonly outline: readonly number[]; readonly bridge?: true; readonly cover?: true }[];
  readonly buildings: readonly { readonly x: number; readonly z: number; readonly outline: readonly number[] }[];
}

/** The widest strip between a pavement and a lawn counted (m): as wide as the kerbs' strips the bare ground rule lays (`FILL.kerbStrip`). */
export const BAND = 5;

/** The pieces a strip begins at: the pavements and the footways. */
const WALKS: ReadonlySet<string> = new Set(["sidewalk", "footway"]);
const COVERED = 1;
const WALK = 2;
const LAWN = 4;

/** Column and row steps of the cells round a cell. */
const DI = [-1, 0, 1, -1, 1, -1, 0, 1] as const;
const DJ = [-1, -1, -1, 0, 0, 1, 1, 1] as const;

/** The steps from the cells holding `bit` through bare cells, up to `reach`, `reach + 1` past it. */
const steps = (g: Grid, bit: number, reach: number): Int16Array => {
  const { nx, nz, cells } = g;
  const dist = new Int16Array(nx * nz).fill(reach + 1);
  const queue = new Int32Array(nx * nz);
  let n = 0;
  for (let k = 0; k < cells.length; k++)
    if (cells[k]! & bit) {
      dist[k] = 0;
      queue[n++] = k;
    }
  for (let q = 0; q < n; q++) {
    const k = queue[q]!;
    const d = dist[k]! + 1;
    if (d > reach) continue;
    const [i, j] = [k % nx, Math.floor(k / nx)];
    for (let r = 0; r < 8; r++) {
      const [ii, jj] = [i + DI[r]!, j + DJ[r]!];
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const m = jj * nx + ii;
      if (dist[m]! <= d || cells[m]! & COVERED) continue;
      dist[m] = d;
      queue[n++] = m;
    }
  }
  return dist;
};

const overlaps = (a: Bounds, b: Bounds): boolean => a.minX <= b.maxX && b.minX <= a.maxX && a.minZ <= b.maxZ && b.minZ <= a.maxZ;

const boundsOf = (flat: readonly number[], ox = 0, oz = 0): Bounds => {
  let [minX, maxX, minZ, maxZ] = [Infinity, -Infinity, Infinity, -Infinity];
  for (let k = 0; k + 1 < flat.length; k += 2) {
    [minX, maxX] = [Math.min(minX, flat[k]! + ox), Math.max(maxX, flat[k]! + ox)];
    [minZ, maxZ] = [Math.min(minZ, flat[k + 1]! + oz), Math.max(maxZ, flat[k + 1]! + oz)];
  }
  return { minX, maxX, minZ, maxZ };
};

/** The bare samples of light paving in a strip between a pavement and a lawn, a chunk at a time, read with the pieces of the chunks round it. */
export const walkLawnBare = (chunks: readonly WalkLawnChunk[], covers: readonly Cover[], band = BAND): Finding[] => {
  const reach = Math.round(band / BARE_GRID);
  const pieces = chunks.flatMap((c) => c.ground.filter((g) => !g.bridge).map((g) => ({ g, box: boundsOf(g.outline) })));
  const walls = chunks.flatMap((c) => c.buildings.map((b) => ({ b, box: boundsOf(b.outline, b.x, b.z) })));
  const out: Finding[] = [];
  for (const c of chunks) {
    const b = c.bounds;
    const box = { minX: b.minX - band - 1, maxX: b.maxX + band + 1, minZ: b.minZ - band - 1, maxZ: b.maxZ + band + 1 };
    const grid = new Grid(box);
    for (const { g } of pieces.filter((p) => overlaps(p.box, box))) {
      const ring = flatRing(g.outline);
      // A sidewalk the bare ground rule laid from the orthophoto's paving (`cover`, 26.11) is the rule's paving, as its squares are: no strip begins at it.
      grid.fill(ring, COVERED | (WALKS.has(g.surface) && !g.cover ? WALK : 0) | (g.surface === "grass" ? LAWN : 0));
      // The ground is a partition of the plane: a hairline between two pieces is no bare terrain (`landuse-bare`).
      for (const [dx, dz] of HAIRLINE) grid.fill(ring.map((p) => ({ x: p.x + dx, z: p.z + dz })), COVERED);
    }
    for (const { b: w } of walls.filter((p) => overlaps(p.box, box))) grid.fill(flatRing(w.outline, w.x, w.z), COVERED);
    const [fromWalk, fromLawn] = [steps(grid, WALK, reach), steps(grid, LAWN, reach)];
    for (let j = 0; j < grid.nz; j++)
      for (let i = 0; i < grid.nx; i++) {
        const k = j * grid.nx + i;
        if (grid.cells[k]! & COVERED || fromWalk[k]! + fromLawn[k]! > reach + 1) continue;
        const [x, z] = [grid.x(i), grid.z(j)];
        if (x <= b.minX || x >= b.maxX || z <= b.minZ || z >= b.maxZ) continue;
        const cover = coverFor(covers, { x, z });
        if (!cover || coverAt(cover, x, z) !== COVER.paving) continue;
        out.push({ at: `${x.toFixed(0)},${z.toFixed(0)}`, what: `${c.id}: bare paving ${x.toFixed(2)},${z.toFixed(2)}, ${(fromWalk[k]! * BARE_GRID).toFixed(1)} m from a pavement, ${(fromLawn[k]! * BARE_GRID).toFixed(1)} m from a lawn` });
      }
  }
  return out;
};
