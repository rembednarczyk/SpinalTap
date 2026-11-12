import { type GroundPoint, segmentDistance } from "@seki/core";
import { DECK_DEPTH, type GroundDeck, deckAt, makeDeck } from "../../world/deck";
import { FLIGHT_CELL, type Ramp, mapHeight } from "./shape";
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
  if (flights.some(([p, q]) => segmentDistance(p.x, p.z, d.a.x, d.a.z, d.b.x, d.b.z) < reach || segmentDistance(q.x, q.z, d.a.x, d.a.z, d.b.x, d.b.z) < reach)) return [];
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

/** The decks of the map's bridges, each once, on the terrain's height at their axes' ends. */
const mapDecks = (chunks: readonly LublinChunkData[], height: (x: number, z: number) => number): GroundDeck[] => {
  const seen = new Set<string>();
  const decks: GroundDeck[] = [];
  for (const c of chunks) {
    for (const g of c.ground) {
      if (!g.deck) continue;
      const key = g.outline.join(",");
      if (seen.has(key)) continue;
      seen.add(key);
      decks.push(makeDeck(g.outline, g.deck, height));
    }
  }
  return decks;
};

/** The level ground before the bridges' free ends (`endRamps`), lowest first: where two meet, the higher holds. */
export const abutmentRamps = (chunks: readonly LublinChunkData[]): Ramp[] => {
  const height = (x: number, z: number) => mapHeight(chunks, x, z);
  const flights: Segment[] = [];
  for (const c of chunks) for (const f of c.flights ?? []) for (let i = 0; i + 3 < f.line.length; i += 2) flights.push([{ x: f.line[i]!, z: f.line[i + 1]! }, { x: f.line[i + 2]!, z: f.line[i + 3]! }]);
  const decks = mapDecks(chunks, height);
  return decks.flatMap((d) => endRamps(d, decks, flights, height)).sort((p, q) => p.ya - q.ya);
};

/** How close the crossing of a flight's axis onto a deck is found (m). */
const CROSSING = 0.01;

/** Where along the run from `p` to `q`, from 0 to 1, its axis first gets onto one of `decks`. */
const onto = (decks: readonly GroundDeck[], p: GroundPoint, q: GroundPoint): number => {
  let [lo, hi] = [0, 1];
  while ((hi - lo) * Math.hypot(q.x - p.x, q.z - p.z) > CROSSING) {
    const t = (lo + hi) / 2;
    if (deckAt(decks, p.x + (q.x - p.x) * t, p.z + (q.z - p.z) * t) === null) lo = t;
    else hi = t;
  }
  return hi;
};

/**
 * Ramps up a flight of steps that climbs from the terrain onto a bridge's deck by its end
 * (G-686): w294098693 onto the south-west corner of the viaduct of Zamkowa. The deck is level
 * across its axis at the NMT's height on the axis's end, while the NMT along the end falls towards
 * that corner, so the band met the deck 0.5 m under it, a wall across its whole width the feet
 * stopped at. Its last two runs get an even grade from the terrain at their foot up to the deck's
 * height half the band's width before the deck's edge, level with the deck from there to the
 * top: the terrain is bilinear on its grid, so it meets the deck's edge only where it is level
 * before it (as at G-349's abutments), and the top run alone would climb steeper than a walker
 * does (ADR-0043). Two cells either side of the band the terrain is filled up to the ramp, never
 * cut: else the cells by the band's edges sag under it, and the street beside the top run, higher,
 * stays as it is. Not a flight hung off a deck far over the terrain (G-255): that one is a deck of
 * its own (`decks.ts`).
 */
export const flightTopRamps = (chunks: readonly LublinChunkData[], width = 3): Ramp[] => {
  const height = (x: number, z: number) => mapHeight(chunks, x, z);
  const decks = mapDecks(chunks, height);
  const seen = new Set<string>();
  const out: Ramp[] = [];
  for (const f of chunks.flatMap((c) => c.flights ?? [])) {
    if (seen.has(f.id)) continue;
    seen.add(f.id);
    const pts: GroundPoint[] = [];
    for (let i = 0; i + 1 < f.line.length; i += 2) pts.push({ x: f.line[i]!, z: f.line[i + 1]! });
    let k = pts.length;
    while (k > 0 && deckAt(decks, pts[k - 1]!.x, pts[k - 1]!.z) !== null) k--;
    if (k === 0 || k === pts.length) continue;
    const top = pts[pts.length - 1]!;
    if (deckAt(decks, top.x, top.z)! - height(top.x, top.z) > DECK_DEPTH) continue;
    const [p, q] = [pts[k - 1]!, pts[k]!];
    const t = onto(decks, p, q);
    const y = deckAt(decks, p.x + (q.x - p.x) * t, p.z + (q.z - p.z) * t)!;
    if (y <= height(p.x + (q.x - p.x) * t, p.z + (q.z - p.z) * t)) continue;
    // Level from half the band's width before the deck's edge, where the axis gets onto it.
    const len = Math.hypot(q.x - p.x, q.z - p.z);
    const u = Math.max(0, t - width / 2 / len);
    const level = { x: p.x + (q.x - p.x) * u, z: p.z + (q.z - p.z) * u };
    // The grade from the foot of the run below the top one, if there is one.
    const run = [...pts.slice(Math.max(0, k - 2), k), level];
    const along = run.map((_, i) => run.slice(1, i + 1).reduce((l, r, j) => l + Math.hypot(r.x - run[j]!.x, r.z - run[j]!.z), 0));
    const y0 = height(run[0]!.x, run[0]!.z);
    if (along[along.length - 1]! <= 0) continue;
    const at = (i: number) => y0 + ((y - y0) * along[i]!) / along[along.length - 1]!;
    const grade = run.slice(1).map((b, i) => ({ a: run[i]!, b, ya: at(i), yb: at(i + 1) }));
    const landing = [[level, q], ...pts.slice(k, -1).map((r, i) => [r, pts[k + i + 1]!] as const)].map(([a, b]) => ({ a, b, ya: y, yb: y }));
    for (const r of [...grade, ...landing]) out.push({ ...r, width: width + 2 * FLIGHT_CELL, blend: 0, square: true, fill: true });
    // Round at the bend below the top run, square elsewhere: else the ends reach over the runs before and after.
    out.push({ ...grade[grade.length - 1]!, width, blend: 0 });
    for (const r of [...landing, ...grade.slice(0, -1)]) out.push({ ...r, width, blend: 0, square: true });
  }
  return out;
};
