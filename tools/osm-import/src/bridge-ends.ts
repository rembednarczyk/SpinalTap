/**
 * A bridge's way to its abutment (G-344): a deck is level from end to end at the terrain's height
 * at its two ends, so an end node mapped short of the abutment, out over the bank under the
 * bridge, tilts the whole deck. The carriageway of Mełgiewska's south bridge (w50733068) ends 8 m
 * short of its west abutment, where the NMT (bare earth, the bridge left out) is 2.4 m below the
 * road: the carriageway fell 2.4 m along the bridge while its sidewalk beside it stayed level.
 * The bridge's outline (`man_made=bridge`) shows where the structure ends.
 *
 * Nor does a deck end down a bank (G-739): the footbridge of Podzamcze over the Czechówka
 * (w295849307) is level with the sidewalks either side, but its way's west end lies 1.4 m down
 * the ditch's bank, inside the outline too (OSM's outlines are good to a metre), and the game's
 * terrain, smoothed on its grid, spreads the bank over 3 m more: the deck fell 2.7 m to that end,
 * 15° where the bridge is level. An end down a bank goes on up it, on the game's terrain the deck
 * is laid on, to the bank's top: the deck's height there is the street's it goes on to.
 */
import { segmentDistance } from "../../../packages/core/src/math/geometry2d.ts";
import { type Area, type Line } from "./features.ts";
import { type Pt, pointInRing } from "./geometry.ts";

/** An end closer than this to the outline's edge lies at the abutment already (m). */
const AT_EDGE = 0.5;
/** The furthest an end is carried on to the abutment (m): further, the outline is not this way's bridge. */
const MAX_REACH = 15;
/** How far on past an end the terrain is read for a bank (m), and at what step: as the scan's `bridge-end-in-slope`. */
const BANK_LOOK = 2.5;
const BANK_STEP = 0.25;
/** An end the terrain rises more than this past (m) within `BANK_LOOK` lies down a bank. */
const IN_SLOPE = 0.5;
/**
 * The bank's top: the terrain past it rises no more than this within `BANK_LOOK` (m), 14 %, more
 * than a street leading onto a bridge climbs. Lower, the end goes on past the bank's top onto the
 * street's cross-fall, and the terrain there comes up through the deck's end (`ground-over-deck`).
 */
const AT_TOP = 0.35;
/** The furthest an end is carried up a bank (m): further, the terrain rises on as a slope, not a bank. */
const BANK_REACH = 8;

/** The terrain's rise within `BANK_LOOK` on past `p` along `d`. */
const riseOn = (p: Pt, d: Pt, terrain: (p: Pt) => number): number => {
  const y = terrain(p);
  let top = y;
  for (let s = BANK_STEP; s <= BANK_LOOK + 1e-9; s += BANK_STEP) top = Math.max(top, terrain({ x: p.x + d.x * s, z: p.z + d.z * s }));
  return top - y;
};

/** `end`, going on along `d`, carried up the bank it lies down to the bank's top; `end` itself off a bank or with no top within reach. */
const upBank = (end: Pt, d: Pt, terrain: (p: Pt) => number): Pt => {
  if (riseOn(end, d, terrain) <= IN_SLOPE) return end;
  for (let s = BANK_STEP; s <= BANK_REACH + 1e-9; s += BANK_STEP) {
    const p = { x: end.x + d.x * s, z: end.z + d.z * s };
    if (riseOn(p, d, terrain) <= AT_TOP) return p;
  }
  return end;
};

/** How far from `p` along the unit direction `d` the ray first crosses the ring's edge, or null. */
const rayToEdge = (p: Pt, d: Pt, ring: readonly Pt[]): number | null => {
  let best: number | null = null;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const ex = b.x - a.x;
    const ez = b.z - a.z;
    const den = d.x * ez - d.z * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a.x - p.x) * ez - (a.z - p.z) * ex) / den;
    const u = ((a.x - p.x) * d.z - (a.z - p.z) * d.x) / den;
    if (t >= 0 && u >= 0 && u <= 1 && (best === null || t < best)) best = t;
  }
  return best;
};

const edgeDistance = (p: Pt, ring: readonly Pt[]): number => {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    best = Math.min(best, segmentDistance(p.x, p.z, a.x, a.z, b.x, b.z));
  }
  return best;
};

/**
 * The map's lines with each bridge way that ends inside a bridge's outline carried on straight to
 * the outline's edge, its abutment. Not an end another bridge way goes on from: a bridge mapped in
 * several ways is one deck on through that node. Given `terrain`, the game's terrain at a point,
 * an end down a bank goes on up it to its top (G-739).
 */
export const toAbutments = (lines: readonly Line[], areas: readonly Area[], terrain?: (p: Pt) => number): Line[] => {
  const outlines = areas.filter((a) => a.tags.man_made === "bridge").map((a) => a.ring);
  const isBridge = (l: Line) => l.tags.bridge !== undefined && l.tags.bridge !== "no";
  const ends = new Map<string, number>();
  const key = (p: Pt) => `${p.x},${p.z}`;
  for (const l of lines) if (isBridge(l) && l.line.length >= 2) for (const p of [l.line[0]!, l.line[l.line.length - 1]!]) ends.set(key(p), (ends.get(key(p)) ?? 0) + 1);
  const carry = (end: Pt, before: Pt): Pt => {
    if ((ends.get(key(end)) ?? 0) > 1) return end;
    const len = Math.hypot(end.x - before.x, end.z - before.z);
    if (len === 0) return end;
    const d = { x: (end.x - before.x) / len, z: (end.z - before.z) / len };
    const atEdge = (): Pt => {
      for (const ring of outlines) {
        if (!pointInRing(end, ring) || edgeDistance(end, ring) < AT_EDGE) continue;
        const t = rayToEdge(end, d, ring);
        if (t !== null && t <= MAX_REACH) return { x: end.x + d.x * t, z: end.z + d.z * t };
      }
      return end;
    };
    return terrain ? upBank(atEdge(), d, terrain) : atEdge();
  };
  return lines.map((l) => {
    if (!isBridge(l) || l.line.length < 2) return l;
    const n = l.line.length;
    const first = carry(l.line[0]!, l.line[1]!);
    const last = carry(l.line[n - 1]!, l.line[n - 2]!);
    return first === l.line[0] && last === l.line[n - 1] ? l : { ...l, line: [first, ...l.line.slice(1, n - 1), last] };
  });
};
