import type { GroundPoint } from "@seki/core";
import { DECK_DEPTH, type GroundDeck, deckAt, groundOver, makeDeck } from "../../world/deck";
import { MAP_CHUNKS, rawHeight } from "./sites";

/** The bridges' pieces of each chunk as the map has them, before the flights down beside them. */
const MAP_DECKS: ReadonlyMap<string, readonly GroundDeck[]> = new Map(
  MAP_CHUNKS.map((c) => [c.id, c.ground.flatMap((g) => (g.deck ? [makeDeck(g.outline, g.deck, rawHeight)] : []))]),
);

/** Half the band of a flight of steps the import lays (m). */
const FLIGHT_HALF = 1.5;

const cross = (p: GroundPoint, q: GroundPoint): number => p.x * q.z - p.z * q.x;

/**
 * A flight's run from `a` (at `ya`) up to `b` (at `yb`) as a deck on its band. Where the flight
 * goes on down from `a` to `below`, the band ends at `a` on the bisector of the bend, so the run
 * below keeps its own band where the two overlap (else its treads by the bend would rise to this
 * run's grade).
 */
const runDeck = (a: GroundPoint, b: GroundPoint, ya: number, yb: number, below?: GroundPoint): GroundDeck => {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const u = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
  const n = { x: -u.z, z: u.x };
  const d = below ? Math.hypot(below.x - a.x, below.z - a.z) : 0;
  const m = below && d > 0 ? { x: u.x + (below.x - a.x) / d, z: u.z + (below.z - a.z) / d } : null;
  // Along the run from `a`, where the band's edge `s` m off the axis meets the bisector.
  const foot = (s: number) => (m && Math.abs(cross(u, m)) > 1e-6 ? (-s * cross(n, m)) / cross(u, m) : 0);
  const edge = (p: GroundPoint, s: number, t: number) => ({ x: p.x + n.x * s + u.x * t, z: p.z + n.z * s + u.z * t });
  const ring = [edge(a, -FLIGHT_HALF, foot(-FLIGHT_HALF)), edge(b, -FLIGHT_HALF, 0), edge(b, FLIGHT_HALF, 0), edge(a, FLIGHT_HALF, foot(FLIGHT_HALF))];
  const xs = ring.map((p) => p.x);
  const zs = ring.map((p) => p.z);
  return { ring, a, b, ya, yb, box: { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }, flight: true };
};

/**
 * The flights of steps hung off a bridge's deck (G-255): a flight of the map whose top lies on a
 * deck more than `DECK_DEPTH` over the terrain where the flight leaves it, so the flight's treads
 * on the terrain would drop off the deck's edge. The steps from the viaduct of Zamkowa run down
 * beside it over the NMT interpolated under the deck: 3.2 m under the deck where they leave it,
 * 1.4 m lower than at the bend below. The run leaving the deck is a deck of its own, from the
 * deck's height there down to the terrain at the run's lower end; the runs on the deck stay on
 * it, those below on the terrain. Not a ramp of the terrain: on its 2.5 m grid a band 3 m wide
 * standing 3 m over the ground beside it comes out up to 1.6 m low (bilinear, G-236 round 2).
 */
const FLIGHT_DECKS: readonly GroundDeck[] = (() => {
  const bridges = [...MAP_DECKS.values()].flat();
  const seen = new Set<string>();
  const out: GroundDeck[] = [];
  for (const f of MAP_CHUNKS.flatMap((c) => c.flights ?? [])) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    const pts: GroundPoint[] = [];
    for (let i = 0; i + 1 < f.line.length; i += 2) pts.push({ x: f.line[i]!, z: f.line[i + 1]! });
    let k = pts.length;
    while (k > 0 && deckAt(bridges, pts[k - 1]!.x, pts[k - 1]!.z) !== null) k--;
    if (k === 0 || k === pts.length) continue;
    const [low, top] = [pts[k - 1]!, pts[k]!];
    const y = deckAt(bridges, top.x, top.z)!;
    const yLow = rawHeight(low.x, low.z);
    if (y - rawHeight(top.x, top.z) > DECK_DEPTH && y > yLow) out.push(runDeck(low, top, yLow, y, pts[k - 2]));
  }
  return out;
})();

const touches = (a: GroundDeck["box"], b: GroundDeck["box"]): boolean => a.minX <= b.maxX && b.minX <= a.maxX && a.minZ <= b.maxZ && b.minZ <= a.maxZ;

/**
 * The bridges' decks of the map (ADR-0053), by chunk: each piece of a road or path the map has
 * on a bridge, level from abutment to abutment at the terrain's height there, over the valley,
 * with the flights down beside it that its outline reaches over (G-255).
 */
export const BRIDGE_DECKS: ReadonlyMap<string, readonly GroundDeck[]> = new Map(
  [...MAP_DECKS].map(([id, decks]) => [
    id,
    decks.map((d) => {
      const beside = FLIGHT_DECKS.filter((f) => touches(f.box, d.box));
      return beside.length > 0 ? { ...d, beside } : d;
    }),
  ]),
);

/** The ground's decks of the map by chunk: its bridges' pieces and the flights hung off them that reach into it (G-255). */
export const GROUND_DECKS: ReadonlyMap<string, readonly GroundDeck[]> = new Map(
  MAP_CHUNKS.map((c) => [c.id, [...(BRIDGE_DECKS.get(c.id) ?? []), ...FLIGHT_DECKS.filter((f) => touches(f.box, c.bounds))]]),
);

const ALL_DECKS: readonly GroundDeck[] = [...BRIDGE_DECKS.values()].flat();
const ALL_GROUND: readonly GroundDeck[] = [...ALL_DECKS, ...FLIGHT_DECKS];

/** The highest bridge deck over (x, z), or null off the bridges. */
export const bridgeDeckAt = (x: number, z: number): number | null => deckAt(ALL_DECKS, x, z);

/** The ground at (x, z) over the terrain at `terrain` there: a bridge's deck, or a flight hung off one (G-255), or the terrain. */
export const deckGroundAt = (x: number, z: number, terrain: number): number => groundOver(ALL_GROUND, x, z, terrain);

/** The flight hung off a bridge (G-255) whose band holds (x, z), or null. */
export const flightDeckAt = (x: number, z: number): GroundDeck | null => FLIGHT_DECKS.find((f) => deckAt([f], x, z) !== null) ?? null;
