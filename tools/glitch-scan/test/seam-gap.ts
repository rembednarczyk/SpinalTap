/**
 * A ledge in the terrain on a seam of two chunks (G-748, the curator's review of PR #502): each
 * chunk has its own grid, and where two meet the ground the game walks and draws should be one
 * surface (ADR-0043). A point of the seam where the two grids' heights part by more than
 * `SEAM_GAP` is a step or a slot in the ground: the walker trips on it, the terrain's side shows.
 * Not where a deck, a slab or a solid of a scene stands over it (the Arkady's pavement over the
 * dip round them, `arkady.ts`): there the ground is not seen nor walked.
 */

import { type SeamChunk, chunkSeams } from "../../../packages/sim/src/content/lublin/seams";

type Finding = { readonly at: string; readonly what: string };

/** How far apart the check samples a seam (m), on the world's grid: a sample at every multiple of it. */
export const SEAM_SAMPLE = 0.25;
/** The two grids parting by more than this on a seam is a ledge (m): G-758's test of acceptance, under the curator's 0.1 m. */
export const SEAM_GAP = 0.05;
/** Below this over `SEAM_GAP` the parting is the floats' (m): -1.95 against -2.0 is 0.050000000000000044 apart. */
const ROUNDING = 1e-6;

/** What the check reads of the game. */
export interface SeamWorld {
  /** A chunk's terrain height at (x, z), or null for a chunk without terrain. */
  readonly height: (chunk: string, x: number, z: number) => number | null;
  /** Is the ground at (x, z), at height `y`, under a deck, a slab or a solid of a scene? */
  readonly covered: (x: number, z: number, y: number) => boolean;
}

/**
 * The points of the chunks' seams, every `SEAM_SAMPLE` on the world's grid, where the two chunks'
 * terrain parts by more than `SEAM_GAP` and nothing stands over the higher of the two. A point
 * where three or four chunks meet is taken once, on the first seam through it.
 */
export const seamGaps = (chunks: readonly SeamChunk[], world: SeamWorld): Finding[] => {
  const out: Finding[] = [];
  const seen = new Set<string>();
  for (const s of chunkSeams(chunks)) {
    const [k0, k1] = [Math.ceil(s.lo / SEAM_SAMPLE - 1e-9), Math.floor(s.hi / SEAM_SAMPLE + 1e-9)];
    for (let k = k0; k <= k1; k++) {
      const u = k * SEAM_SAMPLE;
      const [x, z] = s.along === "z" ? [s.at, u] : [u, s.at];
      const [ha, hb] = [world.height(s.a, x, z), world.height(s.b, x, z)];
      if (ha === null || hb === null || Math.abs(ha - hb) <= SEAM_GAP + ROUNDING) continue;
      const at = `${x.toFixed(2)},${z.toFixed(2)}`;
      if (seen.has(at) || world.covered(x, z, Math.max(ha, hb))) continue;
      seen.add(at);
      out.push({ at, what: `${s.a} ${ha.toFixed(3)} | ${s.b} ${hb.toFixed(3)}: ${Math.abs(ha - hb).toFixed(3)} m apart` });
    }
  }
  return out;
};
