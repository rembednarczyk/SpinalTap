/**
 * The terrain through a bridge's deck (G-686): a point under a piece of a deck where the ground
 * the game walks is more than `THROUGH` over the deck. There the terrain, drawn without the deck's
 * paving, shows through it as a grey patch, and the feet walk on it, not on the deck.
 */
import { pointInRingEvenOdd } from "../../../packages/core/src";

type Pt = { readonly x: number; readonly z: number };
type Piece = { readonly ring: readonly Pt[] };
type Finding = { readonly at: string; readonly what: string };

/** How far apart the scan samples a piece (m). */
export const THROUGH_SAMPLE = 0.25;
/** The ground more than this over the deck comes through it (m): less is the paving's own lift. */
export const THROUGH = 0.01;

/**
 * The points under `pieces` where `ground(x, z)` is more than `THROUGH` over `deck(x, z)`, the
 * highest deck there; `skip` the points left out (T-147).
 */
export const groundOverDeck = (
  pieces: readonly Piece[],
  deck: (x: number, z: number) => number | null,
  ground: (x: number, z: number) => number,
  skip: (p: Pt) => boolean = () => false,
): Finding[] => {
  const out: Finding[] = [];
  // Two pieces share an edge: counted once.
  const seen = new Set<string>();
  for (const { ring } of pieces) {
    const xs = ring.map((p) => p.x);
    const zs = ring.map((p) => p.z);
    const [x0, z0] = [Math.ceil(Math.min(...xs) / THROUGH_SAMPLE), Math.ceil(Math.min(...zs) / THROUGH_SAMPLE)];
    const [x1, z1] = [Math.floor(Math.max(...xs) / THROUGH_SAMPLE), Math.floor(Math.max(...zs) / THROUGH_SAMPLE)];
    for (let i = x0; i <= x1; i++) {
      for (let j = z0; j <= z1; j++) {
        const p = { x: i * THROUGH_SAMPLE, z: j * THROUGH_SAMPLE };
        if (!pointInRingEvenOdd(p.x, p.z, ring) || skip(p)) continue;
        const y = deck(p.x, p.z);
        const g = ground(p.x, p.z);
        if (y === null || g <= y + THROUGH) continue;
        const at = `${p.x.toFixed(2)},${p.z.toFixed(2)}`;
        if (seen.has(at)) continue;
        seen.add(at);
        out.push({ at, what: `ground ${g.toFixed(3)} over the deck at ${y.toFixed(3)}` });
      }
    }
  }
  return out;
};
