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

/**
 * A deck more than this over the terrain under it leaves room to walk under (G-062): Podwale under
 * the viaduct of Zamkowa, the embankment path under Mełgiewska. A lower one is the ground there.
 */
export const DECK_HEADROOM = 2;

/**
 * The highest deck over (x, z) that is ground for feet reaching up to `reach`, or null where no
 * deck is. A deck with headroom under it (over `terrain` there) and above the reach is overhead,
 * not ground: the feet stay on the way under the bridge.
 */
export const deckAt = (decks: readonly GroundDeck[], x: number, z: number, reach = Infinity, terrain = -Infinity): number | null => {
  let best: number | null = null;
  for (const d of decks) {
    if (x < d.box.minX || x > d.box.maxX || z < d.box.minZ || z > d.box.maxZ || !insideRing(d.ring, x, z)) continue;
    const y = deckHeight(d, x, z);
    if (y > reach && y - terrain > DECK_HEADROOM) continue;
    if (best === null || y > best) best = y;
  }
  return best;
};

/** How deep a deck hangs below its surface, its fascia and underside as drawn (ADR-0053), metres. */
export const DECK_DEPTH = 0.9;
/** Room kept under a deck with headroom: a walker (1.8 m) and a little more. */
const HEAD_CLEARANCE = 1.9;
const MIN_DEPTH = 0.2;

/**
 * How deep the deck at `deck` hangs over the terrain at `terrain`: thinner over a way under the
 * bridge (G-062), down to MIN_DEPTH, so a walker's head keeps clear of its underside.
 */
export const deckDepth = (deck: number, terrain: number): number => {
  const room = deck - terrain;
  return room > DECK_HEADROOM ? Math.min(DECK_DEPTH, Math.max(MIN_DEPTH, room - HEAD_CLEARANCE)) : DECK_DEPTH;
};

/** The lowest underside of a deck over (x, z) at or above `head`, or Infinity: a jump under the bridge stops there. */
export const deckCeiling = (decks: readonly GroundDeck[], x: number, z: number, head: number, terrain: number): number => {
  let ceiling = Infinity;
  for (const d of decks) {
    if (x < d.box.minX || x > d.box.maxX || z < d.box.minZ || z > d.box.maxZ || !insideRing(d.ring, x, z)) continue;
    const y = deckHeight(d, x, z);
    const under = y - deckDepth(y, terrain);
    if (under >= head - 1e-6 && under < ceiling) ceiling = under;
  }
  return ceiling;
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
