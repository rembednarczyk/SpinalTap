import { type GroundPoint, type TerrainGrid, segmentDistance } from "@seki/core";
import { DECK_DEPTH, type GroundDeck, deckAt, deckHeight, makeDeck } from "../../world/deck";
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

/** The ends of a deck (its piece's, along its axis from `a` and `b`) that lie on a bank falling under the bridge, as abutments' ramps. */
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
  // A piece's own ends, not its axis's: a bridge's sidewalk lies on its carriageway's axis (G-737)
  // and ends up to 3.5 m before or past it, its end on the deck's height in that cross section.
  const along = d.ring.map((p) => (p.x - d.a.x) * u.x + (p.z - d.a.z) * u.z);
  const out: Ramp[] = [];
  for (const [s, sign] of [[Math.min(...along), -1], [Math.max(...along), 1]] as const) {
    const end = { x: d.a.x + u.x * s, z: d.a.z + u.z * s };
    const y = deckHeight(d, end.x, end.z);
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

/** How far under a deck's edge the ground is kept (m): else it shows through the deck's paving (G-686, G-736). */
const UNDER = 0.05;
/** How much more per metre in from the edge (m/m). */
const FALL = 0.1;

/**
 * The highest a flight's top ramps and `underDecks` leave the ground at (x, z): under a deck,
 * `UNDER` beneath it at its edge and falling in from there; off one, no bound. Not level `UNDER`
 * beneath it: the terrain is bilinear on its grid, so between a point under the deck and the
 * street off its corner, higher than the deck (Zamkowa by w294098693), it still came through the
 * deck's paving.
 */
const underDeck = (decks: readonly GroundDeck[], x: number, z: number): number => {
  const y = deckAt(decks, x, z);
  if (y === null) return Infinity;
  let depth = Infinity;
  for (const d of decks) {
    for (let i = 0; i < d.ring.length; i++) {
      const [a, b] = [d.ring[i]!, d.ring[(i + 1) % d.ring.length]!];
      depth = Math.min(depth, segmentDistance(x, z, a.x, a.z, b.x, b.z));
    }
  }
  return y - UNDER - FALL * depth;
};

/** How finely a cell of a grid is read for the terrain over a deck (pieces a side): 0.25 m on a 2.5 m grid, as the glitch scan does. */
const READ = 10;
/** How much a point under a deck is lowered at a time (m). */
const DROP = 0.01;
/**
 * The most the ground off the decks by their edges is lowered with the points under them below
 * the deck, or below where it was if lower (m): the glitch scan's centimetre of the paving's lift.
 * Lower, the deck's fascia shows along its end as a step, and the walker stops at one of 0.15 m.
 */
const OFF_DROP = 0.01;

/** A cell of a grid by a deck: the deck's height at its samples (null off it), and its corners under a deck as world keys. */
interface DeckCell {
  readonly g: TerrainGrid;
  readonly at: readonly number[];
  readonly decks: readonly (number | null)[];
  /** The highest of them. */
  readonly top: number;
  readonly corners: readonly (string | null)[];
}

/** The cells of `g` with a corner under one of `decks`. */
const deckCells = (g: TerrainGrid, decks: readonly GroundDeck[]): DeckCell[] => {
  const out = new Map<number, DeckCell>();
  for (const d of decks) {
    // A cell before the box's side has its corner in it.
    const [i0, i1] = [Math.max(0, Math.floor((d.box.minX - g.originX) / g.cell) - 1), Math.min(g.cols - 2, Math.floor((d.box.maxX - g.originX) / g.cell))];
    const [j0, j1] = [Math.max(0, Math.floor((d.box.minZ - g.originZ) / g.cell) - 1), Math.min(g.rows - 2, Math.floor((d.box.maxZ - g.originZ) / g.cell))];
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        if (out.has(j * g.cols + i)) continue;
        const at = [j * g.cols + i, j * g.cols + i + 1, (j + 1) * g.cols + i, (j + 1) * g.cols + i + 1];
        const corners = at.map((k) => {
          const [x, z] = [g.originX + (k % g.cols) * g.cell, g.originZ + Math.floor(k / g.cols) * g.cell];
          return deckAt(decks, x, z) === null ? null : `${x},${z}`;
        });
        if (corners.every((c) => c === null)) continue;
        const samples: (number | null)[] = [];
        for (let a = 0; a <= READ; a++) for (let b = 0; b <= READ; b++) samples.push(deckAt(decks, g.originX + (i + a / READ) * g.cell, g.originZ + (j + b / READ) * g.cell));
        out.set(j * g.cols + i, { g, at, decks: samples, top: Math.max(...samples.filter((y) => y !== null)), corners });
      }
    }
  }
  return [...out.values()];
};

/**
 * Over a cell, its corners lowered by `drop`: does the terrain lie anywhere over the deck (`over`),
 * and how much lower than it was, or than the deck where it was over it, does it lie anywhere off
 * the decks (`off`)? Bilinear, as `terrainHeightAt`.
 */
const readCell = (c: DeckCell, drop: ReadonlyMap<string, number>): { over: boolean; off: number } => {
  const h = c.at.map((k) => c.g.heights[k]!);
  const d = c.corners.map((key) => drop.get(key ?? "") ?? 0);
  const at = (v: readonly number[], tx: number, tz: number) => (v[0]! * (1 - tx) + v[1]! * tx) * (1 - tz) + (v[2]! * (1 - tx) + v[3]! * tx) * tz;
  let [over, off] = [false, 0];
  for (let a = 0; a <= READ; a++) {
    for (let b = 0; b <= READ; b++) {
      const y = c.decks[a * (READ + 1) + b];
      const [tx, tz] = [a / READ, b / READ];
      if (y === null || y === undefined) off = Math.max(off, at(d, tx, tz) - Math.max(0, at(h, tx, tz) - c.top));
      else if (at(h, tx, tz) - at(d, tx, tz) > y) over = true;
    }
  }
  return { over, off };
};

/** How far each corner under a deck of `cells` may be lowered: down to `underDeck`, by world key. */
const deepest = (cells: readonly DeckCell[], decks: readonly GroundDeck[]): Map<string, number> => {
  const most = new Map<string, number>();
  for (const c of cells) {
    c.corners.forEach((key, n) => {
      if (key === null || most.has(key)) return;
      const [x, z] = key.split(",").map(Number) as [number, number];
      most.set(key, Math.max(0, c.g.heights[c.at[n]!]! - underDeck(decks, x, z)));
    });
  }
  return most;
};

/** How much each point under the decks is lowered (`underDecks`), by world key. */
const deckDrops = (cells: readonly DeckCell[], decks: readonly GroundDeck[]): Map<string, number> => {
  const most = deepest(cells, decks);
  const around = new Map<string, DeckCell[]>();
  for (const c of cells) for (const key of c.corners) if (key !== null) around.set(key, [...(around.get(key) ?? []), c]);
  const drop = new Map<string, number>();
  let over = cells.filter((c) => readCell(c, drop).over);
  while (over.length > 0) {
    let lowered = false;
    for (const c of over) {
      for (const key of c.corners) {
        if (key === null) continue;
        const was = drop.get(key) ?? 0;
        const d = Math.min(most.get(key)!, was + DROP);
        if (d <= was) continue;
        drop.set(key, d);
        if (around.get(key)!.some((n) => readCell(n, drop).off > OFF_DROP)) [drop, most].forEach((m) => m.set(key, was));
        else lowered = true;
      }
    }
    if (!lowered) break;
    over = over.filter((c) => readCell(c, drop).over);
  }
  return drop;
};

/**
 * The shaped grids of the map's chunks with the terrain kept under every bridge's deck (G-736):
 * in a cell where it lies anywhere over a deck, its corners under the decks are lowered a
 * centimetre at a time until it lies under it, down to `underDeck` at most. The terrain off a deck
 * by its edge is bilinear with these points: it may come down to the deck, not `OFF_DROP` below
 * it. Lowered to `underDeck` at once, it fell 0.19 m before Mełgiewska's west end by its sidewalk
 * (0.16 m under the carriageway there), a step the walker stopped at, and up to 0.1 m with the
 * fascia showing along the ends. So the terrain stays over a deck where it is level with the
 * ground before an end lower than it, or before a deck falling steeply from its end: Zamkowa's
 * deck over the footway's tunnel (G-088) by its north-east end, Mełgiewska's sidewalk by Andersa
 * 0.16 m under its carriageway. Where the terrain lies under the deck it is kept, else a road
 * drawn on to the deck lies a millimetre off its plane (G-320). By world point over all the
 * chunks: a point two of them share is lowered in both.
 */
export const underDecks = (chunks: readonly LublinChunkData[], grids: ReadonlyMap<string, TerrainGrid>): Map<string, TerrainGrid> => {
  const decks = mapDecks(chunks, (x, z) => mapHeight(chunks, x, z));
  const drop = deckDrops([...grids.values()].flatMap((g) => deckCells(g, decks)), decks);
  return new Map(
    [...grids].map(([id, g]) => {
      const heights = g.heights.map((h, k) => h - (drop.get(`${g.originX + (k % g.cols) * g.cell},${g.originZ + Math.floor(k / g.cols) * g.cell}`) ?? 0));
      return [id, { ...g, heights }];
    }),
  );
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
 * stays as it is. Under the deck itself they keep the ground beneath it (`underDeck`). Not a flight hung off a deck far over the terrain (G-255): that one is a deck of
 * its own (`decks.ts`).
 */
export const flightTopRamps = (chunks: readonly LublinChunkData[], width = 3): Ramp[] => {
  const height = (x: number, z: number) => mapHeight(chunks, x, z);
  const decks = mapDecks(chunks, height);
  const ceiling = (x: number, z: number) => underDeck(decks, x, z);
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
    for (const r of [...grade, ...landing]) out.push({ ...r, width: width + 2 * FLIGHT_CELL, blend: 0, square: true, fill: true, ceiling });
    // Round at the bend below the top run, square elsewhere: else the ends reach over the runs before and after.
    out.push({ ...grade[grade.length - 1]!, width, blend: 0, ceiling });
    for (const r of [...landing, ...grade.slice(0, -1)]) out.push({ ...r, width, blend: 0, square: true, ceiling });
  }
  return out;
};
