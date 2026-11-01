/**
 * The ground the street furniture stands on (ADR-0047): point queries over the generated
 * chunks (surfaces, building outlines, streets, terrain), for the placement rules in
 * `props-place.ts`. Built from `LublinChunkData`, the same tables the game and renderer read.
 */
import { type GroundSurface, terrainHeightAt } from "../../../packages/core/src/world/city-geo.ts";
import type { LublinChunkData } from "../../../packages/sim/src/content/lublin/types.ts";
import { type Pt, type Rect, inRect, pointInRing, ringBounds } from "./geometry.ts";

/** What lies at a point, buildings first. */
export type SiteSurface = "building" | "road" | "walk" | "green" | "water" | "rail" | null;

const WALK: ReadonlySet<GroundSurface> = new Set(["sidewalk", "square", "cobble", "footway"]);

const BIN = 32;

/** Which surface wins where several overlap: a road over its sidewalk, a sidewalk over grass. */
const RANK: Readonly<Record<string, number>> = { none: 0, water: 1, green: 2, rail: 3, walk: 4, road: 5, building: 6 };

interface Shape {
  readonly ring: readonly Pt[];
  readonly box: Rect;
  readonly surface: SiteSurface;
  /** A footpath's outline: walk, but a way through, not ground to set things on. */
  readonly path?: boolean;
}

export interface SiteStreet {
  readonly name: string;
  readonly kind: string;
  readonly line: readonly Pt[];
  readonly chunk: string;
}

const flat = (f: readonly number[], dx = 0, dz = 0): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < f.length; i += 2) out.push({ x: f[i]! + dx, z: f[i + 1]! + dz });
  return out;
};

// Nothing stands on a flight of steps, so they count with the rails.
const surfaceOf = (s: GroundSurface): SiteSurface => (s === "road" || s === "crossing" ? "road" : WALK.has(s) ? "walk" : s === "grass" ? "green" : s === "water" || s === "basin" ? "water" : "rail");

/** Point queries over a set of chunks. */
export class Site {
  readonly chunks: readonly LublinChunkData[];
  readonly streets: readonly SiteStreet[];
  private readonly bins = new Map<string, Shape[]>();

  constructor(chunks: readonly LublinChunkData[]) {
    this.chunks = chunks;
    const streets: SiteStreet[] = [];
    for (const c of chunks) {
      for (const b of c.buildings) this.add({ ring: flat(b.outline, b.x, b.z), surface: "building", box: { minX: 0, minZ: 0, maxX: 0, maxZ: 0 } });
      for (const g of c.ground) if (!g.bridge) this.add({ ring: flat(g.outline), surface: surfaceOf(g.surface), path: g.surface === "footway", box: { minX: 0, minZ: 0, maxX: 0, maxZ: 0 } });
      for (const s of c.streets) streets.push({ name: s.name, kind: s.kind, line: flat(s.line), chunk: c.id });
    }
    this.streets = streets;
  }

  private add(s: Shape): void {
    if (s.ring.length < 3) return;
    const shape = { ...s, box: ringBounds(s.ring) };
    for (let i = Math.floor(shape.box.minX / BIN); i <= Math.floor(shape.box.maxX / BIN); i++) {
      for (let j = Math.floor(shape.box.minZ / BIN); j <= Math.floor(shape.box.maxZ / BIN); j++) {
        const k = `${i}:${j}`;
        const list = this.bins.get(k);
        if (list) list.push(shape);
        else this.bins.set(k, [shape]);
      }
    }
  }

  /** The chunk whose rectangle holds p (half-open, so a point on a shared edge has one owner). */
  chunkAt(p: Pt): LublinChunkData | null {
    for (const c of this.chunks) {
      const b = c.bounds;
      if (inRect(p, { minX: b.minX, minZ: b.minZ, maxX: b.maxX, maxZ: b.maxZ })) return c;
    }
    return null;
  }

  /** Ground height at p from the terrain of its chunk; 0 outside every chunk. */
  heightAt(p: Pt): number {
    const c = this.chunkAt(p);
    return c ? terrainHeightAt(c.terrain, p.x, p.z) : 0;
  }

  /** What lies at p: a building wins, then a road, then the other surfaces in their draw order. */
  surfaceAt(p: Pt): SiteSurface {
    const list = this.bins.get(`${Math.floor(p.x / BIN)}:${Math.floor(p.z / BIN)}`);
    if (!list) return null;
    let found: SiteSurface = null;
    for (const s of list) {
      if (p.x < s.box.minX || p.x > s.box.maxX || p.z < s.box.minZ || p.z > s.box.maxZ || !pointInRing(p, s.ring)) continue;
      if (s.surface === "building") return "building";
      if (RANK[s.surface ?? "none"]! > RANK[found ?? "none"]!) found = s.surface;
    }
    return found;
  }

  /** Whether p lies on a footpath's outline (a market's aisle in the map data, a path across a square). */
  onPath(p: Pt): boolean {
    const list = this.bins.get(`${Math.floor(p.x / BIN)}:${Math.floor(p.z / BIN)}`) ?? [];
    return list.some((s) => s.path === true && p.x >= s.box.minX && p.x <= s.box.maxX && p.z >= s.box.minZ && p.z <= s.box.maxZ && pointInRing(p, s.ring));
  }

  /** Unit vector from the nearest building wall within `reach` metres out to p (a wall lantern's arm), or null. */
  awayFromWall(p: Pt, reach = 2): Pt | null {
    let best: Pt | null = null;
    let bestD = reach;
    const seen = new Set<Shape>();
    for (let i = Math.floor((p.x - reach) / BIN); i <= Math.floor((p.x + reach) / BIN); i++) {
      for (let j = Math.floor((p.z - reach) / BIN); j <= Math.floor((p.z + reach) / BIN); j++) {
        for (const s of this.bins.get(`${i}:${j}`) ?? []) {
          if (s.surface !== "building" || seen.has(s)) continue;
          seen.add(s);
          s.ring.forEach((a, k) => {
            const b = s.ring[(k + 1) % s.ring.length]!;
            const dx = b.x - a.x;
            const dz = b.z - a.z;
            const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
            const d = Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t);
            if (d < bestD && d > 1e-6) {
              bestD = d;
              best = { x: (p.x - a.x - dx * t) / d, z: (p.z - a.z - dz * t) / d };
            }
          });
        }
      }
    }
    return best;
  }

  /** Whether p is open ground a thing can stand on: not a building, water or rails. */
  standable(p: Pt): boolean {
    const s = this.surfaceAt(p);
    return s !== "building" && s !== "water" && s !== "rail";
  }
}
