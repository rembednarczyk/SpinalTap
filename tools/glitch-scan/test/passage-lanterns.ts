/**
 * Wall lanterns hung by a passage of the game's own data (G-183): the chunks' passages and the
 * Old Town's gates the game cuts by hand (`GATE_PASSAGES`), which the map has as solid buildings
 * with no `tunnel=building_passage` way. The OSM tags miss Gruell's passage under the Trinitarian
 * tower (`tunnel=yes`) and the gates, and a band round `tunnel=yes|covered=yes` takes in Trasa
 * Podziemna, so the axes come from the game, not from the map.
 */

interface P {
  readonly x: number;
  readonly z: number;
}

export interface PassageAxis {
  readonly building: string;
  readonly from: P;
  readonly to: P;
}

export interface LanternByPassage {
  readonly x: number;
  readonly z: number;
  readonly building: string;
  readonly gap: number;
}

/** How near a passage's axis a wall lantern hangs in its vault or its mouth (m): past half the widest passage. */
export const PASSAGE_LANTERN_REACH = 2;

/** Distance from p to the segment a-b, clamped to its ends: the passage runs no further than its axis. */
const segmentGap = (p: P, a: P, b: P): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(a.x + dx * k - p.x, a.z + dz * k - p.z);
};

/** Each lantern within `reach` of a passage's axis, with the nearest such passage. */
export const lanternsByPassages = (lanterns: readonly P[], passages: readonly PassageAxis[], reach = PASSAGE_LANTERN_REACH): LanternByPassage[] =>
  lanterns.flatMap((l) => {
    const near = passages.map((p) => ({ p, gap: segmentGap(l, p.from, p.to) })).filter((q) => q.gap < reach);
    if (near.length === 0) return [];
    const best = near.reduce((m, q) => (q.gap < m.gap ? q : m));
    return [{ x: l.x, z: l.z, building: best.p.building, gap: best.gap }];
  });
