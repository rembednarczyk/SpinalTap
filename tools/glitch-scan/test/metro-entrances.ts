import type { StreetPropItem } from "../../../packages/core/src";
import { METRO_ENTRANCES } from "../../../packages/sim/src/content/metro";
import { MAP_CHUNKS } from "../../../packages/sim/src/content/lublin/sites";
import type { CrowdLane } from "../../../packages/sim/src/content/crowd";
import type { TrafficRoute } from "../../../packages/sim/src/content/traffic-lane";
import { type P2, pointInRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import type { OsmData } from "../../osm-import/src/osm.ts";
import { geoToWorld } from "../../osm-import/src/project.ts";

/**
 * The metro's entrances (ADR-0071 stage 2, "Kontrole") against the map data, measured from the
 * pavilions' outlines (the topography curator's review, 5.11): in a building; near a monument,
 * a church or a public building (15 m), a memorial, an artwork or a fountain (10 m), or with the
 * dig near an archaeological site (3 m); the opening blocked (3 m free in front of it, furniture,
 * the walkers' lanes, a car's lane closer than a pavement); the shaft open beyond its walls.
 */

type Rect = { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number };
type Finding = { readonly at: string; readonly what: string };
type Entrance = (typeof METRO_ENTRANCES)[number];

const HERITAGE_USES: ReadonlySet<string> = new Set(["historic", "church", "civic"]);
const BUILDING_GAP = 15;
const POINT_GAP = 10;
const DIG_GAP = 3;
const FRONT = 3;
const LANE_GAP = 1.5 + 2;
/** How far off a wall's edge a sample still counts as on it: far under any gap a wall left out makes. */
const EDGE = 1e-6;

const toRect = (r: Rect, x: number, z: number): number => Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));
const segToRect = (a: P2, b: P2, r: Rect): number => {
  let best = Infinity;
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.1));
  for (let k = 0; k <= n; k++) best = Math.min(best, toRect(r, a.x + ((b.x - a.x) * k) / n, a.z + ((b.z - a.z) * k) / n));
  return best;
};
/** Distance from a ring to a rectangle: 0 when they overlap. */
const ringToRect = (ring: readonly P2[], r: Rect): number => {
  if (pointInRing({ x: (r.minX + r.maxX) / 2, z: (r.minZ + r.maxZ) / 2 }, ring)) return 0;
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) best = Math.min(best, segToRect(ring[i]!, ring[(i + 1) % ring.length]!, r));
  return best;
};
const lineToRect = (line: readonly P2[], r: Rect): number => {
  let best = Infinity;
  for (let i = 1; i < line.length; i++) best = Math.min(best, segToRect(line[i - 1]!, line[i]!, r));
  return best;
};
const near = (e: Entrance) => `${e.spot.x.toFixed(0)},${e.spot.z.toFixed(0)}`;
const name = (e: Entrance) => `${e.station} ${e.label} ${e.name}`;

/** The 3 m in front of the opening, as wide as the stairs. */
export const frontOf = (e: Entrance): Rect => {
  const { along, opens } = e.spot;
  const o = e.outline;
  const mouth = along === "x" ? (opens > 0 ? o.maxX : o.minX) : opens > 0 ? o.maxZ : o.minZ;
  const [a, b] = [mouth, mouth + opens * FRONT].sort((p, q) => p - q) as [number, number];
  return along === "x" ? { minX: a, maxX: b, minZ: e.cut.bounds.minZ, maxZ: e.cut.bounds.maxZ } : { minX: e.cut.bounds.minX, maxX: e.cut.bounds.maxX, minZ: a, maxZ: b };
};

const buildingRings = () =>
  MAP_CHUNKS.flatMap((c) =>
    c.buildings.map((b) => {
      const ring: P2[] = [];
      for (let i = 0; i + 1 < b.outline.length; i += 2) ring.push({ x: b.outline[i]! + b.x, z: b.outline[i + 1]! + b.z });
      return { id: b.id, use: b.use, name: b.name, ring };
    }),
  );

export const metroInBuilding = (entrances: readonly Entrance[] = METRO_ENTRANCES): Finding[] => {
  const rings = buildingRings();
  return entrances.flatMap((e) => rings.filter((b) => ringToRect(b.ring, e.outline) < 0.5).map((b) => ({ at: near(e), what: `${name(e)}: in ${b.id} ${b.name ?? b.use}` })));
};

/** Points and areas of the map data a pavilion keeps off: memorials, monuments, artworks, fountains; archaeological sites. */
const heritageOf = (osm: OsmData) => {
  const points: { readonly what: string; readonly p: P2 }[] = [];
  for (const n of osm.nodes.values()) {
    const t = n.tags;
    if (!t) continue;
    if (t.historic === "memorial" || t.historic === "monument" || t.tourism === "artwork" || t.amenity === "fountain") points.push({ what: `n${n.id} ${t.name ?? t.historic ?? t.tourism ?? t.amenity}`, p: geoToWorld(n.lat, n.lon) });
  }
  const sites: { readonly what: string; readonly ring: P2[] }[] = [];
  for (const w of osm.ways.values()) {
    if (w.tags?.historic !== "archaeological_site") continue;
    const ring = w.nodes.flatMap((id) => {
      const n = osm.nodes.get(id);
      return n ? [geoToWorld(n.lat, n.lon)] : [];
    });
    if (ring.length >= 3) sites.push({ what: `w${w.id} ${w.tags.name ?? "archaeological site"}`, ring });
  }
  return { points, sites };
};

export const metroNearHeritage = (osm: OsmData, protectedBuilding: (id: string, use: string) => boolean, entrances: readonly Entrance[] = METRO_ENTRANCES): Finding[] => {
  const rings = buildingRings().filter((b) => HERITAGE_USES.has(b.use) || protectedBuilding(b.id, b.use));
  const { points, sites } = heritageOf(osm);
  return entrances.flatMap((e) => [
    ...rings.filter((b) => ringToRect(b.ring, e.outline) < BUILDING_GAP).map((b) => ({ at: near(e), what: `${name(e)}: ${ringToRect(b.ring, e.outline).toFixed(1)} m from ${b.id} ${b.name ?? b.use}` })),
    ...points.filter((h) => toRect(e.outline, h.p.x, h.p.z) < POINT_GAP).map((h) => ({ at: near(e), what: `${name(e)}: ${toRect(e.outline, h.p.x, h.p.z).toFixed(1)} m from ${h.what}` })),
    ...sites.filter((s) => ringToRect(s.ring, e.cut.bounds) < DIG_GAP).map((s) => ({ at: near(e), what: `${name(e)}: dig ${ringToRect(s.ring, e.cut.bounds).toFixed(1)} m from ${s.what}` })),
  ]);
};

export const metroBlocked = (furniture: readonly StreetPropItem[], crowd: readonly CrowdLane[], lanes: readonly TrafficRoute[], entrances: readonly Entrance[] = METRO_ENTRANCES): Finding[] => {
  const rings = buildingRings();
  return entrances.flatMap((e) => {
    const front = frontOf(e);
    return [
      ...furniture.filter((p) => toRect(front, p.x, p.z) < 0.3 || toRect(e.outline, p.x, p.z) < 0.5).map((p) => ({ at: near(e), what: `${name(e)}: ${p.prop} at ${p.x.toFixed(1)},${p.z.toFixed(1)}` })),
      ...rings.filter((b) => ringToRect(b.ring, front) === 0 || ringToRect(b.ring, front) < 0.3).map((b) => ({ at: near(e), what: `${name(e)}: ${b.id} in front of the opening` })),
      ...crowd.filter((l) => lineToRect(l.points.map(([x, z]) => ({ x, z })), e.outline) < 0.5).map((l) => ({ at: near(e), what: `${name(e)}: walkers' lane ${l.id}` })),
      ...lanes.filter((r) => lineToRect(r.points.map(([x, z]) => ({ x, z })), e.outline) < LANE_GAP).map((r) => ({ at: near(e), what: `${name(e)}: car lane ${r.id}` })),
    ];
  });
};

/**
 * A shaft open beyond its walls: the dug ground (`cut`) out of the outline, or a side of it other
 * than the opening without a solid wall from the hall's floor up to the street over it.
 */
export const metroShaftOpen = (entrances: readonly Entrance[] = METRO_ENTRANCES): Finding[] =>
  entrances.flatMap((e) => {
    const c = e.cut.bounds;
    const o = e.outline;
    const out: Finding[] = [];
    if (c.minX < o.minX || c.maxX > o.maxX || c.minZ < o.minZ || c.maxZ > o.maxZ) out.push({ at: near(e), what: `${name(e)}: dug beyond the outline` });
    const walls = e.props.filter((p) => p.solid && p.view.kind === "block").map((p) => {
      const s = (p.view as { size: { x: number; y: number; z: number } }).size;
      return { minX: p.center.x - s.x / 2, maxX: p.center.x + s.x / 2, minZ: p.center.z - s.z / 2, maxZ: p.center.z + s.z / 2, minY: p.center.y - s.y / 2, maxY: p.center.y + s.y / 2 };
    });
    // The samples at a side's ends lie on the walls' edges, where the rounding of the pavilion's sums decides (G-333).
    const walled = (x: number, z: number) => walls.some((w) => x >= w.minX - EDGE && x <= w.maxX + EDGE && z >= w.minZ - EDGE && z <= w.maxZ + EDGE && w.minY <= e.floor && w.maxY >= e.street);
    const { along, opens } = e.spot;
    const sides: { readonly x: (t: number) => number; readonly z: (t: number) => number; readonly side: string }[] = [
      { side: "x-", x: () => c.minX - 0.1, z: (t) => c.minZ + (c.maxZ - c.minZ) * t },
      { side: "x+", x: () => c.maxX + 0.1, z: (t) => c.minZ + (c.maxZ - c.minZ) * t },
      { side: "z-", x: (t) => c.minX + (c.maxX - c.minX) * t, z: () => c.minZ - 0.1 },
      { side: "z+", x: (t) => c.minX + (c.maxX - c.minX) * t, z: () => c.maxZ + 0.1 },
    ];
    const opening = `${along}${opens > 0 ? "+" : "-"}`;
    for (const s of sides) {
      if (s.side === opening) continue;
      for (let k = 0; k <= 10; k++) {
        if (walled(s.x(k / 10), s.z(k / 10))) continue;
        out.push({ at: near(e), what: `${name(e)}: no wall on the shaft's ${s.side} side` });
        break;
      }
    }
    return out;
  });
