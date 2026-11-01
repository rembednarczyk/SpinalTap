import { type P2, pointInRing } from "./polygon";
import { BYSTRZYCA, PROTECTED_AREAS } from "./skyline-protected";

/**
 * Where a megablock may not stand (ADR-0067, the topography curator's review): the generator of
 * the layout keeps to these rules and the test counts what breaks them. A tower is a disc of its
 * reach round its foot: 0.2 of its height for a megatower body, 0.13 for the far ring's tiers.
 */

export const BODY_REACH = 0.2;
export const TIERS_REACH = 0.13;

/** Metres between a tower's reach and a protected area's outline, and the Bystrzyca's axis. */
export const AREA_GAP = 30;
export const RIVER_GAP = 100;
/** Bridges in a view window only above this height. */
export const WINDOW_BRIDGE_Y = 250;

export interface Disc {
  readonly x: number;
  readonly z: number;
  readonly r: number;
}

const pairs = (flat: readonly number[]): P2[] => {
  const out: P2[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push({ x: flat[i]!, z: flat[i + 1]! });
  return out;
};

const AREAS = PROTECTED_AREAS.map((a) => ({ name: a.name, ring: pairs(a.ring) }));
const RIVER = pairs(BYSTRZYCA);

const toSegment = (x: number, z: number, a: P2, b: P2): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l = dx * dx + dz * dz;
  const t = l === 0 ? 0 : Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l));
  return Math.hypot(x - a.x - t * dx, z - a.z - t * dz);
};

const toLine = (x: number, z: number, line: readonly P2[], closed: boolean): number => {
  let d = Infinity;
  const n = closed ? line.length : line.length - 1;
  for (let i = 0; i < n; i++) d = Math.min(d, toSegment(x, z, line[i]!, line[(i + 1) % line.length]!));
  return d;
};

/** The protected area a tower stands in or within `AREA_GAP` of, if any. */
export const areaHit = (t: Disc): string | null => {
  for (const a of AREAS) {
    if (pointInRing({ x: t.x, z: t.z }, a.ring) || toLine(t.x, t.z, a.ring, true) < t.r + AREA_GAP) return a.name;
  }
  return null;
};

/** Whether a tower comes within `RIVER_GAP` of the Bystrzyca's axis. */
export const riverHit = (t: Disc): boolean => toLine(t.x, t.z, RIVER, false) < t.r + RIVER_GAP;

/** Whether two towers' bodies run into each other. */
export const overlaps = (a: Disc, b: Disc): boolean => Math.hypot(a.x - b.x, a.z - b.z) < a.r + b.r;

/**
 * View axes kept open: from Plac Litewski (0, 0) to the Wieża Trynitarska and the cathedral, an
 * azimuth window (degrees from north, clockwise); from the Nabrzeże to the Stare Miasto and the
 * Zamek, a stretch of z between the game's main block of chunks and the Nabrzeże with no tower in it.
 */
export const LITEWSKI_WINDOW = { x: 0, z: 0, from: 101, to: 109 } as const;
export const NABRZEZE_GAP = { eastOf: 1120, westOf: 2300, fromZ: -60, toZ: 260 } as const;

const azimuth = (x: number, z: number): number => (((Math.atan2(x - LITEWSKI_WINDOW.x, z - LITEWSKI_WINDOW.z) * 180) / Math.PI) % 360 + 360) % 360;

/** Whether an azimuth span [lo, hi] (degrees, lo <= hi, no wrap) meets the Plac Litewski window. */
const meetsWindow = (lo: number, hi: number): boolean => hi > LITEWSKI_WINDOW.from && lo < LITEWSKI_WINDOW.to;

/** Whether a tower stands in a kept view: the Plac Litewski window or the Nabrzeże's gap. */
export const viewHit = (t: Disc): boolean => {
  const d = Math.hypot(t.x - LITEWSKI_WINDOW.x, t.z - LITEWSKI_WINDOW.z);
  const half = d > t.r ? (Math.asin(t.r / d) * 180) / Math.PI : 180;
  const az = azimuth(t.x, t.z);
  if (meetsWindow(az - half, az + half)) return true;
  return t.x + t.r > NABRZEZE_GAP.eastOf && t.x - t.r < NABRZEZE_GAP.westOf && t.z + t.r > NABRZEZE_GAP.fromZ && t.z - t.r < NABRZEZE_GAP.toZ;
};

/** Whether a bridge between two feet crosses the Plac Litewski window below `WINDOW_BRIDGE_Y`. */
export const bridgeViewHit = (a: P2, b: P2, y: number): boolean => {
  if (y > WINDOW_BRIDGE_Y) return false;
  const p = azimuth(a.x, a.z);
  let q = azimuth(b.x, b.z);
  if (q - p > 180) q -= 360;
  if (p - q > 180) q += 360;
  return meetsWindow(Math.min(p, q), Math.max(p, q));
};
