import { type GroundSurface, SURFACE_LIFT, type Vec3, type ViewDescriptor } from "../../../packages/core/src";
import { worldRing } from "../../../packages/engine/src/renderer/drones/drone-world";
import { drapedTriangles as drapeCorners } from "../../../packages/engine/src/renderer/mapcity/ground-plan";
import { BinIndex } from "../../../packages/engine/src/renderer/mapcity/map-index";
import { type P2, boundsOf } from "../../../packages/engine/src/renderer/mapcity/polygon";

/**
 * The ground surfaces of the scenery as the renderer drapes them (`drape`, ADR-0044), read off the
 * mesh it lays, and `paving-overlap-step`: two of them overlapping at different heights over the
 * ground where they meet (G-301). Each was cut into its own triangles and laid straight between
 * their corners, so on a bending terrain the two ran up to 3 cm apart: a step at the edge of the
 * upper one, patches of the lower one showing through it and the depth flickering between them.
 */

type Finding = { readonly at: string; readonly what: string };
type Item = { readonly view: ViewDescriptor; readonly at: Vec3 };
export type Tri = readonly [Vec3, Vec3, Vec3];

/** The surfaces the renderer lays with `drape` alone (steps, crossings and fountains have their own shapes). */
const DRAPED: ReadonlySet<GroundSurface> = new Set(["road", "sidewalk", "square", "cobble", "footway", "grass", "rail", "water"]);
/** The cells a piece's drawn triangles are sorted into for point queries (m). */
const CELL = 2;
const cellOf = (x: number, z: number): number => (Math.floor(x / CELL) + 1e4) * 4e4 + (Math.floor(z / CELL) + 1e4);

/** A piece of the drawn ground: its outline, surface, lift and its triangles as `drape` lays them, by cell. */
export interface DrawnPiece {
  readonly ring: readonly P2[];
  readonly surface: GroundSurface;
  readonly lift: number;
  /** Laid when first asked for: most of the city's paving never is. */
  readonly cells: () => ReadonlyMap<number, readonly Tri[]>;
}

/**
 * The triangles `drape` lays `ring` as on `groundAt` at `lift`, as its mesh has them: the corners
 * merged to hundredths of a millimetre (the first one kept), each triangle wound to face up. Built
 * from the engine's `drapedTriangles`, not off a mesh (G-409): the mesh reads the ground four times
 * round every vertex for its normal, most of the check's time under coverage, and the normal is
 * not compared.
 */
export const drapedTriangles = (ring: readonly P2[], groundAt: (x: number, z: number) => number, lift: number): Tri[] => {
  const seen = new Map<number, Map<number, Vec3>>();
  const at = (p: Vec3): Vec3 => {
    const kx = Math.round(p.x * 1e5);
    const kz = Math.round(p.z * 1e5);
    let row = seen.get(kx);
    if (!row) seen.set(kx, (row = new Map()));
    const known = row.get(kz);
    if (known) return known;
    row.set(kz, p);
    return p;
  };
  return drapeCorners(ring, groundAt, lift).map(([p, q, r]): Tri => {
    const [a, b, c] = [at(p), at(q), at(r)];
    // `face`: the cross product of the edges against the up normal.
    const up = (b.z - a.z) * (c.x - a.x) - (b.x - a.x) * (c.z - a.z);
    return up > 0 ? [a, c, b] : [a, b, c];
  });
};

const byCell = (tris: readonly Tri[]): Map<number, Tri[]> => {
  const cells = new Map<number, Tri[]>();
  for (const tri of tris) {
    const b = boundsOf(tri);
    for (let i = Math.floor(b.minX / CELL); i <= Math.floor(b.maxX / CELL); i++) {
      for (let k = Math.floor(b.minZ / CELL); k <= Math.floor(b.maxZ / CELL); k++) {
        const key = cellOf(i * CELL, k * CELL);
        const list = cells.get(key);
        if (list) list.push(tri);
        else cells.set(key, [tri]);
      }
    }
  }
  return cells;
};

/** The ground surfaces of `items` laid with `drape` on `groundAt` (off the bridges' decks: those follow their axis), and an index of their boxes. */
export const drawnPieces = (items: readonly Item[], groundAt: (x: number, z: number) => number): { pieces: DrawnPiece[]; index: BinIndex } => {
  const pieces: DrawnPiece[] = [];
  const index = new BinIndex();
  for (const { view, at } of items) {
    if (view.kind !== "ground" || !DRAPED.has(view.surface) || view.deck) continue;
    const ring = worldRing(view.outline, at);
    if (ring.length < 3) continue;
    const lift = SURFACE_LIFT[view.surface];
    let memo: Map<number, Tri[]> | null = null;
    index.add(pieces.push({ ring, surface: view.surface, lift, cells: () => (memo ??= byCell(drapedTriangles(ring, groundAt, lift))) }) - 1, boundsOf(ring));
  }
  return { pieces, index };
};

/** The height of the drawn piece at (x, z), the highest of its triangles there; null off them. */
export const pieceHeightAt = (piece: DrawnPiece, x: number, z: number): number | null => {
  let top: number | null = null;
  for (const [a, b, c] of piece.cells().get(cellOf(x, z)) ?? []) {
    const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    if (Math.abs(d) < 1e-12) continue;
    const wa = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d;
    const wb = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d;
    if (wa < -1e-9 || wb < -1e-9 || wa + wb > 1 + 1e-9) continue;
    const y = wa * a.y + wb * b.y + (1 - wa - wb) * c.y;
    top = top === null ? y : Math.max(top, y);
  }
  return top;
};

/** How far apart two drawn pieces may lie over the ground where they meet (m): a tenth of the 1 cm between the nearest lifts. */
export const OVERLAP_STEP = 0.001;
/** The spacing of the points where two pieces are compared (m). */
const SAMPLE = 0.5;

/**
 * `paving-overlap-step`: pairs of drawn pieces whose heights over the ground (their height less
 * their lift) differ by more than `OVERLAP_STEP` somewhere they overlap, read on a `SAMPLE` grid.
 * One per pair, at its widest step.
 */
export const pavingOverlapSteps = ({ pieces, index }: { pieces: readonly DrawnPiece[]; index: BinIndex }): Finding[] => {
  const out: Finding[] = [];
  pieces.forEach((a, i) => {
    const ba = boundsOf(a.ring);
    for (const j of index.within(ba)) {
      if (j <= i) continue;
      const b = pieces[j]!;
      const bb = boundsOf(b.ring);
      const minX = Math.max(ba.minX, bb.minX);
      const maxX = Math.min(ba.maxX, bb.maxX);
      const minZ = Math.max(ba.minZ, bb.minZ);
      const maxZ = Math.min(ba.maxZ, bb.maxZ);
      let worst = { step: 0, x: 0, z: 0 };
      // Cell by cell, only those both pieces lay triangles in: off them a piece's height is null.
      for (let ci = Math.floor(minX / CELL); ci * CELL <= maxX; ci++) {
        for (let ck = Math.floor(minZ / CELL); ck * CELL <= maxZ; ck++) {
          const key = cellOf(ci * CELL, ck * CELL);
          if (!a.cells().has(key) || !b.cells().has(key)) continue;
          for (let sx = Math.ceil(Math.max(minX, ci * CELL) / SAMPLE); sx * SAMPLE < (ci + 1) * CELL && sx * SAMPLE <= maxX; sx++) {
            for (let sz = Math.ceil(Math.max(minZ, ck * CELL) / SAMPLE); sz * SAMPLE < (ck + 1) * CELL && sz * SAMPLE <= maxZ; sz++) {
              const [x, z] = [sx * SAMPLE, sz * SAMPLE];
              const ya = pieceHeightAt(a, x, z);
              const yb = ya === null ? null : pieceHeightAt(b, x, z);
              if (ya === null || yb === null) continue;
              const step = Math.abs(ya - a.lift - (yb - b.lift));
              if (step > worst.step) worst = { step, x, z };
            }
          }
        }
      }
      if (worst.step > OVERLAP_STEP) out.push({ at: `${a.surface} and ${b.surface} at ${worst.x.toFixed(1)},${worst.z.toFixed(1)}`, what: `${(worst.step * 100).toFixed(1)} cm apart over the ground` });
    }
  });
  return out;
};
