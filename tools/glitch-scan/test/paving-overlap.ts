import { type GroundSurface, SURFACE_LIFT, type Vec3, type ViewDescriptor } from "../../../packages/core/src";
import { worldRing } from "../../../packages/engine/src/renderer/drones/drone-world";
import { drape } from "../../../packages/engine/src/renderer/mapcity/ground-plan";
import { BinIndex } from "../../../packages/engine/src/renderer/mapcity/map-index";
import { type P2, boundsOf, pointInRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { MeshSink } from "../../../packages/engine/src/renderer/mesh-sink";

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

/** The triangles `drape` lays `ring` as on `groundAt` at `lift`, read off its mesh. */
export const drapedTriangles = (ring: readonly P2[], groundAt: (x: number, z: number) => number, lift: number): Tri[] => {
  const sink = new MeshSink();
  drape(sink, ring, groundAt, lift, [0, 0, 0, 1], () => [0, 0], [0, 0]);
  const p = sink.positions;
  const v = (i: number): Vec3 => ({ x: p[i * 3]!, y: p[i * 3 + 1]!, z: p[i * 3 + 2]! });
  const out: Tri[] = [];
  for (let t = 0; t + 2 < sink.indices.length; t += 3) out.push([v(sink.indices[t]!), v(sink.indices[t + 1]!), v(sink.indices[t + 2]!)]);
  return out;
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
      for (let x = Math.ceil(minX / SAMPLE) * SAMPLE; x <= maxX; x += SAMPLE) {
        for (let z = Math.ceil(minZ / SAMPLE) * SAMPLE; z <= maxZ; z += SAMPLE) {
          if (!pointInRing({ x, z }, a.ring) || !pointInRing({ x, z }, b.ring)) continue;
          const ya = pieceHeightAt(a, x, z);
          const yb = pieceHeightAt(b, x, z);
          if (ya === null || yb === null) continue;
          const step = Math.abs(ya - a.lift - (yb - b.lift));
          if (step > worst.step) worst = { step, x, z };
        }
      }
      if (worst.step > OVERLAP_STEP) out.push({ at: `${a.surface} and ${b.surface} at ${worst.x.toFixed(1)},${worst.z.toFixed(1)}`, what: `${(worst.step * 100).toFixed(1)} cm apart over the ground` });
    }
  });
  return out;
};
