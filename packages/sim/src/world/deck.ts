import { type GroundPoint, type TerrainGrid, type Vec3, pointInRingEvenOdd, segmentParam, terrainHeightAt } from "@seki/core";

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

const over = (d: GroundDeck, x: number, z: number): boolean => x >= d.box.minX && x <= d.box.maxX && z >= d.box.minZ && z <= d.box.maxZ && pointInRingEvenOdd(x, z, d.ring);

/** The deck's height over (x, z), level across its axis and clamped at its abutments. */
export const deckHeight = (d: GroundDeck, x: number, z: number): number => d.ya + (d.yb - d.ya) * segmentParam(x, z, d.a.x, d.a.z, d.b.x, d.b.z);

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
 * Is the ground at (x, z) over the terrain at `terrain`, for feet reaching up to `reach`, a
 * bridge's own deck over the terrain, not a flight's, no steeper along its axis than `limit` (G-898)?
 */
export const onBridgeDeck = (decks: readonly GroundDeck[], x: number, z: number, terrain: number, reach: number, limit: number): boolean => {
  const y = decksAt(decks, x, z, reach, terrain, flightsIn(decks));
  if (y === null || y <= terrain || foundFlight) return false;
  return decks.some((d) => d.flight !== true && over(d, x, z) && deckHeight(d, x, z) === y && Math.abs(d.yb - d.ya) <= limit * Math.hypot(d.b.x - d.a.x, d.b.z - d.a.z));
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
 * bridge (G-062), down to MIN_DEPTH, so a walker's head keeps clear of its underside. Thinning
 * towards the headroom from below too: a jump in depth there is a tooth in the fascia over a
 * bank, and the underside drawn straight across it hangs below the fascia's thin part (G-743).
 */
export const deckDepth = (deck: number, terrain: number): number => {
  const room = deck - terrain;
  return Math.min(DECK_DEPTH, room > DECK_HEADROOM ? Math.max(MIN_DEPTH, room - HEAD_CLEARANCE) : MIN_DEPTH + DECK_HEADROOM - room);
};

/** The lowest underside of a deck over (x, z) at or above `head`, or Infinity: a jump under the bridge stops there. */
export const deckCeiling = (decks: readonly GroundDeck[], x: number, z: number, head: number, terrain: number): number => {
  let ceiling = Infinity;
  for (const d of decks) {
    if (x < d.box.minX || x > d.box.maxX || z < d.box.minZ || z > d.box.maxZ || !pointInRingEvenOdd(x, z, d.ring)) continue;
    const y = deckHeight(d, x, z);
    const under = y - deckDepth(y, terrain);
    if (under >= head - 1e-6 && under < ceiling) ceiling = under;
  }
  return ceiling;
};

/** Where the terrain under a deck is: the ground's grids (`GroundField`). */
export interface TerrainAt {
  gridAt(x: number, z: number): TerrainGrid | null;
}

/** How far apart along the ground a ray samples a deck's slab (m): its underside follows the terrain. */
const RAY_STEP = 0.25;

/** Distances along a ray (XZ part of `dir`) where it crosses the ring's edges, within (0, maxDist). */
const ringCrossings = (ring: readonly GroundPoint[], origin: Vec3, dir: Vec3, maxDist: number): number[] => {
  const out = [0, maxDist];
  for (let i = 0; i < ring.length; i++) {
    const p = ring[i]!;
    const q = ring[(i + 1) % ring.length]!;
    const ex = q.x - p.x;
    const ez = q.z - p.z;
    const denom = dir.x * ez - dir.z * ex;
    if (Math.abs(denom) < 1e-12) continue;
    const wx = p.x - origin.x;
    const wz = p.z - origin.z;
    const t = (wx * ez - wz * ex) / denom;
    const s = (wx * dir.z - wz * dir.x) / denom;
    if (s >= 0 && s <= 1 && t > 0 && t < maxDist) out.push(t);
  }
  return out.sort((a, b) => a - b);
};

/**
 * Distance along a ray (normalised `dir`) to where it goes into a bridge's deck (G-071), or null
 * within `maxDist`: the slab from its surface down to its underside (`deckDepth` over the terrain
 * in `terrain`), so the deck stops shots and sight between over and under the bridge as it
 * stops a jump (G-062). Within one step the ray goes in where it crosses the surface or the
 * underside, so a steep ray through the thin slab is not stepped over.
 */
export const rayDeck = (d: GroundDeck, origin: Vec3, dir: Vec3, maxDist: number, terrain: TerrainAt): number | null => {
  const ts = ringCrossings(d.ring, origin, dir, maxDist);
  const flat = Math.hypot(dir.x, dir.z);
  for (let i = 0; i + 1 < ts.length; i++) {
    const a = ts[i]!;
    const b = ts[i + 1]!;
    if (b - a < 1e-9) continue;
    const mid = (a + b) / 2;
    if (!pointInRingEvenOdd(origin.x + dir.x * mid, origin.z + dir.z * mid, d.ring)) continue;
    const n = Math.max(1, Math.ceil(((b - a) * flat) / RAY_STEP));
    let prevT = a;
    let prevTop = 0;
    let prevUnder = 0;
    for (let k = 0; k <= n; k++) {
      const t = a + ((b - a) * k) / n;
      const x = origin.x + dir.x * t;
      const z = origin.z + dir.z * t;
      const y = origin.y + dir.y * t;
      const top = deckHeight(d, x, z);
      const gTop = y - top;
      const grid = terrain.gridAt(x, z);
      const gUnder = y - (top - deckDepth(top, grid ? terrainHeightAt(grid, x, z) : 0));
      // Starting in the slab: the ray came in through its fascia, at the outline.
      if (k === 0 && gTop < -1e-6 && gUnder > 1e-6) return t;
      if (k > 0 && prevTop > 0 && gTop <= 0) return prevT + ((t - prevT) * prevTop) / (prevTop - gTop);
      if (k > 0 && prevUnder < 0 && gUnder >= 0) return prevT + ((t - prevT) * -prevUnder) / (gUnder - prevUnder);
      prevT = t;
      prevTop = gTop;
      prevUnder = gUnder;
    }
  }
  return null;
};

/** Distance along a ray to the nearest of the bridges' decks (`rayDeck`) whose box it crosses, or null within `maxDist`. */
export const rayDecks = (decks: readonly GroundDeck[], origin: Vec3, dir: Vec3, maxDist: number, terrain: TerrainAt): number | null => {
  const ex = origin.x + dir.x * maxDist;
  const ez = origin.z + dir.z * maxDist;
  const minX = Math.min(origin.x, ex);
  const maxX = Math.max(origin.x, ex);
  const minZ = Math.min(origin.z, ez);
  const maxZ = Math.max(origin.z, ez);
  let best: number | null = null;
  for (const d of decks) {
    const b = d.box;
    if (minX > b.maxX || maxX < b.minX || minZ > b.maxZ || maxZ < b.minZ) continue;
    const t = rayDeck(d, origin, dir, best ?? maxDist, terrain);
    if (t !== null) best = t;
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
