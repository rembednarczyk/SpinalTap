/**
 * Steps at a bridge's abutments (G-349): a point on the edge of a bridge's piece past which there
 * is no deck but a street or a path on the terrain, more than `ABUTMENT_STEP` above or below the
 * piece. A deck is level across its axis and the terrain at its end is the NMT's, which may fall
 * across the street: the walker coming off the street stops at the deck's edge, a car jumps on.
 * Not a way under the bridge: the terrain there lies more than the headroom under the deck (G-062).
 */
import { pointInRingEvenOdd } from "../../../packages/core/src";
import { segmentPieces } from "./world-samples";

type Pt = { readonly x: number; readonly z: number };
type Piece = { readonly ring: readonly Pt[] };
type Finding = { readonly at: string; readonly what: string };

/** The world's grid an edge is cut on (m), a sample at the middle of each piece (`world-samples.ts`, G-756): the walker's slope is read over half a metre (ADR-0043). */
export const ABUTMENT_SAMPLE = 0.5;
/** How far beyond the edge it reads the ground (m): as `deck-step-face` does. */
export const ABUTMENT_OUT = 0.3;
/** A step more than this between the deck and the street beyond is a glitch (m): a kerb is 0.15. */
export const ABUTMENT_STEP = 0.25;

const inside = (ring: readonly Pt[], x: number, z: number): boolean => pointInRingEvenOdd(x, z, ring);

/** What the scan reads off the world. */
export interface AbutmentWorld<T extends Piece> {
  /** The piece's own deck at (x, z). */
  readonly height: (piece: T, x: number, z: number) => number;
  /** The highest bridge's deck at (x, z), or null off the decks. */
  readonly deck: (x: number, z: number) => number | null;
  /** The ground the game walks at (x, z) off the decks. */
  readonly ground: (x: number, z: number) => number;
  /** Is there a street or a path at (x, z)? */
  readonly paved: (x: number, z: number) => boolean;
  /** A deck this far over the ground beyond has a way under it, not an abutment (m). */
  readonly headroom: number;
  /** The points left out (T-147). */
  readonly skip?: (p: Pt) => boolean;
}

/** The steps at the abutments along the edges of `pieces` (`AbutmentWorld`). */
export const abutmentSteps = <T extends Piece>(pieces: readonly T[], world: AbutmentWorld<T>): Finding[] => {
  const out: Finding[] = [];
  // Two pieces share an edge: a point counted once.
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
      for (const cut of segmentPieces(a, b, ABUTMENT_SAMPLE)) {
        const p = { x: cut.x, z: cut.z };
        if (world.skip?.(p)) continue;
        const [qx, qz] = [p.x + nx * ABUTMENT_OUT, p.z + nz * ABUTMENT_OUT];
        if (world.deck(qx, qz) !== null || !world.paved(qx, qz)) continue;
        const y = world.height(piece, p.x, p.z);
        const g = world.ground(qx, qz);
        if (Math.abs(y - g) <= ABUTMENT_STEP || y - g > world.headroom) continue;
        const at = `${p.x.toFixed(1)},${p.z.toFixed(1)}`;
        if (seen.has(at)) continue;
        seen.add(at);
        out.push({ at, what: `deck ${y.toFixed(2)} by the ground at ${g.toFixed(2)} ${ABUTMENT_OUT} m beyond` });
      }
    }
  }
  return out;
};
