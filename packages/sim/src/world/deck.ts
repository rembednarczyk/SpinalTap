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
  /**
   * A flight of steps hung off a bridge's deck down to the terrain (G-255), not a bridge's piece:
   * the ground on its outline for all feet, even where the terrain rises over it (the flight cut
   * into the bank). No headroom under it as under a bridge (G-062): the flight stands on its own
   * solid, so nobody gets under it, and from beside it rises as a bank too steep to walk (ADR-0043).
   */
  readonly flight?: boolean;
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

const over = (d: GroundDeck, x: number, z: number): boolean => x >= d.box.minX && x <= d.box.maxX && z >= d.box.minZ && z <= d.box.maxZ && insideRing(d.ring, x, z);

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

/** Is (x, z) on a bridge's own deck, not a flight's? There the bridge is the ground, over a flight beside it too (G-274). */
const onBridge = (decks: readonly GroundDeck[], x: number, z: number): boolean => decks.some((d) => d.flight !== true && over(d, x, z));

/**
 * How far round a flight hung off a bridge its deck has no room under it (m): the flight's band
 * and its margin, as boxes. From the flight under the deck beside it is the niche's wall (G-274).
 */
const BY_FLIGHT = 1;

const flightsMemo = new WeakMap<readonly GroundDeck[], readonly GroundDeck[]>();

/** The flights of steps hung off a bridge among decks, found once per array (almost always none). */
export const flightsIn = (decks: readonly GroundDeck[]): readonly GroundDeck[] => {
  let flights = flightsMemo.get(decks);
  if (!flights) {
    flights = decks.filter((d) => d.flight === true);
    flightsMemo.set(decks, flights);
  }
  return flights;
};

/** By a flight hung off a bridge, in the niche's walls (G-274), no room under the deck either. */
const byFlight = (flights: readonly GroundDeck[], x: number, z: number): boolean => {
  for (const f of flights) if (x >= f.box.minX - BY_FLIGHT && x <= f.box.maxX + BY_FLIGHT && z >= f.box.minZ - BY_FLIGHT && z <= f.box.maxZ + BY_FLIGHT) return true;
  return false;
};

/** Whether the last `decksAt` found a flight's deck among those that are ground: a lookup allocates nothing. */
let foundFlight = false;

/**
 * The highest deck over (x, z) that is ground for feet reaching up to `reach` (`deckAt`), the
 * flights among `decks` being `flights`; whether a flight's is among them in `foundFlight`.
 */
const decksAt = (decks: readonly GroundDeck[], x: number, z: number, reach: number, terrain: number, flights: readonly GroundDeck[]): number | null => {
  let best: number | null = null;
  foundFlight = false;
  if (flights.length === 0) {
    // No flight among them (all chunks but two): the bridges' rule alone.
    for (const d of decks) {
      if (!over(d, x, z)) continue;
      const y = deckHeight(d, x, z);
      if (y > reach && y - terrain > DECK_HEADROOM) continue;
      if (best === null || y > best) best = y;
    }
    return best;
  }
  const roomless = byFlight(flights, x, z);
  for (const d of decks) {
    if (!over(d, x, z)) continue;
    // A flight's band ends at a bridge's outline (G-274): the deck drawn there is the bridge's.
    if (d.flight === true && onBridge(decks, x, z)) continue;
    const y = deckHeight(d, x, z);
    if (y > reach && d.flight !== true && !roomless && y - terrain > DECK_HEADROOM) continue;
    foundFlight ||= d.flight === true;
    if (best === null || y > best) best = y;
  }
  return best;
};

/**
 * The highest deck over (x, z) that is ground for feet reaching up to `reach`, or null where no
 * deck is. A deck with headroom under it (over `terrain` there) and above the reach is overhead,
 * not ground: the feet stay on the way under the bridge; not so a flight hung off one (G-255),
 * which has no room under it.
 */
export const deckAt = (decks: readonly GroundDeck[], x: number, z: number, reach = Infinity, terrain = -Infinity): number | null =>
  decksAt(decks, x, z, reach, terrain, flightsIn(decks));

/** Is (x, z) on a flight of steps hung off a bridge (G-255), off the bridge's own deck (G-274)? */
export const onFlight = (decks: readonly GroundDeck[], x: number, z: number): boolean => decks.some((d) => d.flight === true && over(d, x, z)) && !onBridge(decks, x, z);

/**
 * The ground at (x, z) over the terrain at `terrain` there, for feet reaching up to `reach`: the
 * highest deck that is ground (`deckAt`) where it lies over the terrain, or on a flight of steps
 * hung off a bridge, which is cut into the terrain where that rises over it (G-255); else the terrain.
 * `flights`, those among `decks`, held by a caller that asks often (the ground, per chunk).
 */
export const groundOver = (decks: readonly GroundDeck[], x: number, z: number, terrain: number, reach = Infinity, flights = flightsIn(decks)): number => {
  const y = decksAt(decks, x, z, reach, terrain, flights);
  return y !== null && (y > terrain || foundFlight) ? y : terrain;
};

/**
 * The gradient at (x, z) of a flight of steps hung off a bridge (G-255) that feet reaching up to
 * `reach` walk on there, written into `out`, or null off one: its own grade, so its seams with
 * the terrain beside it, a step or less where the feet get on, are no bank (ADR-0043). A flight
 * out of reach keeps the ground's gradient, a bank too steep to walk up.
 */
export const flightGradientAt = (decks: readonly GroundDeck[], x: number, z: number, reach: number, out: { x: number; z: number }): { x: number; z: number } | null => {
  const d = decks.find((f) => f.flight === true && over(f, x, z) && deckHeight(f, x, z) <= reach);
  if (!d || onBridge(decks, x, z)) return null;
  const dx = d.b.x - d.a.x;
  const dz = d.b.z - d.a.z;
  const len2 = dx * dx + dz * dz || 1;
  const t = ((x - d.a.x) * dx + (z - d.a.z) * dz) / len2;
  const k = t > 0 && t < 1 ? (d.yb - d.ya) / len2 : 0;
  out.x = dx * k;
  out.z = dz * k;
  return out;
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
