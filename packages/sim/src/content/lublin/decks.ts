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

/** One end of a run at a bend: the run's landing there, and the corners of the band on the bend's inner side. */
interface BendEnd {
  /** How far along the run the landing reaches: as far as the bisector across the band. */
  readonly land: number;
  /** On the bisector, the band's edge, and the margin's corner there. */
  readonly onBand: GroundPoint;
  readonly onMargin: GroundPoint;
  /** The margin's edge level with the landing's end. */
  readonly cut: GroundPoint;
}

/** The band of a flight's run from `a` up to `b` (its ring), and its ends at the bends. */
interface RunBand {
  readonly ring: readonly GroundPoint[];
  readonly endA: BendEnd | null;
  readonly endB: BendEnd | null;
}

/**
 * The band of a flight's run from `a` up to `b`. At a bend, to `before` below `a` or `after`
 * past `b`, the band ends on the bisector, so each run keeps its own band where two overlap; on
 * the bend's inner side the margin past the band stops level with the landing's end, the rest
 * of the corner being the bend's landing (`bendLanding`). At the deck the band goes on square
 * `past` m beyond `b`, level there, over both corners of the turn onto the deck's run (else a
 * hole to the terrain 3.5 m down between the two bands).
 */
const runBand = (a: GroundPoint, b: GroundPoint, before?: GroundPoint, after?: GroundPoint, past = 0): RunBand => {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const u = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
  const n = { x: -u.z, z: u.x };
  // Along the run, where the band's edge `s` m off the axis meets the bisector `m`.
  const along = (s: number, m: GroundPoint) => (Math.abs(cross(u, m)) > 1e-6 ? (-s * cross(n, m)) / cross(u, m) : 0);
  const at = (p: GroundPoint, s: number, t: number) => ({ x: p.x + n.x * s + u.x * t, z: p.z + n.z * s + u.z * t });
  // `into` is +1 at `a` (the run goes on along u) and -1 at `b`.
  const bend = (p: GroundPoint, m: GroundPoint | null, into: number): { readonly end: BendEnd | null; readonly corners: (side: number) => GroundPoint[] } => {
    if (!m) return { end: null, corners: (s) => [at(p, s * FLIGHT_HALF, into < 0 ? past : 0)] };
    const inner = along(BAND_HALF, m) * into > 0 ? 1 : -1;
    const land = Math.abs(along(BAND_HALF, m));
    const end = { land, onBand: at(p, inner * BAND_HALF, along(inner * BAND_HALF, m)), onMargin: at(p, inner * FLIGHT_HALF, along(inner * FLIGHT_HALF, m)), cut: at(p, inner * FLIGHT_HALF, into * land) };
    return { end, corners: (s) => (s === inner ? [end.onBand, end.cut] : [at(p, s * FLIGHT_HALF, along(s * FLIGHT_HALF, m))]) };
  };
  const ea = bend(a, bisector(a, u, before), 1);
  const eb = bend(b, past > 0 ? null : bisector(b, { x: -u.x, z: -u.z }, after), -1);
  // Around the band: up its left edge from `a` to `b`, back down its right edge.
  const ring = [...ea.corners(-1), ...eb.corners(-1).reverse(), ...eb.corners(1), ...ea.corners(1).reverse()];
  // At the deck the landing reaches as far as the bisector of the turn onto it, past the band.
  const top = past > 0 && after ? bend(b, bisector(b, { x: -u.x, z: -u.z }, after), -1).end : null;
  return { ring, endA: ea.end, endB: eb.end ?? top };
};

const boxOf = (ring: readonly GroundPoint[]): GroundDeck["box"] => {
  const xs = ring.map((p) => p.x);
  const zs = ring.map((p) => p.z);
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
};

/**
 * A flight's run as a deck on its band, from `ya` at `a` to `yb` at `b`, level on its landings:
 * a deck is level across its axis, so two runs meet on the bisector of a bend at one height only
 * on a landing there, as stairs have (else a 0.4 m wall across the bend).
 */
const runDeck = (a: GroundPoint, b: GroundPoint, ya: number, yb: number, band: RunBand): GroundDeck => {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const u = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
  const [la, lb] = [band.endA?.land ?? 0, band.endB?.land ?? 0];
  return { ring: band.ring, a: { x: a.x + u.x * la, z: a.z + u.z * la }, b: { x: b.x - u.x * lb, z: b.z - u.z * lb }, ya, yb, box: boxOf(band.ring), flight: true };
};

/**
 * The landing of a bend at `p` (height `y`) on its inner side past the band: the corner between
 * the two runs' margins, level with both runs' landings, which their own bands leave out (the
 * margin of each run reaches there beyond its landing, 0.6 m higher or lower than the other's).
 */
const bendLanding = (p: GroundPoint, y: number, below: BendEnd, above: BendEnd): GroundDeck => {
  const ring = [below.cut, below.onMargin, above.cut, below.onBand];
  return { ring, a: p, b: p, ya: y, yb: y, box: boxOf(ring), flight: true };
};

/**
 * The flights of steps hung off a bridge's deck (G-255): a flight of the map whose top lies on a
 * deck more than `DECK_DEPTH` over the terrain where the flight leaves it, so the flight's treads
 * on the terrain would drop off the deck's edge. The steps from the viaduct of Zamkowa run down
 * beside it over the NMT interpolated under the deck: 3.2 m under the deck where they leave it,
 * 1.4 m lower than at the bend below. The flight from its foot up to where it leaves the deck is
 * a deck of its own, run by run with landings at the bends, at an even grade from the terrain at
 * the foot (where the ground across the band is within a step of it) up to the deck's height; its
 * runs on the deck stay on it. Not a ramp of the terrain: on its 2.5 m grid a band 3 m wide
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
    const top = pts[k]!;
    const y = deckAt(bridges, top.x, top.z)!;
    const yFoot = rawHeight(pts[0]!.x, pts[0]!.z);
    if (y - rawHeight(top.x, top.z) <= DECK_DEPTH || y <= yFoot) continue;
    const bands = pts.slice(0, k).map((p, i) => runBand(p, pts[i + 1]!, pts[i - 1], pts[i + 2], i + 1 < k ? 0 : FLIGHT_HALF));
    // The grade is even over the runs between the landings.
    const climb = bands.map((band, i) => Math.max(0, Math.hypot(pts[i + 1]!.x - pts[i]!.x, pts[i + 1]!.z - pts[i]!.z) - (band.endA?.land ?? 0) - (band.endB?.land ?? 0)));
    const total = climb.reduce((a, c) => a + c, 0) || 1;
    let yA = yFoot;
    bands.forEach((band, i) => {
      const yB = yA + ((y - yFoot) * climb[i]!) / total;
      out.push(runDeck(pts[i]!, pts[i + 1]!, yA, yB, band));
      const next = bands[i + 1];
      if (band.endB && next?.endA) out.push(bendLanding(pts[i + 1]!, yB, band.endB, next.endA));
      yA = yB;
    });
  }
  return out;
})();

const touches = (a: GroundDeck["box"], b: GroundDeck["box"]): boolean => a.minX <= b.maxX && b.minX <= a.maxX && a.minZ <= b.maxZ && b.minZ <= a.maxZ;

/**
 * The bridges' decks of the map (ADR-0053), by chunk: each piece of a road or path the map has
 * on a bridge, level from abutment to abutment at the terrain's height there, over the valley.
 * Over a flight down beside it that its outline reaches over, the deck stays the ground, higher
 * than the flight: it is drawn there, so the walk along its edge goes on (G-274).
 */
export const BRIDGE_DECKS: ReadonlyMap<string, readonly GroundDeck[]> = MAP_DECKS;

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

/** The flight hung off a bridge (G-255) whose band holds (x, z) off the bridges' decks (G-274), or null. */
export const flightDeckAt = (x: number, z: number): GroundDeck | null => (deckAt(ALL_DECKS, x, z) === null ? (FLIGHT_DECKS.find((f) => deckAt([f], x, z) !== null) ?? null) : null);
