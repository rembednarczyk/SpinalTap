/**
 * Buildings mapped in parts (Simple 3D Buildings, `building:part`, G-049): the towers, helmets,
 * naves and chapels of the landmarks are parts inside the outline, each with its own height,
 * `min_height`, storeys and roof. The outline stays the building of the game (its name, passages
 * and rooms hang on its id); a part that rises out of it becomes a building of its own, lifted
 * (`soffit`) onto whatever stands under it, so the parts stack like the real masonry and the
 * simulation's prisms follow them.
 */
import { type BuildingUse } from "../../../packages/core/src/world/city-geo.ts";
import { STOREY, type Massing, parseLength, parseLevels, roofHeight, roofShapeOf, wholeStoreys } from "./building-tags.ts";
import { type Area } from "./features.ts";
import { type Pt, centroid, pointInRing, ringBounds, signedArea } from "./geometry.ts";

/** A way or multipolygon tagged as a part of a building, not a building itself. */
export const isPart = (a: Area): boolean => a.tags["building:part"] !== undefined && a.tags["building:part"] !== "no" && a.tags.building === undefined;

/** The parts of each building, by the building's id: a part goes to the smallest outline holding its centroid. */
export const partsByBuilding = (buildings: readonly Area[], parts: readonly Area[]): Map<string, Area[]> => {
  const out = new Map<string, Area[]>();
  for (const p of parts) {
    const c = centroid(p.ring);
    let owner: Area | null = null;
    for (const b of buildings) if (pointInRing(c, b.ring) && (!owner || Math.abs(signedArea(b.ring)) < Math.abs(signedArea(owner.ring)))) owner = b;
    if (!owner) continue;
    out.set(owner.id, [...(out.get(owner.id) ?? []), p]);
  }
  return out;
};

/**
 * Parts standing on no building outline (G-061): a pavilion mapped only as `building:part`. They
 * become buildings of their own, with the part's value as the building's kind.
 */
export const orphanParts = (buildings: readonly Area[], parts: readonly Area[]): Area[] => parts.filter((p) => !buildings.some((b) => pointInRing(centroid(p.ring), b.ring)));

/**
 * An orphan part as a building: `building:part=yes` becomes `building=yes` (a restaurant pavilion
 * `building=commercial`), a kind stays the kind. Without its own height or storeys it is a
 * one-storey pavilion, not a block of the district's default height (T-020).
 */
export const asBuilding = (p: Area): Area => {
  const kind = p.tags["building:part"] === "yes" && p.tags.amenity !== undefined ? "commercial" : (p.tags["building:part"] ?? "yes");
  const own = p.tags.height !== undefined || p.tags["building:height"] !== undefined || p.tags["building:levels"] !== undefined;
  return { ...p, tags: { ...p.tags, building: kind, ...(own ? {} : { "building:levels": "1" }) } };
};

/** A part's walls over the outline's base (the top of its plinth), metres. */
export interface Tier {
  readonly area: Area;
  /** `min_height`: where the part starts in the map. */
  readonly bottom: number;
  readonly eaves: number;
  readonly roof: number;
  readonly levels: number;
  readonly source: Massing["source"];
  /** The part's own roof shape (a helmet's onion, a chapel's dome, ADR-0064). */
  readonly shape?: Massing["shape"];
  readonly across?: true;
}

const DOMED = new Set(["dome", "onion", "pyramidal", "cone", "round"]);

/**
 * A part's tier from its own tags; null when it has neither a height nor storeys. A part takes the
 * use of its building (a chapel of a church), and its helmet's `roof:levels` counts: the octagon
 * of Brama Krakowska has three storeys of onion over six of walls.
 */
export const partTier = (p: Area, use: BuildingUse): Tier | null => {
  const t = p.tags;
  const height = parseLength(t.height ?? t["building:height"]);
  const levels = parseLevels(t["building:levels"]);
  if (height === null && levels === null) return null;
  const bottom = parseLength(t.min_height) ?? 0;
  const roofLevels = parseLevels(t["roof:levels"]);
  const shape = t["roof:shape"];
  const tagged = parseLength(t["roof:height"]);
  const roof = tagged === null && roofLevels && shape !== undefined && DOMED.has(shape) ? roofLevels * STOREY : roofHeight(t, use, Math.sqrt(Math.abs(signedArea(p.ring))));
  if (height !== null) {
    if (height <= bottom) return null;
    // A helmet mapped as a part of its own is nearly all roof: a metre of walls carries it.
    const r = Math.min(roof, height * 0.5, Math.max(height - bottom - 1, 0));
    return { area: p, bottom, eaves: height - r, roof: r, levels: levels ?? Math.max(1, Math.round((height - r - bottom) / STOREY)), source: "height", ...roofShapeOf(t) };
  }
  const n = Math.max(1, levels!);
  return { area: p, bottom, eaves: Math.max(n * STOREY, bottom + 1), roof, levels: wholeStoreys(n), source: "levels", ...roofShapeOf(t) };
};

/** Share of the outline (1 m samples) under parts that stand on the ground. */
const groundCover = (outline: readonly Pt[], tiers: readonly Tier[]): number => {
  const ground = tiers.filter((t) => t.bottom === 0);
  if (ground.length === 0) return 0;
  const b = ringBounds(outline);
  let n = 0;
  let covered = 0;
  for (let x = Math.ceil(b.minX); x <= b.maxX; x++) {
    for (let z = Math.ceil(b.minZ); z <= b.maxZ; z++) {
      const p = { x, z };
      if (!pointInRing(p, outline)) continue;
      n++;
      if (ground.some((t) => pointInRing(p, t.area.ring))) covered++;
    }
  }
  return n > 0 ? covered / n : 0;
};

/**
 * Parts covering this much of the outline describe all of it (the rest is a courtyard or a
 * passage the outline fills in), so the outline comes down to the lowest of them: Brama
 * Krakowska's annex has two storeys, not the five of the tag on the whole gate. Parts covering
 * less leave the outline as it is (a wing mapped lower than the block stays the block's height).
 */
const COVERS = 0.75;

/** One part as built: its tier and where its walls start over the base. */
export interface Lifted {
  readonly tier: Tier;
  readonly soffit: number;
}

/**
 * The massing of a building with parts: the outline's own (`base`, or the lowest part when the
 * parts cover it and are lower) and the parts that rise out of it, lowest first, each on the
 * highest of the base and the lower parts round its centroid.
 */
export const stackParts = (outline: readonly Pt[], base: Massing, tiers: readonly Tier[]): { base: Massing; lifted: Lifted[] } => {
  let own = base;
  let rest = [...tiers];
  if (groundCover(outline, tiers) >= COVERS) {
    const ground = tiers.filter((t) => t.bottom === 0).sort((a, b) => a.eaves - b.eaves || Math.abs(signedArea(b.area.ring)) - Math.abs(signedArea(a.area.ring)));
    const low = ground[0]!;
    if (low.eaves < base.walls - 0.5) own = { walls: low.eaves, roof: low.roof, levels: low.levels, source: low.source, ...(low.shape ? { shape: low.shape } : {}), ...(low.across ? { across: low.across } : {}) };
    // As high as the outline, the lowest part is the outline's own body, roof tags and all.
    if (low.eaves <= own.walls + 0.5) rest = rest.filter((t) => t !== low);
  }
  const lifted: Lifted[] = [];
  for (const t of rest.sort((a, b) => a.eaves - b.eaves || a.area.osmId - b.area.osmId)) {
    const c = centroid(t.area.ring);
    const under = lifted.filter((l) => l.tier.eaves < t.eaves && pointInRing(c, l.tier.area.ring)).map((l) => l.tier);
    const floor = Math.max(own.walls, ...under.map((u) => u.eaves));
    const crest = Math.max(own.walls + own.roof, ...under.map((u) => u.eaves + u.roof));
    // Hidden inside what stands under it: walls no higher and no roof over it.
    if (t.eaves <= floor + 0.5 && t.eaves + t.roof <= crest + 1) continue;
    lifted.push({ tier: t, soffit: Math.min(Math.max(t.bottom, floor), t.eaves - 1) });
  }
  return { base: own, lifted };
};
