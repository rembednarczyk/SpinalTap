import type { GroundPoint } from "@seki/core";
import { type GroundDeck, deckAt, makeDeck } from "../../world/deck";
import { type Ramp, mapHeight } from "./shape";
import type { LublinChunkData } from "./types";

/**
 * The terrain at the bridges' abutments (G-349). A deck is level across its axis at the NMT's
 * height on its axis's end, while the NMT along the end's edge may fall across the street: on
 * the 2.5 m grid the bank under the bridge reaches into the street before it. At the west end of
 * Mełgiewska's south bridge the terrain along the 13 m edge fell 0.4 m below the deck, a step the
 * walker coming off Andersa stopped at. The grid's points round an abutment, the cells either
 * side of its edge, are level with the deck across its whole end and a cell past its sides, as
 * the road leading onto a bridge is: the terrain at the edge is the deck's, bilinear between them.
 * No blend: a blend of a cell or two raised a mound beside the end with flanks about as steep as
 * a walker climbs, which the AI's way took and the feet stopped on (G-068's way under Mełgiewska).
 */

/** How far under the deck the terrain is levelled from its end (m): a cell of the 2.5 m grid on the skew. */
const INTO = 3.6;
/** How far before the end it is level (m): a cell. */
const OUT = 2.5;
/** How far past the deck's sides it is level too (m): a cell, so the corners of the end have the deck's height. */
const SIDE = 2.5;
/** How far past an end another deck is looked for: there the bridge goes on, and so does its deck (m). */
const PAST = 0.5;
/**
 * A shorter deck is left as the map has it (m): its two ends' levelling would fill what it spans,
 * a ditch the grid barely holds (the footbridge of podzamcze-2-0, 8 m).
 */
const MIN_SPAN = 4 * INTO;

type Segment = readonly [GroundPoint, GroundPoint];

const segmentDistance = (p: GroundPoint, a: GroundPoint, b: GroundPoint): number => {
  const [dx, dz] = [b.x - a.x, b.z - a.z];
  const k = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(a.x + dx * k - p.x, a.z + dz * k - p.z);
};

/** The ends of a deck (its axis, from `a` and from `b`) that lie on a bank falling under the bridge, as abutments' ramps. */
const endRamps = (d: GroundDeck, decks: readonly GroundDeck[], flights: readonly Segment[], height: (x: number, z: number) => number): Ramp[] => {
  const len = Math.hypot(d.b.x - d.a.x, d.b.z - d.a.z);
  if (len < MIN_SPAN) return [];
  const u = { x: (d.b.x - d.a.x) / len, z: (d.b.z - d.a.z) / len };
  const n = { x: -u.z, z: u.x };
  const across = d.ring.map((p) => (p.x - d.a.x) * n.x + (p.z - d.a.z) * n.z);
  const [lo, hi] = [Math.min(...across), Math.max(...across)];
  const mid = (lo + hi) / 2;
  // Not a bridge with a flight of steps hung off it (the viaduct of Zamkowa): its ground there is
  // the flight's (G-255, G-274), and the AI's ways over and under it keep to its abutments' walls.
  const reach = (hi - lo) / 2 + SIDE + INTO;
  if (flights.some(([p, q]) => segmentDistance(p, d.a, d.b) < reach || segmentDistance(q, d.a, d.b) < reach)) return [];
  const out: Ramp[] = [];
  for (const [end, y, sign] of [[d.a, d.ya, -1], [d.b, d.yb, 1]] as const) {
    const c = { x: end.x + n.x * mid, z: end.z + n.z * mid };
    const at = (t: number) => ({ x: c.x + u.x * sign * t, z: c.z + u.z * sign * t });
    const [past, under] = [at(PAST), at(-INTO)];
    // Not where the bridge goes on in another deck, nor where the ground rises under the deck: it is cut into a bank there.
    if (deckAt(decks, past.x, past.z) !== null || height(under.x, under.z) > y) continue;
    out.push({ a: under, b: at(OUT), ya: y, yb: y, width: hi - lo + 2 * SIDE, blend: 0, square: true });
  }
  return out;
};

/** The level ground before the bridges' free ends (`endRamps`), lowest first: where two meet, the higher holds. */
export const abutmentRamps = (chunks: readonly LublinChunkData[]): Ramp[] => {
  const height = (x: number, z: number) => mapHeight(chunks, x, z);
  const seen = new Set<string>();
  const decks: GroundDeck[] = [];
  const flights: Segment[] = [];
  for (const c of chunks) {
    for (const f of c.flights ?? []) for (let i = 0; i + 3 < f.line.length; i += 2) flights.push([{ x: f.line[i]!, z: f.line[i + 1]! }, { x: f.line[i + 2]!, z: f.line[i + 3]! }]);
    for (const g of c.ground) {
      if (!g.deck) continue;
      const key = g.outline.join(",");
      if (seen.has(key)) continue;
      seen.add(key);
      decks.push(makeDeck(g.outline, g.deck, height));
    }
  }
  return decks.flatMap((d) => endRamps(d, decks, flights, height)).sort((p, q) => p.ya - q.ya);
};
