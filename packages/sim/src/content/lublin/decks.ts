import type { GroundPoint } from "@seki/core";
import { DECK_DEPTH, type GroundDeck, deckAt, groundOver, makeDeck } from "../../world/deck";
import { MAP_CHUNKS, rawHeight } from "./sites";

/** The bridges' pieces of each chunk as the map has them, before the flights down beside them. */
const MAP_DECKS: ReadonlyMap<string, readonly GroundDeck[]> = new Map(
  MAP_CHUNKS.map((c) => [c.id, c.ground.flatMap((g) => (g.deck ? [makeDeck(g.outline, g.deck, rawHeight)] : []))]),
);

/** Half the band of a flight of steps the import lays (m). */
const BAND_HALF = 1.5;
/**
 * Half a flight's deck: the band, a walker's body (0.38 m) and the import's rounding, so the
 * drawn treads all lie on it and a walker stands on them while its body is over them.
 */
const FLIGHT_HALF = BAND_HALF + 0.4;

const cross = (p: GroundPoint, q: GroundPoint): number => p.x * q.z - p.z * q.x;

/** The bisector at `p` of the bend from `u` (along the run, out of `p`) to `next`, or null at an end of the flight. */
const bisector = (p: GroundPoint, u: GroundPoint, next?: GroundPoint): GroundPoint | null => {
  const d = next ? Math.hypot(next.x - p.x, next.z - p.z) : 0;
  return next && d > 0 ? { x: u.x + (next.x - p.x) / d, z: u.z + (next.z - p.z) / d } : null;
};

/** The band of a flight's run from `a` up to `b`, and how far from each end along the run its edges reach the bisector of a bend there. */
interface RunBand {
  readonly ring: readonly GroundPoint[];
  readonly landA: number;
  readonly landB: number;
}

/**
 * The band of a flight's run from `a` up to `b`. At a bend, to `before` below `a` or `after`
 * past `b`, the band ends on the bisector, so each run keeps its own band where two overlap. At
 * the deck the band goes on square `past` m beyond `b`, level there, over both corners of the
 * turn onto the deck's run (else a hole to the terrain 3.5 m down between the two bands). The
 * landings reach as far along the run as a bend's bisector across the band.
 */
const runBand = (a: GroundPoint, b: GroundPoint, before?: GroundPoint, after?: GroundPoint, past = 0): RunBand => {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const u = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
  const n = { x: -u.z, z: u.x };
  const [ma, mb] = [bisector(a, u, before), bisector(b, { x: -u.x, z: -u.z }, after)];
  // Along the run, where the band's edge `s` m off the axis meets the bisector `m`.
  const along = (s: number, m: GroundPoint | null) => (m && Math.abs(cross(u, m)) > 1e-6 ? (-s * cross(n, m)) / cross(u, m) : 0);
  const edge = (p: GroundPoint, s: number, m: GroundPoint | null, t0 = 0) => {
    const t = along(s, m) + t0;
    return { x: p.x + n.x * s + u.x * t, z: p.z + n.z * s + u.z * t };
  };
  const reach = (m: GroundPoint | null) => Math.max(Math.abs(along(BAND_HALF, m)), Math.abs(along(-BAND_HALF, m)));
  const end = past > 0 ? null : mb;
  return { ring: [edge(a, -FLIGHT_HALF, ma), edge(b, -FLIGHT_HALF, end, past), edge(b, FLIGHT_HALF, end, past), edge(a, FLIGHT_HALF, ma)], landA: reach(ma), landB: reach(mb) };
};

/**
 * A flight's run as a deck on its band, from `ya` at `a` to `yb` at `b`, level for `landA` and
 * `landB` m from its ends: a deck is level across its axis, so two runs meet on the bisector of a
 * bend at one height only on a landing there, as stairs have (else a 0.4 m wall across the bend).
 */
const runDeck = (a: GroundPoint, b: GroundPoint, ya: number, yb: number, band: RunBand): GroundDeck => {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const u = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
  const xs = band.ring.map((p) => p.x);
  const zs = band.ring.map((p) => p.z);
  return {
    ring: band.ring,
    a: { x: a.x + u.x * band.landA, z: a.z + u.z * band.landA },
    b: { x: b.x - u.x * band.landB, z: b.z - u.z * band.landB },
    ya,
    yb,
    box: { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) },
    flight: true,
  };
};

/**
 * The flights of steps hung off a bridge's deck (G-255): a flight of the map whose top lies on a
 * deck more than `DECK_DEPTH` over the terrain where the flight leaves it, so the flight's treads
 * on the terrain would drop off the deck's edge. The steps from the viaduct of Zamkowa run down
 * beside it over the NMT interpolated under the deck: 3.2 m under the deck where they leave it,
 * 1.4 m lower than at the bend below. The flight from its foot up to where it leaves the deck is
 * a deck of its own, run by run with landings at the bends, at an even grade from the terrain at
 * the foot (where the ground across the band is within a step of it) up to the deck's height; its
 * runs on the deck stay on it. Not a ramp of the terrain: on its 2.5 m grid a band 3 m wide standing 3 m over the ground
 * beside it comes out up to 1.6 m low (bilinear, G-236 round 2).
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
    const top = pts[k]!;
    const y = deckAt(bridges, top.x, top.z)!;
    const yFoot = rawHeight(pts[0]!.x, pts[0]!.z);
    if (y - rawHeight(top.x, top.z) <= DECK_DEPTH || y <= yFoot) continue;
    const bands = pts.slice(0, k).map((p, i) => runBand(p, pts[i + 1]!, pts[i - 1], pts[i + 2], i + 1 < k ? 0 : FLIGHT_HALF));
    // The grade is even over the runs between the landings.
    const climb = bands.map((band, i) => Math.max(0, Math.hypot(pts[i + 1]!.x - pts[i]!.x, pts[i + 1]!.z - pts[i]!.z) - band.landA - band.landB));
    const total = climb.reduce((a, c) => a + c, 0) || 1;
    let yA = yFoot;
    bands.forEach((band, i) => {
      const yB = yA + ((y - yFoot) * climb[i]!) / total;
      out.push(runDeck(pts[i]!, pts[i + 1]!, yA, yB, band));
      yA = yB;
    });
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
