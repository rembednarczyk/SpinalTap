/**
 * The stalls of a marketplace's outline (G-064): rows along its longer axis, back to back in
 * pairs with an aisle between the pairs and a passage across every few stalls, off the paths,
 * the streets and the entrances where they come in. No randomness: the rows' phase is the one
 * that fits the most stalls, the first on a tie.
 */
import type { StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { distanceToPiece } from "../../../packages/sim/src/content/lublin/furniture.ts";
import { type Pt, pointInRing, ringBounds } from "./geometry.ts";
import { yawOf } from "./props-place.ts";
import type { Site } from "./props-site.ts";
import { nearTraffic } from "./props-streets.ts";

/** A stall's canvas (`marketStall` in the renderer): 2.4 m along its counter, 1.8 m deep. */
const STALL_W = 2.4;
const STALL_D = 1.8;
/** Along a row: canvas to canvas, and the stalls between two passages across it. */
const PITCH = 2.6;
const BLOCK = 4;
/** The passage across a row and the aisle between two pairs of rows (m). */
const PASSAGE = 4;
const AISLE = 4;
/** Back to back: the two rows' centres apart. */
const BACK = STALL_D + 0.1;
const PERIOD_U = BLOCK * PITCH + PASSAGE;
const PERIOD_V = 2 * BACK + AISLE;
/** How far the canvas keeps from the outline's edge, a path or a street's axis, and a stall from an entrance (m). */
const EDGE = 0.6;
const PATH_ROOM = 1.5;
const ENTRANCE_ROOM = 6;
/** How far a stall keeps from a car street's axis (m), as the scattered pieces do. */
const TRAFFIC_REACH = 4.5;
/** How far a stall's canvas keeps from the solid of a container or cart set before it (m): a walkway. */
const WALKWAY = 1;
/** The step of the canvas samples checked against them (m). */
const CANVAS_STEP = 0.3;

/** Phases tried along and across the rows, in parts of a period. */
const PHASES = 4;

export interface MarketStall {
  readonly p: Pt;
  readonly yaw: number;
}

const distToLine = (p: Pt, line: readonly Pt[]): number => {
  let best = Infinity;
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i]!;
    const b = line[i + 1]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z));
  }
  return best;
};

/** The open ground of the outline on the map, every metre. */
const openGround = (site: Site, ring: readonly Pt[]): Pt[] => {
  const b = ringBounds(ring);
  const out: Pt[] = [];
  for (let x = Math.floor(b.minX) + 0.5; x < b.maxX; x++)
    for (let z = Math.floor(b.minZ) + 0.5; z < b.maxZ; z++) {
      const p = { x, z };
      if (pointInRing(p, ring) && site.chunkAt(p) && site.standable(p)) out.push(p);
    }
  return out;
};

/** The longer axis of the ground (its principal direction), as a unit vector with x ≥ 0. */
export const longAxis = (pts: readonly Pt[]): Pt => {
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const mz = pts.reduce((s, p) => s + p.z, 0) / pts.length;
  let xx = 0;
  let zz = 0;
  let xz = 0;
  for (const p of pts) {
    xx += (p.x - mx) ** 2;
    zz += (p.z - mz) ** 2;
    xz += (p.x - mx) * (p.z - mz);
  }
  const a = Math.atan2(2 * xz, xx - zz) / 2;
  const u = { x: Math.cos(a), z: Math.sin(a) };
  return u.x < 0 || (u.x === 0 && u.z < 0) ? { x: -u.x, z: -u.z } : u;
};

/** Where paths and streets cross the outline's edge, every metre along it. */
const entrances = (site: Site, ring: readonly Pt[]): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z)));
    for (let k = 0; k < n; k++) {
      const p = { x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n };
      if (site.onPath(p) || site.surfaceAt(p) === "road" || site.streets.some((s) => distToLine(p, s.line) < 2)) out.push(p);
    }
  }
  return out;
};

/** Does a stall's canvas at p (its counter along u) keep a walkway from every piece set before it? */
const clearOf = (pieces: readonly StreetPropItem[], p: Pt, u: Pt): boolean => {
  const near = pieces.filter((o) => Math.hypot(o.x - p.x, o.z - p.z) < 8);
  if (near.length === 0) return true;
  const v = { x: -u.z, z: u.x };
  for (let a = -STALL_W / 2; a <= STALL_W / 2 + 1e-9; a += CANVAS_STEP)
    for (let b = -STALL_D / 2; b <= STALL_D / 2 + 1e-9; b += CANVAS_STEP) {
      const q = { x: p.x + u.x * a + v.x * b, z: p.z + u.z * a + v.z * b };
      if (near.some((o) => distanceToPiece(o, q.x, q.z) < WALKWAY)) return false;
    }
  return true;
};

/** Is a stall at p (its counter along u) clear: its canvas with a margin on the outline's open ground, off paths, streets, entrances and the pieces set before? */
const fits = (site: Site, ring: readonly Pt[], gates: readonly Pt[], p: Pt, u: Pt, pieces: readonly StreetPropItem[]): boolean => {
  if (gates.some((g) => Math.hypot(g.x - p.x, g.z - p.z) < ENTRANCE_ROOM) || nearTraffic(site, p, TRAFFIC_REACH)) return false;
  if (!clearOf(pieces, p, u)) return false;
  const hw = STALL_W / 2 + EDGE;
  const hd = STALL_D / 2 + EDGE;
  const v = { x: -u.z, z: u.x };
  for (const a of [-1, -0.5, 0, 0.5, 1])
    for (const b of [-1, 0, 1]) {
      const q = { x: p.x + u.x * hw * a + v.x * hd * b, z: p.z + u.z * hw * a + v.z * hd * b };
      if (!pointInRing(q, ring) || !site.chunkAt(q) || site.surfaceAt(q) !== "walk" || site.onPath(q)) return false;
    }
  const reach = Math.hypot(hw, hd) + PATH_ROOM - EDGE;
  return !site.streets.some((s) => distToLine(p, s.line) < reach);
};

/** The stalls of one phase of the rows over the ground's extent along u and v. */
const layout = (
  site: Site,
  ring: readonly Pt[],
  gates: readonly Pt[],
  pieces: readonly StreetPropItem[],
  u: Pt,
  span: { u0: number; u1: number; v0: number; v1: number },
  du: number,
  dv: number,
): MarketStall[] => {
  const v = { x: -u.z, z: u.x };
  const out: MarketStall[] = [];
  for (let vc = span.v0 + dv; vc <= span.v1 + PERIOD_V; vc += PERIOD_V)
    for (const side of [-1, 1] as const)
      for (let j = 0; ; j++) {
        const uc = span.u0 + du + Math.floor(j / BLOCK) * PERIOD_U + (j % BLOCK) * PITCH + PITCH / 2;
        if (uc > span.u1 + PERIOD_U) break;
        const sv = vc + (side * BACK) / 2;
        const p = { x: u.x * uc + v.x * sv, z: u.z * uc + v.z * sv };
        // Back to back: each row's counters face its own aisle.
        if (fits(site, ring, gates, p, u, pieces)) out.push({ p, yaw: yawOf(v.x * side, v.z * side) });
      }
  return out;
};

/**
 * Rows of stalls on a marketplace's outline (empty when none fits), their canvases a walkway clear
 * of `pieces` set on it before them (the containers of a flea market, ADR-0058 stage 2).
 */
export const marketStalls = (site: Site, ring: readonly Pt[], pieces: readonly StreetPropItem[] = []): MarketStall[] => {
  const ground = openGround(site, ring);
  if (ground.length === 0) return [];
  const u = longAxis(ground);
  const us = ground.map((p) => p.x * u.x + p.z * u.z);
  const vs = ground.map((p) => -p.x * u.z + p.z * u.x);
  const span = { u0: Math.min(...us) - PERIOD_U, u1: Math.max(...us), v0: Math.min(...vs) - PERIOD_V, v1: Math.max(...vs) };
  const gates = entrances(site, ring);
  let best: MarketStall[] = [];
  for (let i = 0; i < PHASES; i++)
    for (let k = 0; k < PHASES; k++) {
      const stalls = layout(site, ring, gates, pieces, u, span, (PERIOD_U * i) / PHASES, (PERIOD_V * k) / PHASES);
      if (stalls.length > best.length) best = stalls;
    }
  return best;
};
