/**
 * Steps between the pieces of a bridge's deck (G-340, G-344): a point on the edge of a piece with
 * another piece `STEP_OUT` beyond it lower by more than `STEP_FACE`. The renderer closes such an
 * edge with a face down to the lower piece, which nothing collides with, and the walker coming up
 * from the lower piece walks under the higher one as under a bridge (G-062), on the terrain.
 * One bridge's carriageway and sidewalk lie level within a kerb.
 */

type Pt = { readonly x: number; readonly z: number };
type Piece = { readonly ring: readonly Pt[] };
type Finding = { readonly at: string; readonly what: string };

/** How far along an edge the scan samples (m). */
export const STEP_SAMPLE = 0.5;
/** How far beyond the edge it looks for the other piece (m): as the renderer does. */
export const STEP_OUT = 0.3;
/** A drop more than this to the other piece is a step, not a kerb (m): the renderer's face. */
export const STEP_FACE = 0.3;

const inside = (ring: readonly Pt[], x: number, z: number): boolean => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c;
  }
  return c;
};

/**
 * The steps along the edges of `pieces`: `height(piece, x, z)` the piece's own deck there,
 * `deck(x, z)` the highest deck there or null off the decks, `skip` the points left out (T-147).
 */
export const deckSteps = <T extends Piece>(
  pieces: readonly T[],
  height: (piece: T, x: number, z: number) => number,
  deck: (x: number, z: number) => number | null,
  skip: (p: Pt) => boolean = () => false,
): Finding[] => {
  const out: Finding[] = [];
  // A corner is the end of two edges: counted once.
  const seen = new Set<string>();
  for (const piece of pieces) {
    const ring = piece.ring;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i]!;
      const b = ring[(i + 1) % ring.length]!;
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 1e-6) continue;
      // Either normal; the outward one leaves the piece.
      let nx = (b.z - a.z) / len;
      let nz = -(b.x - a.x) / len;
      const [mx, mz] = [(a.x + b.x) / 2, (a.z + b.z) / 2];
      if (inside(ring, mx + nx * 0.01, mz + nz * 0.01)) [nx, nz] = [-nx, -nz];
      const n = Math.max(1, Math.round(len / STEP_SAMPLE));
      for (let k = 0; k <= n; k++) {
        const p = { x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n };
        if (skip(p)) continue;
        const [qx, qz] = [p.x + nx * STEP_OUT, p.z + nz * STEP_OUT];
        if (inside(ring, qx, qz)) continue;
        const beyond = deck(qx, qz);
        const y = height(piece, p.x, p.z);
        if (beyond === null || beyond >= y - STEP_FACE) continue;
        const at = `${p.x.toFixed(1)},${p.z.toFixed(1)}`;
        if (seen.has(at)) continue;
        seen.add(at);
        out.push({ at, what: `deck ${y.toFixed(2)} over a deck at ${beyond.toFixed(2)} ${STEP_OUT} m beyond` });
      }
    }
  }
  return out;
};
