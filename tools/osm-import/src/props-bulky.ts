/**
 * Long pieces on and by a marketplace's outline (ADR-0058 stage 2): food carts and shipping
 * containers, set where their whole footprint and a walkway round it lie on open paved ground of the map,
 * off paths and car lanes and clear of the stalls and furniture placed before. The long side
 * runs along the outline's longer axis or across it, the front towards the more open side. No
 * randomness: candidates every metre, tried in the order of a hash of their position.
 */
import type { StreetPropKind } from "../../../packages/core/src/world/city-geo.ts";
import { furniturePrisms } from "../../../packages/sim/src/content/lublin/furniture.ts";
import { type Pt, pointInRing, ringBounds } from "./geometry.ts";
import type { Placed } from "./props-gen.ts";
import { longAxis } from "./props-market.ts";
import { fnv, yawOf } from "./props-place.ts";
import type { Site } from "./props-site.ts";
import { nearTraffic } from "./props-streets.ts";

/** How far outside the outline a piece's centre may stand (m): at the market's edge, on its pavement. */
const REACH = 6;

/** Distance from p to the outline's edge. */
const toRing = (p: Pt, ring: readonly Pt[]): number => {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const c = ring[(i + 1) % ring.length]!;
    const dx = c.x - a.x;
    const dz = c.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z));
  }
  return best;
};

/** The walkway kept round a piece (m) and the step of its footprint's samples. */
const WALKWAY = 1;
const STEP = 0.5;
/** How far the footprint keeps from a car street's axis (m). */
const TRAFFIC_REACH = 3.5;
/** Ground radius of what was placed before (m): a stall's canvas, the rest about a bench's half. */
const RADIUS: Partial<Record<StreetPropKind, number>> = { "market-stall": 1.6, "cafe-garden": 2.2, tree: 0.8, kiosk: 1.7, "bus-shelter": 2 };
const DEFAULT_RADIUS = 0.6;
const CELL = 8;

/** Half extents of a kind's solid in its own frame (x along its side, z to its front). */
const halfExtents = (prop: StreetPropKind): { hx: number; hz: number } => {
  let hx = 0;
  let hz = 0;
  for (const pr of furniturePrisms({ prop, x: 0, y: 0, z: 0, yaw: 0, variant: 0 }))
    for (const q of pr.points) {
      hx = Math.max(hx, Math.abs(q.x));
      hz = Math.max(hz, Math.abs(q.z));
    }
  return { hx, hz };
};

/** Pieces placed before, in a grid of 8 m cells, with their radii. */
const indexOf = (placed: readonly Placed[]): Map<string, { p: Pt; r: number }[]> => {
  const grid = new Map<string, { p: Pt; r: number }[]>();
  for (const x of placed) {
    const k = `${Math.floor(x.p.x / CELL)}:${Math.floor(x.p.z / CELL)}`;
    grid.set(k, [...(grid.get(k) ?? []), { p: x.p, r: RADIUS[x.prop] ?? DEFAULT_RADIUS }]);
  }
  return grid;
};

const near = (grid: Map<string, { p: Pt; r: number }[]>, q: Pt): boolean => {
  const cx = Math.floor(q.x / CELL);
  const cz = Math.floor(q.z / CELL);
  for (let i = cx - 1; i <= cx + 1; i++)
    for (let j = cz - 1; j <= cz + 1; j++) for (const o of grid.get(`${i}:${j}`) ?? []) if (Math.hypot(o.p.x - q.x, o.p.z - q.z) < o.r) return true;
  return false;
};

/** Points of a rectangle round p (half sides a along u, b along v), every STEP metres. */
const samples = (p: Pt, u: Pt, a: number, b: number): Pt[] => {
  const v = { x: -u.z, z: u.x };
  const out: Pt[] = [];
  for (let s = -a; s <= a + 1e-9; s += STEP) for (let t = -b; t <= b + 1e-9; t += STEP) out.push({ x: p.x + u.x * s + v.x * t, z: p.z + u.z * s + v.z * t });
  return out;
};

/** Kinds that may also stand on bare ground with no surface of the map (a yard, a vacant lot). */
const ON_BARE: ReadonlySet<StreetPropKind> = new Set(["container"]);

const openFor = (prop: StreetPropKind) => {
  const bare = ON_BARE.has(prop);
  return (site: Site, q: Pt): boolean => {
    if (site.chunkAt(q) === null || site.onPath(q)) return false;
    const s = site.surfaceAt(q);
    return s === "walk" || (bare && s === null);
  };
};

/** Up to `count` pieces of `prop` with their centres on the outline, clear of `placed`. */
export const bulkyPieces = (site: Site, ring: readonly Pt[], prop: StreetPropKind, count: number, seed: string, placed: readonly Placed[]): Placed[] => {
  const { hx, hz } = halfExtents(prop);
  const open = openFor(prop);
  const b = ringBounds(ring);
  const candidates: Pt[] = [];
  for (let x = Math.floor(b.minX - REACH) + 0.5; x < b.maxX + REACH; x++)
    for (let z = Math.floor(b.minZ - REACH) + 0.5; z < b.maxZ + REACH; z++) {
      const p = { x, z };
      if (open(site, p) && (pointInRing(p, ring) || toRing(p, ring) < REACH)) candidates.push(p);
    }
  if (candidates.length === 0) return [];
  candidates.sort((p, q) => fnv(`${seed}:${p.x}:${p.z}`) - fnv(`${seed}:${q.x}:${q.z}`) || p.x - q.x || p.z - q.z);
  const long = longAxis(candidates);
  const grid = indexOf(placed);
  const out: Placed[] = [];
  for (const p of candidates) {
    if (out.length >= count) break;
    for (const u of [long, { x: -long.z, z: long.x }]) {
      const foot = samples(p, u, hx + WALKWAY, hz + WALKWAY);
      if (!foot.every((q) => open(site, q) && !near(grid, q) && !nearTraffic(site, q, TRAFFIC_REACH))) continue;
      // The front (v) towards the side with more open ground a few metres out.
      const v = { x: -u.z, z: u.x };
      const ahead = (sign: number) => samples({ x: p.x + v.x * sign * (hz + 3), z: p.z + v.z * sign * (hz + 3) }, u, hx, 1).filter((q) => open(site, q)).length;
      const sign = ahead(1) >= ahead(-1) ? 1 : -1;
      const piece: Placed = { prop, p, yaw: yawOf(v.x * sign, v.z * sign), key: `${seed}~${out.length}` };
      out.push(piece);
      // The next keeps clear of this one with its walkway.
      for (const q of foot) {
        const k = `${Math.floor(q.x / CELL)}:${Math.floor(q.z / CELL)}`;
        grid.set(k, [...(grid.get(k) ?? []), { p: q, r: STEP }]);
      }
      break;
    }
  }
  return out;
};
