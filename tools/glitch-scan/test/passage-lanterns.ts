/**
 * Wall lanterns hung by a passage of the game's own data (G-183): the chunks' passages and the
 * Old Town's gates the game cuts by hand (`GATE_PASSAGES`), which the map has as solid buildings
 * with no `tunnel=building_passage` way. The OSM tags miss Gruell's passage under the Trinitarian
 * tower (`tunnel=yes`) and the gates, and a band round `tunnel=yes|covered=yes` takes in Trasa
 * Podziemna, so the axes come from the game, not from the map. A gate's axis runs on along the
 * street well past its fronts (4.6 to 8.7 m), where the lanterns hang on the next houses' walls,
 * so only its stretch under the passage's own building counts, with half a metre of mouth.
 */

interface P {
  readonly x: number;
  readonly z: number;
}

export interface PassageAxis {
  readonly building: string;
  readonly from: P;
  readonly to: P;
  /** The outlines of the passage's building, in world metres. */
  readonly rings: readonly (readonly P[])[];
}

export interface LanternByPassage {
  readonly x: number;
  readonly z: number;
  readonly building: string;
  readonly gap: number;
}

/** How near a passage's axis a wall lantern hangs in its vault or its mouth (m): past half the widest passage. */
export const PASSAGE_LANTERN_REACH = 2;

/** How far past the building's fronts the mouth of a passage reaches along its axis (m). */
export const PASSAGE_MOUTH = 0.5;

const inRing = (p: P, ring: readonly P[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};

/** The stretch of the axis under the passage's building, as arc lengths from `from` (sampled every 0.25 m), or null. */
const vaultSpan = (p: PassageAxis, len: number): readonly [number, number] | null => {
  const under: number[] = [];
  for (let s = 0; s <= len; s += 0.25) {
    const q = { x: p.from.x + ((p.to.x - p.from.x) * s) / len, z: p.from.z + ((p.to.z - p.from.z) * s) / len };
    if (p.rings.some((r) => inRing(q, r))) under.push(s);
  }
  return under.length > 0 ? [under[0]!, under[under.length - 1]!] : null;
};

/**
 * Distance from l to the passage's axis, for l across its vault or a mouth; Infinity elsewhere.
 * The band ends square at the mouths: a lantern on the next house's wall, a metre on, is outside.
 */
const vaultGap = (l: P, p: PassageAxis): number => {
  const len = Math.hypot(p.to.x - p.from.x, p.to.z - p.from.z);
  const span = len > 0 ? vaultSpan(p, len) : null;
  if (!span) return Infinity;
  const [ux, uz] = [(p.to.x - p.from.x) / len, (p.to.z - p.from.z) / len];
  const s = (l.x - p.from.x) * ux + (l.z - p.from.z) * uz;
  return s < span[0] - PASSAGE_MOUTH || s > span[1] + PASSAGE_MOUTH ? Infinity : Math.abs((l.x - p.from.x) * uz - (l.z - p.from.z) * ux);
};

/** Each lantern within `reach` of a passage's vault or mouth, with the nearest such passage. */
export const lanternsByPassages = (lanterns: readonly P[], passages: readonly PassageAxis[], reach = PASSAGE_LANTERN_REACH): LanternByPassage[] =>
  lanterns.flatMap((l) => {
    const near = passages.map((p) => ({ p, gap: vaultGap(l, p) })).filter((q) => q.gap < reach);
    if (near.length === 0) return [];
    const best = near.reduce((m, q) => (q.gap < m.gap ? q : m));
    return [{ x: l.x, z: l.z, building: best.p.building, gap: best.gap }];
  });
