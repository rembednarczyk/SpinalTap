/**
 * Slots between the pieces of a bridge's deck (G-340): a point off every deck with a deck on both
 * sides of it within `SLOT_REACH` along x or along z, and the ground under it at least `SLOT_DROP`
 * below the lower of the two. The walker crossing the bridge from one piece to the next (its
 * carriageway and its sidewalk) falls through to the terrain under the bridge.
 */

type Pt = { readonly x: number; readonly z: number };
type Box = { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
type Finding = { readonly at: string; readonly what: string };

/** The scan's grid (m). */
export const SLOT_GRID = 0.25;
/** How far a deck may lie on either side of a slot (m). */
export const SLOT_REACH = 2;
/** How far under the lower deck the ground in a slot lies (m). */
export const SLOT_DROP = 0.5;

/**
 * The slots in the boxes of the bridges, on the grid: `deck(x, z)` is the height of the highest
 * deck there or null off the decks, `ground(x, z)` the ground the game walks, `skip` the points
 * left out (cut on purpose, T-147).
 */
export const deckSlots = (boxes: readonly Box[], deck: (x: number, z: number) => number | null, ground: (x: number, z: number) => number, skip: (p: Pt) => boolean = () => false): Finding[] => {
  const out: Finding[] = [];
  // Boxes of bridges side by side may share a margin: a point there is counted once.
  const seen = new Set<string>();
  const reach = Math.round(SLOT_REACH / SLOT_GRID);
  for (const b of boxes) {
    const x0 = Math.floor((b.minX - SLOT_REACH) / SLOT_GRID) * SLOT_GRID;
    const z0 = Math.floor((b.minZ - SLOT_REACH) / SLOT_GRID) * SLOT_GRID;
    const nx = Math.ceil((b.maxX + SLOT_REACH - x0) / SLOT_GRID) + 1;
    const nz = Math.ceil((b.maxZ + SLOT_REACH - z0) / SLOT_GRID) + 1;
    // The decks once per point of the box and its margin: each point looks along both axes.
    const heights = Array.from({ length: nx * nz }, (_, k) => deck(x0 + (k % nx) * SLOT_GRID, z0 + Math.floor(k / nx) * SLOT_GRID));
    const at = (i: number, j: number) => (i >= 0 && i < nx && j >= 0 && j < nz ? heights[j * nx + i]! : null);
    const first = (i: number, j: number, di: number, dj: number) => {
      for (let k = 1; k <= reach; k++) {
        const y = at(i + di * k, j + dj * k);
        if (y !== null) return y;
      }
      return null;
    };
    for (let j = reach; j < nz - reach; j++) {
      for (let i = reach; i < nx - reach; i++) {
        if (at(i, j) !== null) continue;
        const p = { x: x0 + i * SLOT_GRID, z: z0 + j * SLOT_GRID };
        const key = `${p.x.toFixed(2)},${p.z.toFixed(2)}`;
        if (seen.has(key) || skip(p)) continue;
        seen.add(key);
        for (const [di, dj] of [[1, 0], [0, 1]] as const) {
          const a = first(i, j, di, dj);
          const c = a === null ? null : first(i, j, -di, -dj);
          if (a === null || c === null) continue;
          const g = ground(p.x, p.z);
          if (g > Math.min(a, c) - SLOT_DROP) continue;
          out.push({ at: key, what: `ground ${g.toFixed(2)} between decks at ${a.toFixed(2)} and ${c.toFixed(2)}` });
          break;
        }
      }
    }
  }
  return out;
};
