/** Buildings of a chunk: outline, convex parts, foot on the terrain, massing from tags. */
import { terrainHeightAt, type TerrainGrid } from "../../../packages/core/src/world/city-geo.ts";
import { landmarkName, lookOf, massing, buildingUse } from "./building-tags.ts";
import { convexParts, isConvex } from "./convex.ts";
import { type HeightSource } from "./dtm.ts";
import { type Area } from "./features.ts";
import { type Pt, ccw, centroid, openRing, pointInRing, r1, removeCollinear, ringBounds, selfIntersects, signedArea, simplifyRing } from "./geometry.ts";
import { type BuildingOut } from "./model.ts";

export const SIMPLIFY_TOLERANCE = 0.3;
const MIN_AREA = 6;

/** Outline relative to its rounded centroid, rounded to 0.1 m, simplified, counter-clockwise; null if degenerate. */
export const prepareOutline = (ring: readonly Pt[], tolerance = SIMPLIFY_TOLERANCE): { center: Pt; outline: Pt[] } | null => {
  const base = ccw(openRing(ring));
  if (base.length < 3) return null;
  const c = centroid(base);
  const center = { x: r1(c.x), z: r1(c.z) };
  const attempt = (pts: readonly Pt[]): Pt[] | null => {
    const rel = removeCollinear(openRing(pts.map((p) => ({ x: r1(p.x - center.x), z: r1(p.z - center.z) }))), 0.02);
    if (rel.length < 3 || selfIntersects(rel) || signedArea(rel) < MIN_AREA) return null;
    return rel;
  };
  const outline = attempt(simplifyRing(base, tolerance)) ?? attempt(base);
  return outline ? { center, outline } : null;
};

const flat = (pts: readonly Pt[]): number[] => pts.flatMap((p) => [p.x, p.z]);

/** Lowest and highest terrain (m a.s.l.) under an outline: 1 m samples inside it and its corners. */
export const groundUnder = (src: HeightSource, center: Pt, outline: readonly Pt[]): { min: number; max: number } => {
  const world = outline.map((p) => ({ x: p.x + center.x, z: p.z + center.z }));
  const b = ringBounds(world);
  let min = Infinity;
  let max = -Infinity;
  const take = (p: Pt) => {
    const h = src(p);
    if (!Number.isFinite(h)) return;
    min = Math.min(min, h);
    max = Math.max(max, h);
  };
  world.forEach(take);
  for (let x = Math.ceil(b.minX); x <= b.maxX; x++) for (let z = Math.ceil(b.minZ); z <= b.maxZ; z++) if (pointInRing({ x, z }, world)) take({ x, z });
  return { min, max };
};

export interface BuildingContext {
  readonly src: HeightSource;
  readonly grid: TerrainGrid;
  readonly altitude: number;
  readonly range: readonly [number, number];
  /** Shops, cafés and the like: a building with one inside has a shop floor. */
  readonly shopPoints: readonly Pt[];
  /** Named hotels, sights and theatres mapped as points: an unnamed building around one takes its name. */
  readonly namedPoints: readonly { readonly at: Pt; readonly name: string }[];
}

export type BuildingResult = { readonly ok: BuildingOut } | { readonly skipped: string };

export const makeBuilding = (a: Area, ctx: BuildingContext): BuildingResult => {
  const prepared = prepareOutline(a.ring);
  if (!prepared) return { skipped: "degenerate outline" };
  const { center, outline } = prepared;
  const parts = convexParts(outline);
  if (!parts || parts.some((p) => !isConvex(p))) return { skipped: "no convex decomposition" };
  const area = signedArea(outline);
  const partsArea = parts.reduce((s, p) => s + signedArea(p), 0);
  if (Math.abs(partsArea - area) > 1e-6 * Math.max(1, area)) return { skipped: "parts do not cover the outline" };
  const world = outline.map((p) => ({ x: p.x + center.x, z: p.z + center.z }));
  const ground = groundUnder(ctx.src, center, outline);
  const gridMin = Math.min(...world.map((p) => terrainHeightAt(ctx.grid, p.x, p.z)), terrainHeightAt(ctx.grid, center.x, center.z));
  // Rounded down, so the foot never floats above the terrain grid.
  const y = Math.floor(Math.min(ground.min - ctx.altitude, gridMin) * 10 + 1e-9) / 10 + 0;
  const plinth = r1(Math.max(ground.max - ctx.altitude - y, 0));
  const look = lookOf(a.id);
  const use = buildingUse(a.tags);
  const shops = use !== "commercial" && ctx.shopPoints.some((p) => pointInRing(p, world));
  const m = massing(a.tags, { area, shops: shops || use === "commercial", range: ctx.range, look });
  const name = landmarkName(a.tags, use) ?? (a.tags.name ? undefined : ctx.namedPoints.find((p) => pointInRing(p.at, world))?.name);
  return {
    ok: {
      id: a.id,
      x: center.x,
      z: center.z,
      y,
      outline: flat(outline),
      parts: parts.map(flat),
      height: r1(m.walls + plinth),
      plinth,
      levels: m.levels,
      use,
      ...(m.roof > 0 ? { roof: r1(m.roof) } : {}),
      ...(name ? { name } : {}),
      look,
      ...(shops ? { shopfront: true as const } : {}),
      source: m.source,
    },
  };
};
