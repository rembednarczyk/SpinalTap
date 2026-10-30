import type { GroundPoint } from "@seki/core";

/**
 * A bridge's deck (ADR-0053): a piece of a road or path on a bridge, level from abutment to
 * abutment over the valley under it. Its height runs straight from `ya` at `a` to `yb` at `b`
 * along the bridge's axis; across the axis it is level.
 */
export interface GroundDeck {
  /** The piece's outline, world points, counter-clockwise. */
  readonly ring: readonly GroundPoint[];
  readonly a: GroundPoint;
  readonly b: GroundPoint;
  readonly ya: number;
  readonly yb: number;
  readonly box: { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
}

const insideRing = (ring: readonly GroundPoint[], x: number, z: number): boolean => {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c;
  }
  return c;
};

/** The deck's height over (x, z), level across its axis and clamped at its abutments. */
export const deckHeight = (d: GroundDeck, x: number, z: number): number => {
  const dx = d.b.x - d.a.x;
  const dz = d.b.z - d.a.z;
  const t = Math.max(0, Math.min(1, ((x - d.a.x) * dx + (z - d.a.z) * dz) / (dx * dx + dz * dz || 1)));
  return d.ya + (d.yb - d.ya) * t;
};

/** The highest deck over (x, z), or null where no deck is. */
export const deckAt = (decks: readonly GroundDeck[], x: number, z: number): number | null => {
  let best: number | null = null;
  for (const d of decks) {
    if (x < d.box.minX || x > d.box.maxX || z < d.box.minZ || z > d.box.maxZ || !insideRing(d.ring, x, z)) continue;
    const y = deckHeight(d, x, z);
    if (best === null || y > best) best = y;
  }
  return best;
};

/** A deck from a flat outline and axis, with the heights of the ground at its abutments. */
export const makeDeck = (outline: readonly number[], axis: readonly number[], heightAt: (x: number, z: number) => number): GroundDeck => {
  const ring: GroundPoint[] = [];
  for (let i = 0; i + 1 < outline.length; i += 2) ring.push({ x: outline[i]!, z: outline[i + 1]! });
  const a = { x: axis[0]!, z: axis[1]! };
  const b = { x: axis[2]!, z: axis[3]! };
  const xs = ring.map((p) => p.x);
  const zs = ring.map((p) => p.z);
  return { ring, a, b, ya: heightAt(a.x, a.z), yb: heightAt(b.x, b.z), box: { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) } };
};
