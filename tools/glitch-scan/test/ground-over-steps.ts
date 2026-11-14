import { SURFACE_LIFT } from "../../../packages/core/src";
import type { GroundChunk } from "./ground-strips";

/**
 * `ground-over-steps` (G-777 round 2): a piece of the tables' ground other than steps, lifted higher
 * than the steps are (`SURFACE_LIFT`), over a flight's outline by more than `MIN_OVER` m²: it breaks
 * through the lowest tread, a dark wedge with an ink edge where the flight meets the paving. One per
 * pair of pieces, at the middle of their overlap; off the bridges, as the decks lie apart.
 */

/** The least overlap counted (m²). */
export const MIN_OVER = 0.01;
/** The sampling grid (m): the tables lie on 0.1 m, so a cell's half. */
const SAMPLE = 0.05;
/** A sample this near a flight's outline (m) lies on it: on an edge a paving cut off the flight shares with it (G-781), in both or neither as the sums round. */
const ON_EDGE = 1e-6;

type Pt = { readonly x: number; readonly z: number };
type Piece = { readonly surface: string; readonly ring: Pt[]; readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };

const inRing = (x: number, z: number, r: readonly Pt[]): boolean => {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i]!;
    const b = r[j]!;
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};

const onEdge = (x: number, z: number, r: readonly Pt[]): boolean =>
  r.some((a, i) => {
    const b = r[(i + 1) % r.length]!;
    const [dx, dz] = [b.x - a.x, b.z - a.z];
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(a.x + dx * t - x, a.z + dz * t - z) < ON_EDGE;
  });

const pieceOf = (surface: string, flat: readonly number[]): Piece => {
  const ring = Array.from({ length: flat.length >> 1 }, (_, i) => ({ x: flat[2 * i]!, z: flat[2 * i + 1]! }));
  const xs = ring.map((p) => p.x);
  const zs = ring.map((p) => p.z);
  return { surface, ring, minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
};

export const groundOverSteps = (chunks: readonly GroundChunk[]): { at: string; what: string }[] =>
  chunks.flatMap((c) => {
    const pieces = c.ground.filter((g) => !g.bridge).map((g) => pieceOf(g.surface, g.outline));
    const steps = pieces.filter((p) => p.surface === "steps");
    const above = pieces.filter((p) => p.surface !== "steps" && SURFACE_LIFT[p.surface as keyof typeof SURFACE_LIFT] > SURFACE_LIFT.steps);
    return steps.flatMap((s) =>
      above.flatMap((p) => {
        const [minX, maxX, minZ, maxZ] = [Math.max(s.minX, p.minX), Math.min(s.maxX, p.maxX), Math.max(s.minZ, p.minZ), Math.min(s.maxZ, p.maxZ)];
        if (minX >= maxX || minZ >= maxZ) return [];
        let n = 0;
        let [sx, sz] = [0, 0];
        for (let i = Math.floor(minX / SAMPLE); (i + 0.5) * SAMPLE < maxX; i++) {
          for (let k = Math.floor(minZ / SAMPLE); (k + 0.5) * SAMPLE < maxZ; k++) {
            const [x, z] = [(i + 0.5) * SAMPLE, (k + 0.5) * SAMPLE];
            if (!inRing(x, z, s.ring) || !inRing(x, z, p.ring) || onEdge(x, z, s.ring)) continue;
            n++;
            sx += x;
            sz += z;
          }
        }
        const area = n * SAMPLE * SAMPLE;
        if (area <= MIN_OVER) return [];
        return [{ at: `${(sx / n).toFixed(1)},${(sz / n).toFixed(1)}`, what: `${c.id}: ${p.surface} over steps, ${area.toFixed(2)} m²` }];
      }),
    );
  });
