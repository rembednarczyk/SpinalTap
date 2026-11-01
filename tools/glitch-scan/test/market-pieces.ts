import type { StreetPropItem, StreetPropKind } from "../../../packages/core/src";
import { FOOD_STALL, distanceToPiece, furniturePrisms, turnLocal } from "../../../packages/sim/src/content/lublin/furniture";
import { extractFeatures } from "../../osm-import/src/features.ts";
import { roadWidth } from "../../osm-import/src/ground.ts";
import type { OsmData, Tags } from "../../osm-import/src/osm.ts";
import { geoToWorld } from "../../osm-import/src/project.ts";

/**
 * The market's furniture of ADR-0058 stage 3 (the stock beside the stalls, the food booths) and the
 * stalls and carts it stands among, checked against the map data itself (`SOURCE_OSM`): the
 * building outlines, the carriageways of the car roads, the zebras, passages and service ways, the
 * crowd's lanes and the other pieces. Independent of the generator's own ground (`props-food.ts`),
 * so a rule that drifts from the map shows here.
 */

type Pt = { readonly x: number; readonly z: number };
type Finding = { readonly at: string; readonly what: string };

/** The market's furniture: what stage 3 places, and the stalls and carts beside it. */
export const MARKET_KINDS: ReadonlySet<StreetPropKind> = new Set(["market-goods", "food-stall", "market-stall", "food-cart"]);

/** Roads whose carriageway cars drive (the generator's `nearTraffic` streets, and the service roads). */
const CAR_ROADS: ReadonlySet<string> = new Set(["primary", "secondary", "tertiary", "residential", "unclassified", "living_street", "trunk", "primary_link", "secondary_link", "tertiary_link", "service"]);
/** How far inside a carriageway's mapped edge a piece's point counts as on it (m): OSM's widths are estimates. */
const ROAD_SLACK = 0.5;
/** How close to a zebra's node or way, a passage's axis past its half width, or a service way's carriageway a piece's point may come (m). */
const CROSSING_ROOM = 2;
/** A walker's body round its line (sim `LANE_HALF_GAP` 0.28 to its side, its radius 0.3). */
const WALKER = 0.6;
/** How far a food booth may stand from the fast-food place it serves (m), and the stock from a marketplace's outline or a stall. */
const BOOTH_REACH = 20;
const STOCK_REACH = 3;
/** The pavement a food booth leaves between its stools and the carriageway (m). */
const BOOTH_PAVEMENT = 2;

const near = (p: Pt): string => `${p.x.toFixed(0)},${p.z.toFixed(0)}`;

const segGap = (p: Pt, a: Pt, b: Pt): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z);
};
const lineGap = (p: Pt, line: readonly Pt[], closed = false): number => {
  let best = Infinity;
  const n = closed ? line.length : line.length - 1;
  for (let i = 0; i < n; i++) best = Math.min(best, segGap(p, line[i]!, line[(i + 1) % line.length]!));
  return best;
};
const inRing = (p: Pt, ring: readonly Pt[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!;
    const b = ring[j]!;
    if (a.z > p.z !== b.z > p.z && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside;
};

/** Points of a piece's solid, every 0.25 m. */
export const solidPoints = (i: StreetPropItem): Pt[] =>
  furniturePrisms(i).flatMap((p) => {
    const xs = p.points.map((q) => q.x);
    const zs = p.points.map((q) => q.z);
    const out: Pt[] = [];
    for (let x = Math.min(...xs); x <= Math.max(...xs) + 1e-9; x += 0.25)
      for (let z = Math.min(...zs); z <= Math.max(...zs) + 1e-9; z += 0.25) if (distanceToPiece(i, i.x + x, i.z + z) === 0) out.push({ x: i.x + x, z: i.z + z });
    return out;
  });

/** Points of a stall's canvas (2.4 x 1.8 m, `marketStall`), every 0.3 m; a piece's solid for the rest. */
export const coverPoints = (i: StreetPropItem): Pt[] => {
  if (i.prop !== "market-stall") return solidPoints(i);
  const out: Pt[] = [];
  for (let a = -1.2; a <= 1.2 + 1e-9; a += 0.3)
    for (let b = -0.9; b <= 0.9 + 1e-9; b += 0.3) {
      const q = turnLocal(i.yaw, a, b);
      out.push({ x: i.x + q.x, z: i.z + q.z });
    }
  return out;
};

const isBuilding = (t: Tags): boolean => t.building !== undefined && t.building !== "roof" && t.location !== "underground" && Number(t.layer ?? 0) >= 0;

/** The checks over the pieces `all` (every piece of the city), the map data `osm` and the crowd's lanes. */
export const marketChecks = (osm: OsmData, all: readonly StreetPropItem[], lanes: readonly { readonly id: string; readonly points: readonly (readonly [number, number])[] }[]): Record<string, () => Finding[]> => {
  let memo: ReturnType<typeof gather> | null = null;
  const gather = () => {
    const { areas, lines } = extractFeatures(osm);
    const pieces = all.filter((i) => MARKET_KINDS.has(i.prop));
    const box = (ring: readonly Pt[]) => ({ ring, minX: Math.min(...ring.map((p) => p.x)), maxX: Math.max(...ring.map((p) => p.x)), minZ: Math.min(...ring.map((p) => p.z)), maxZ: Math.max(...ring.map((p) => p.z)) });
    const buildings = areas.filter((a) => isBuilding(a.tags)).map((a) => ({ id: a.id, ...box(a.ring) }));
    const surface = (l: { tags: Tags }) => Number(l.tags.layer ?? 0) >= 0 && l.tags.tunnel === undefined && l.tags.bridge === undefined && l.tags.area !== "yes";
    const roads = lines.filter((l) => CAR_ROADS.has(l.tags.highway ?? "") && surface(l) && l.tags.service !== "parking_aisle").map((l) => ({ id: l.id, line: l.line, half: roadWidth(l.tags) / 2 }));
    const zebras = [
      ...lines.filter((l) => l.tags.footway === "crossing" || l.tags.highway === "crossing").map((l) => ({ id: l.id, line: l.line, half: 0 })),
      ...[...osm.nodes.values()].filter((n) => n.tags?.highway === "crossing").map((n) => ({ id: `n${n.id}`, line: [geoToWorld(n.lat, n.lon)], half: 0 })),
      // Passages through buildings and the service ways' mouths: ways into yards (przejazdy).
      ...lines.filter((l) => l.tags.tunnel === "building_passage" || (l.tags.covered === "yes" && l.tags.highway !== undefined)).map((l) => ({ id: l.id, line: l.line, half: roadWidth(l.tags) / 2 })),
    ];
    const markets = areas.filter((a) => a.tags.amenity === "marketplace").map((a) => a.ring);
    const food = [
      ...[...osm.nodes.values()].filter((n) => n.tags?.amenity === "fast_food" || n.tags?.amenity === "food_court").map((n) => geoToWorld(n.lat, n.lon)),
      ...areas.filter((a) => a.tags.amenity === "fast_food" || a.tags.amenity === "food_court").flatMap((a) => a.ring),
    ];
    return { pieces, buildings, roads, zebras, markets, food };
  };
  const data = () => (memo ??= gather());
  const each = (test: (i: StreetPropItem, d: ReturnType<typeof gather>) => string | null): Finding[] =>
    data().pieces.flatMap((i) => {
      const what = test(i, data());
      return what ? [{ at: near(i), what: `${i.prop} ${what}` }] : [];
    });
  return {
    /** A market piece (its solid, a stall's canvas) in a building's outline from the map (roofs over a market aside). */
    "market-piece-in-building": () =>
      each((i, d) => {
        const hit = d.buildings.find((b) => coverPoints(i).some((q) => q.x >= b.minX && q.x <= b.maxX && q.z >= b.minZ && q.z <= b.maxZ && inRing(q, b.ring)));
        return hit ? `in ${hit.id}` : null;
      }),
    /** A market piece's solid on the carriageway of a car road (its mapped width about its axis, less `ROAD_SLACK`). */
    "market-piece-on-road": () =>
      each((i, d) => {
        const pts = solidPoints(i);
        const hit = d.roads.find((r) => pts.some((q) => lineGap(q, r.line) < r.half - ROAD_SLACK));
        return hit ? `on ${hit.id}` : null;
      }),
    /**
     * A food booth whose stools' front (sim `FOOD_STALL`) is less than `BOOTH_PAVEMENT` from the
     * edge of a car road's carriageway (its mapped width about its axis): no room left to walk past.
     */
    "market-booth-near-road": () =>
      each((i, d) => {
        if (i.prop !== "food-stall") return null;
        const front = [-1.05, -0.5, 0, 0.5, 1.05].map((x) => {
          const q = turnLocal(i.yaw, x, FOOD_STALL.stoolZ + 0.18);
          return { x: i.x + q.x, z: i.z + q.z };
        });
        const hit = d.roads.find((r) => front.some((q) => lineGap(q, r.line) - r.half < BOOTH_PAVEMENT));
        return hit ? `${Math.min(...front.map((q) => lineGap(q, hit.line) - hit.half)).toFixed(2)} m from ${hit.id}` : null;
      }),
    /** A market piece's solid within `CROSSING_ROOM` of a zebra, or of a passage through a building or a covered way past its half width. */
    "market-piece-in-crossing": () =>
      each((i, d) => {
        const pts = solidPoints(i);
        const hit = d.zebras.find((z) => pts.some((q) => (z.line.length === 1 ? Math.hypot(q.x - z.line[0]!.x, q.z - z.line[0]!.z) : lineGap(q, z.line)) < z.half + CROSSING_ROOM));
        return hit ? `at ${hit.id}` : null;
      }),
    /** A market piece's solid across a crowd lane: a walker's body would pass through it. */
    "market-piece-on-crowd-lane": () =>
      each((i) => {
        const pts = solidPoints(i);
        const hit = lanes.find((l) => {
          const line = l.points.map(([x, z]) => ({ x, z }));
          return pts.some((q) => lineGap(q, line, true) < WALKER);
        });
        return hit ? `on ${hit.id}` : null;
      }),
    /**
     * A market piece in its neighbour: its solid in another piece's solid or under a stall's canvas,
     * or the stock or a booth away from its own place (the stock farther than `STOCK_REACH` from a
     * marketplace's outline and from every stall, a booth farther than `BOOTH_REACH` from the
     * fast-food place it serves).
     */
    "market-piece-in-neighbour": () =>
      each((i, d) => {
        const own = solidPoints(i);
        const other = all.find((o) => o !== i && Math.hypot(o.x - i.x, o.z - i.z) < 8 && own.some((q) => (o.prop === "market-stall" && i.prop !== "market-stall" ? coverPoints(o).some((c) => Math.hypot(c.x - q.x, c.z - q.z) < 0.15) : distanceToPiece(o, q.x, q.z) === 0)));
        if (other) return `in ${other.prop} at ${near(other)}`;
        if (i.prop === "market-goods") {
          const atMarket = d.markets.some((r) => inRing(i, r) || lineGap(i, r, true) < STOCK_REACH) || all.some((o) => o.prop === "market-stall" && Math.hypot(o.x - i.x, o.z - i.z) < STOCK_REACH);
          return atMarket ? null : "off its market";
        }
        if (i.prop === "food-stall") return d.food.some((f) => Math.hypot(f.x - i.x, f.z - i.z) < BOOTH_REACH) ? null : "off a fast-food place";
        return null;
      }),
  };
};
