/**
 * The solids of the street furniture as the simulation builds them (ADR-0050), kept apart while
 * the plan is placed: a piece placed later must not stand in one placed before (a bin in a
 * tree's trunk, a road lamp in a trolley pole).
 */
import type { StreetPropItem } from "../../../packages/core/src/world/city-geo.ts";
import { furniturePrisms, furnitureRadius } from "../../../packages/sim/src/content/lublin/furniture.ts";
import type { Pt } from "./geometry.ts";

type Poly = readonly Pt[];

interface Solid {
  readonly p: Pt;
  readonly r: number;
  readonly parts: readonly Poly[];
}

const CELL = 4;

/** How deep two convex polygons run into each other (m), by separating axes; 0 when apart. */
const depth = (a: Poly, b: Poly): number => {
  let least = Infinity;
  for (const poly of [a, b])
    for (let k = 0; k < poly.length; k++) {
      const p = poly[k]!;
      const q = poly[(k + 1) % poly.length]!;
      const len = Math.hypot(q.x - p.x, q.z - p.z) || 1;
      const nx = -(q.z - p.z) / len;
      const nz = (q.x - p.x) / len;
      const sa = a.map((v) => v.x * nx + v.z * nz);
      const sb = b.map((v) => v.x * nx + v.z * nz);
      least = Math.min(least, Math.min(Math.max(...sa), Math.max(...sb)) - Math.max(Math.min(...sa), Math.min(...sb)));
      if (least <= 0) return 0;
    }
  return least;
};

/** The convex hull of points (monotone chain), counter-clockwise. */
const hull = (pts: readonly Pt[]): Pt[] => {
  const s = [...pts].sort((a, b) => a.x - b.x || a.z - b.z);
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const half = (list: readonly Pt[]) => {
    const out: Pt[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return [...half(s), ...half([...s].reverse())];
};

/**
 * The ground a piece takes: the hull of all its parts, so nothing stands between a stall's
 * posts or inside a shelter, under the canvas or the roof the renderer draws over them.
 */
const solidOf = (item: StreetPropItem): Solid => ({
  p: { x: item.x, z: item.z },
  r: furnitureRadius(item),
  parts: [hull(furniturePrisms(item).flatMap((pr) => pr.points.map((q) => ({ x: item.x + q.x, z: item.z + q.z }))))],
});

/** Kinds left out: bollards stand in tight rows of their own, a cover has no solid. */
const LOOSE: ReadonlySet<string> = new Set(["bollard", "manhole"]);

/** The solids placed so far, in a grid of 4 m cells. */
export class SolidIndex {
  private readonly cells = new Map<string, Solid[]>();
  private reach = 0;

  /** Does the piece's solid run into one already kept? */
  clashes(item: StreetPropItem): boolean {
    if (LOOSE.has(item.prop)) return false;
    const s = solidOf(item);
    if (s.r === 0) return false;
    const span = Math.ceil((s.r + this.reach) / CELL);
    const cx = Math.floor(s.p.x / CELL);
    const cz = Math.floor(s.p.z / CELL);
    for (let i = cx - span; i <= cx + span; i++)
      for (let j = cz - span; j <= cz + span; j++)
        for (const o of this.cells.get(`${i}:${j}`) ?? []) {
          if (Math.hypot(o.p.x - s.p.x, o.p.z - s.p.z) >= o.r + s.r) continue;
          if (o.parts.some((a) => s.parts.some((b) => depth(a, b) > 0))) return true;
        }
    return false;
  }

  add(item: StreetPropItem): void {
    if (LOOSE.has(item.prop)) return;
    const s = solidOf(item);
    if (s.r === 0) return;
    this.reach = Math.max(this.reach, s.r);
    const k = `${Math.floor(s.p.x / CELL)}:${Math.floor(s.p.z / CELL)}`;
    this.cells.set(k, [...(this.cells.get(k) ?? []), s]);
  }
}

/** Slides along the piece's side (the kerb, the bench row), then to its front or back, nearest first (m). */
const SLIDES = [0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.6, -1.6];

/**
 * The piece where its solid keeps out of the kept ones: where it stands, else slid to the
 * nearest spot `fits` accepts, at the 0.1 m the chunks keep; null when none is clear.
 */
export const clearSpot = (solids: SolidIndex, item: StreetPropItem, fits: (p: Pt) => boolean): StreetPropItem | null => {
  if (!solids.clashes(item)) return item;
  // The renderer's frame: the front is +z turned by the yaw, the side +x.
  const side = { x: Math.cos(item.yaw), z: -Math.sin(item.yaw) };
  const front = { x: Math.sin(item.yaw), z: Math.cos(item.yaw) };
  for (const d of [side, front])
    for (const s of SLIDES) {
      const q = { x: Math.round((item.x + d.x * s) * 10) / 10 + 0, z: Math.round((item.z + d.z * s) * 10) / 10 + 0 };
      const moved = { ...item, x: q.x, z: q.z };
      if (fits(q) && !solids.clashes(moved)) return moved;
    }
  return null;
};
