import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type StreetPropItem, VEHICLE_SIZE, terrainHeightAt } from "../../../packages/core/src";
import { planSteps } from "../../../packages/engine/src/renderer/mapcity/steps-plan";
import { facadeFrame } from "../../../packages/engine/src/renderer/mapcity/facade-frame";
import { planFarBuilding } from "../../../packages/engine/src/renderer/mapcity/facade-plan";
import { type BuildingSource, mapBuilding } from "../../../packages/engine/src/renderer/mapcity/map-building";
import { centroid, cleanRing, pointInRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { stackTiers } from "../../../packages/engine/src/renderer/mapcity/vertical-plan";
import { MeshSink } from "../../../packages/engine/src/renderer/mesh-sink";
import { mergeOsm, parseExtract } from "../../osm-import/src/osm.ts";
import { geoToWorld } from "../../osm-import/src/project.ts";
import { CROWD_LANES } from "../../../packages/sim/src/content/crowd";
import { furnitureClearance } from "../../../packages/sim/src/content/furniture-index";
import { BOLLARD, alongSegment, anchors, chainSegments, chainThrough, distanceToPiece, furniturePrisms, furnitureRadius } from "../../../packages/sim/src/content/lublin/furniture";
import { buildingView, isLandmark } from "../../../packages/sim/src/content/lublin";
import { inBuilding, nearestWall } from "../../../packages/sim/src/content/lublin/places";
import { ROAD_CHAINS, type RoadChain, polylineLength, surfacesAt } from "../../../packages/sim/src/content/lublin/roads";
import { clearedBuilding } from "../../../packages/sim/src/content/cleared-buildings";
import { CLEARED_BUILDINGS, MAP_CHUNKS, PASSAGES } from "../../../packages/sim/src/content/lublin/sites";
import { groundY } from "../../../packages/sim/src/content/lublin/terrain";
import { BRIDGE_DECKS } from "../../../packages/sim/src/content/lublin/decks";
import { WORLD_CHUNKS } from "../../../packages/sim/src/content/world-map";
import { type GroundDeck, deckAt } from "../../../packages/sim/src/world/deck";
import { GroundField } from "../../../packages/sim/src/world/ground";
import { type Prism, circleTouchesPrism, makePrism, prismsAt } from "../../../packages/sim/src/world/prism";
import { groundAt } from "../../../packages/sim/src/systems/movement-system";
import { PARKED_CARS } from "../../../packages/sim/src/content/parked-cars";
import { GAME_PROPS, WORLD_STREET_PROPS } from "../../../packages/sim/src/content/street-props";
import { crossingBands, inCrossingBand } from "../../../packages/sim/src/content/lublin/crossing-bands";
import { MIN_ROUTE, TRAFFIC_LANES, TRAFFIC_ROUTES, type TrafficRoute, pointAt, projectOn, roadHalfWidth } from "../../../packages/sim/src/content/traffic";

/**
 * The glitch scan (ADR-0054): the map's known kinds of glitch counted over the whole city, each
 * against its baseline in `glitch-baseline.json`. A count over its baseline is a regression and
 * fails; a count under it is a fix, and the baseline comes down with it (`GLITCH_BASELINE=update
 * pnpm vitest run tools/glitch-scan`), so it only ever ratchets down.
 * Each finding's place goes to `reports/glitch-scan.json` for the hunters (ADR-0054).
 */

type Finding = { readonly at: string; readonly what: string };

const BASELINE = join(__dirname, "glitch-baseline.json");
/** The map data the city is generated from (ADR-0042), for what the import may lose. */
const OSM_DIR = join(__dirname, "../../../data/osm");
const SOURCE_OSM = mergeOsm(
  readdirSync(OSM_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => parseExtract(readFileSync(join(OSM_DIR, f), "utf8"))),
);
const cars = TRAFFIC_ROUTES.filter((r) => r.use !== "deliveries");
/** The car lanes one by one, before the junctions join them into routes (ADR-0055): sampled from each lane's own start. */
const carLanes = TRAFFIC_LANES.filter((r) => r.use !== "deliveries");
const carStreets = ROAD_CHAINS.filter((c) => c.use === "cars");
/** The side streets cars park along (ADR-0050). */
const kerbStreets = carStreets.filter((c) => c.kind === "residential" || c.kind === "tertiary" || c.kind === "unclassified");

/** Samples along a lane every `step` metres. */
const along = (r: TrafficRoute, step: number) => {
  const out: { x: number; z: number; s: number }[] = [];
  for (let s = 0; s < r.length; s += step) {
    const p = pointAt(r.points, s);
    out.push({ x: p.x, z: p.z, s });
  }
  return out;
};

/** Is (x, z) in a passage cut through a building (ADR-0048)? */
const inPassage = (x: number, z: number) =>
  PASSAGES.some((p) => {
    const dx = p.to.x - p.from.x;
    const dz = p.to.z - p.from.z;
    const t = Math.max(0, Math.min(1, ((x - p.from.x) * dx + (z - p.from.z) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(p.from.x + dx * t - x, p.from.z + dz * t - z) < p.width / 2;
  });

const near = (x: number, z: number) => `${x.toFixed(0)},${z.toFixed(0)}`;
const inMap = (x: number, z: number) => MAP_CHUNKS.some((c) => x > c.bounds.minX + 1 && x < c.bounds.maxX - 1 && z > c.bounds.minZ + 1 && z < c.bounds.maxZ - 1);
const onChunk = (x: number, z: number) => MAP_CHUNKS.some(({ bounds: b }) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ);
/** Is (x, z) more than `m` from the map's edge (the chunks' seams inside it aside)? */
const deepInMap = (x: number, z: number, m: number) => [-m, 0, m].every((a) => [-m, 0, m].every((b) => onChunk(x + a, z + b)));

/** Is (x, z) inside a flat outline `[x0, z0, …]` placed at (ox, oz)? */
const inOutline = (x: number, z: number, flat: readonly number[], ox: number, oz: number) => {
  let inside = false;
  for (let i = 0, j = flat.length - 2; i < flat.length; j = i, i += 2) {
    const xi = flat[i]! + ox;
    const zi = flat[i + 1]! + oz;
    const xj = flat[j]! + ox;
    const zj = flat[j + 1]! + oz;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
};

type Rect = (typeof CLEARED_BUILDINGS)[number];

/** Square metres of a rectangle covered by a building's outline, sampled every 0.5 m. */
const coveredArea = (r: Rect, flat: readonly number[], ox: number, oz: number) => {
  let n = 0;
  for (let x = r.minX + 0.25; x < r.maxX; x += 0.5) for (let z = r.minZ + 0.25; z < r.maxZ; z += 0.5) if (inOutline(x, z, flat, ox, oz)) n++;
  return n * 0.25;
};

/** The square metres of a building's outline, sampled over its bounds. */
const outlineArea = (flat: readonly number[], ox: number, oz: number) => {
  const xs = flat.filter((_, i) => i % 2 === 0).map((x) => x + ox);
  const zs = flat.filter((_, i) => i % 2 === 1).map((z) => z + oz);
  return coveredArea({ minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }, flat, ox, oz);
};

type Pt = { readonly x: number; readonly z: number };
type Poly = readonly Pt[];

/** The convex hull of points (monotone chain). */
const hull = (pts: Poly): Pt[] => {
  const s = [...pts].sort((a, b) => a.x - b.x || a.z - b.z);
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const half = (list: Poly) => {
    const out: Pt[] = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0) out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return [...half(s), ...half([...s].reverse())];
};

/** The ground a piece takes in world metres: the hull of its solid's parts (a stall's posts with the space under its canvas). */
const footprint = (i: StreetPropItem) => hull(furniturePrisms(i).flatMap((p) => p.points.map((q) => ({ x: i.x + q.x, z: i.z + q.z }))));

/** How deep two convex polygons run into each other (m), by separating axes; 0 when apart. */
const depth = (a: Poly, b: Poly) => {
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

/** A building's outline in world points. */
const worldOutline = (b: { readonly x: number; readonly z: number; readonly outline: readonly number[] }): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < b.outline.length; i += 2) out.push({ x: b.outline[i]! + b.x, z: b.outline[i + 1]! + b.z });
  return out;
};

/** The gap between two outlines (m): the shortest from a corner of one to an edge of the other. */
const outlineGap = (a: Poly, b: Poly) => {
  let d = Infinity;
  for (const [from, to] of [[a, b], [b, a]] as const)
    for (const p of from)
      for (let k = 0; k < to.length; k++) {
        const q = to[k]!;
        const r = to[(k + 1) % to.length]!;
        const dx = r.x - q.x;
        const dz = r.z - q.z;
        const t = Math.max(0, Math.min(1, ((p.x - q.x) * dx + (p.z - q.z) * dz) / (dx * dx + dz * dz || 1)));
        d = Math.min(d, Math.hypot(q.x + dx * t - p.x, q.z + dz * t - p.z));
      }
  return d;
};

/** The gap between two outlines (m), 0 where one reaches into the other. */
const ringGap = (a: Poly, b: Poly) => (a.some((p) => pointInRing(p, b)) || b.some((p) => pointInRing(p, a)) ? 0 : outlineGap(a, b));

/** The tiers of a building's superstructure as the renderer stacks them (ADR-0051). */
const tiersOf = (view: Extract<ReturnType<typeof buildingView>, { kind: "building" }>, b: { readonly x: number; readonly y: number; readonly z: number }, outline: Poly, id: number) =>
  stackTiers(facadeFrame(mapBuilding(id, { ring: cleanRing(outline), view, at: { x: b.x, y: b.y, z: b.z } }, () => null), () => null));

const overlaps = (a: Rect, b: Rect) => a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;

/** The game's solid blocks standing on the ground (not interiors, awnings or decks) in the rectangles that clear the map's buildings. */
const setPieceBlocks: readonly Rect[] = GAME_PROPS.flatMap((p) => {
  if (p.view.kind !== "block" || !p.solid || p.interior || p.center.y - p.view.size.y / 2 - groundY(p.center.x, p.center.z) > 0.5) return [];
  const r = { minX: p.center.x - p.view.size.x / 2, maxX: p.center.x + p.view.size.x / 2, minZ: p.center.z - p.view.size.z / 2, maxZ: p.center.z + p.view.size.z / 2 };
  return CLEARED_BUILDINGS.some((c) => overlaps(c, r)) ? [r] : [];
});

/** The road chains (by index) with a car lane: a lane's id names its chain, two when it turns round onto another. */
/** The mouths of the zebra crossings (G-032). */
const BANDS = crossingBands(MAP_CHUNKS);

/** The risers of a map steps surface as the renderer draws it on the game's terrain: each one's height, metres. */
const riserHeights = (outline: readonly number[]) => {
  const ring: Pt[] = [];
  for (let i = 0; i + 1 < outline.length; i += 2) ring.push({ x: outline[i]!, z: outline[i + 1]! });
  const sink = new MeshSink();
  planSteps(sink, ring, groundY);
  const out: number[] = [];
  for (let v = 0; v < sink.vertexCount; v += 4) {
    if (Math.abs(sink.normals[v * 3 + 1]!) > 0.5) continue;
    const ys = [0, 1, 2, 3].map((k) => sink.positions[(v + k) * 3 + 1]!);
    out.push(Math.max(...ys) - Math.min(...ys));
  }
  return out;
};

/** The ground the simulation walks (ADR-0043, ADR-0053), terrain and decks of every chunk. */
const FIELD = new GroundField(WORLD_CHUNKS);
/** The bridges: decks whose bounds touch are pieces of one bridge (its carriageways, its sidewalks, its chunks). */
const BRIDGES = (() => {
  const decks = [...BRIDGE_DECKS.values()].flat();
  const near = (a: GroundDeck, b: GroundDeck) => a.box.minX <= b.box.maxX + 1 && b.box.minX <= a.box.maxX + 1 && a.box.minZ <= b.box.maxZ + 1 && b.box.minZ <= a.box.maxZ + 1;
  const groups: GroundDeck[][] = [];
  for (const d of decks) {
    const joined = groups.filter((g) => g.some((e) => near(e, d)));
    groups.splice(0, groups.length, ...groups.filter((g) => !joined.includes(g)), [...joined.flat(), d]);
  }
  return groups;
})();
/** A map way's points every half metre, world x and z. */
const wayPoints = (nodes: readonly number[]) => {
  const pts = nodes.flatMap((id) => {
    const n = SOURCE_OSM.nodes.get(id);
    return n ? [geoToWorld(n.lat, n.lon)] : [];
  });
  return pts.slice(1).flatMap((b, i) => {
    const a = pts[i]!;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 0.5));
    return Array.from({ length: n }, (_, k) => ({ x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n }));
  });
};

/** The game's solids standing in the city (its buildings, walls and street furniture), as prisms. */
const SOLIDS: readonly Prism[] = WORLD_CHUNKS.flatMap((c) =>
  [...c.props, ...(c.street ?? [])].flatMap((p) => {
    if (!p.solid) return [];
    if (p.prisms) return prismsAt(p.prisms, p.center);
    if (p.view.kind !== "block") return [];
    const { x, y, z } = p.view.size;
    const o = p.center;
    return [makePrism([{ x: o.x - x / 2, z: o.z - z / 2 }, { x: o.x + x / 2, z: o.z - z / 2 }, { x: o.x + x / 2, z: o.z + z / 2 }, { x: o.x - x / 2, z: o.z + z / 2 }], o.y - y / 2, o.y + y / 2)];
  }),
);
/** A walker's body: radius, the step it climbs and its height (m). */
const BODY = { r: 0.38, step: 0.45, height: 1.8 };

/**
 * Can a walker get on the game's ground from a to b, keeping within `grow` metres of the box of
 * the two? A flood fill on a 0.25 m grid of the places its body fits; "closed" when a or b has
 * no such place within 2 m (they stand in a solid), else whether b is reached.
 */
const walkable = (a: Pt, b: Pt, grow: number): "ok" | "cut" | "closed" => {
  const cell = 0.25;
  const minX = Math.min(a.x, b.x) - grow;
  const minZ = Math.min(a.z, b.z) - grow;
  const nx = Math.ceil((Math.abs(a.x - b.x) + 2 * grow) / cell);
  const nz = Math.ceil((Math.abs(a.z - b.z) + 2 * grow) / cell);
  const near = SOLIDS.filter((p) => p.box.max.x > minX - 1 && p.box.min.x < minX + nx * cell + 1 && p.box.max.z > minZ - 1 && p.box.min.z < minZ + nz * cell + 1);
  const free = new Uint8Array(nx * nz);
  for (let i = 0; i < nx; i++)
    for (let k = 0; k < nz; k++) {
      const x = minX + i * cell;
      const z = minZ + k * cell;
      const y = FIELD.heightAt(x, z);
      free[k * nx + i] = near.some((p) => p.top > y + BODY.step && p.bottom < y + BODY.height && circleTouchesPrism(p, x, z, BODY.r)) ? 0 : 1;
    }
  const start = (p: Pt) => {
    let best = -1;
    let d = 2;
    for (let v = 0; v < free.length; v++) {
      const e = Math.hypot(minX + (v % nx) * cell - p.x, minZ + Math.floor(v / nx) * cell - p.z);
      if (free[v] && e <= d) [best, d] = [v, e];
    }
    return best;
  };
  const s = start(a);
  const t = start(b);
  if (s < 0 || t < 0) return "closed";
  const seen = new Uint8Array(nx * nz);
  const queue = [s];
  seen[s] = 1;
  while (queue.length > 0) {
    const v = queue.pop()!;
    if (v === t) return "ok";
    const i = v % nx;
    const k = Math.floor(v / nx);
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const u = (k + dk) * nx + i + di;
      if (i + di < 0 || i + di >= nx || k + dk < 0 || k + dk >= nz || !free[u] || seen[u]) continue;
      seen[u] = 1;
      queue.push(u);
    }
  }
  return "cut";
};

/** A way of the map under ground or under a roof: a tunnel, a cellar's corridor, a covered lane. */
const tunnelled = (t: Readonly<Record<string, string>>) => t.tunnel === "yes" || t.covered === "yes" || Number(t.layer ?? 0) < 0;

const laneChains =new Set(TRAFFIC_ROUTES.filter((r) => r.use === "cars").flatMap((r) => [...r.id.matchAll(/#(\d+):/g)].map((m) => Number(m[1]))));

const CHECKS: Readonly<Record<string, () => Finding[]>> = {
  /**
   * A car lane off every road surface (on grass, a square, a pavement), away from the map's edges.
   * Lane by lane, so a junction's join does not move the samples; the joins' arcs, straight on too,
   * have `turn-off-road`.
   */
  "car-lane-off-road": () =>
    carLanes.flatMap((r) => along(r, 3).filter((p) => inMap(p.x, p.z) && !surfacesAt(p.x, p.z).some((s) => s === "road" || s === "crossing" || s === "cobble")).map((p) => ({ at: near(p.x, p.z), what: r.id }))),
  /**
   * A car lane (trolleybuses too) that ends inside the map, more than 6 m from its edge, with no
   * lane starting within 3 m of its end the same way: its vehicles stop there and wait while the
   * player watches. What is left: the junctions where no other street's lane starts by the end
   * (it runs on through the junction: a turn off the middle of a lane, after ADR-0055), the short
   * laneless chains (G-022) and the one-way streets running into a pedestrian one (G-024, no car
   * street within a junction's reach).
   */
  "lane-dead-end": () => {
    const starts = cars.map((r) => ({ r, p: pointAt(r.points, 0) }));
    return cars.flatMap((r) => {
      const e = pointAt(r.points, r.length);
      if (!deepInMap(e.x, e.z, 6)) return [];
      const met = starts.some(({ r: o, p }) => o !== r && o.use === r.use && Math.hypot(p.x - e.x, p.z - e.z) < 3 && p.tx * e.tx + p.tz * e.tz > 0.5);
      return met ? [] : [{ at: near(e.x, e.z), what: r.id }];
    });
  },
  /**
   * A car road too short for a lane between two roads of the same kind and way that have one: a
   * hole in the street where its cars stop at a dead end (a street split by a stray name in OSM).
   */
  "car-road-hole": () =>
    carStreets.flatMap((c) => {
      if (polylineLength(c.points) >= MIN_ROUTE) return [];
      const ends = [c.points[0]!, c.points[c.points.length - 1]!];
      const joins = (p: (typeof ends)[number]) =>
        ROAD_CHAINS.some((o, k) => o !== c && laneChains.has(k) && o.kind === c.kind && o.oneway === c.oneway && [o.points[0]!, o.points[o.points.length - 1]!].some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1));
      return ends.every(joins) ? [{ at: near(ends[0]![0], ends[0]![1]), what: `${c.name} ${polylineLength(c.points).toFixed(1)} m` }] : [];
    }),
  /**
   * Two car roads of one name whose ends lie 0.6–8 m apart inside the map, more than 6 m from its
   * edge: a street broken where a chunk seam cut a short piece of it off (G-021).
   */
  "street-seam-gap": () =>
    carStreets.flatMap((c, i) => {
      const ends = (r: RoadChain) => [r.points[0]!, r.points[r.points.length - 1]!];
      return carStreets.slice(i + 1).flatMap((o) => {
        if (o.name !== c.name) return [];
        return ends(c).flatMap((p) =>
          ends(o).flatMap((q) => {
            const d = Math.hypot(q[0] - p[0], q[1] - p[1]);
            return d >= 0.6 && d <= 8 && deepInMap(p[0], p[1], 6) ? [{ at: near(p[0], p[1]), what: `${c.name} ${d.toFixed(1)} m` }] : [];
          }),
        );
      });
    }),
  /** A lane through a building's solid (a delivery van too), its passages aside. */
  "lane-in-building": () => TRAFFIC_ROUTES.flatMap((r) => along(r, 1).filter((p) => inBuilding(p.x, p.z) && !inPassage(p.x, p.z)).map((p) => ({ at: near(p.x, p.z), what: r.id }))),
  /**
   * A turn of a route (round before a block or at a dead end) or an arc from lane to lane at a
   * junction (ADR-0055, straight on too) with a point off every road surface or in a building,
   * every quarter metre.
   */
  "turn-off-road": () =>
    cars.flatMap((r) =>
      [...(r.turns ?? []), ...(r.arcs ?? []).filter(([a]) => !r.turns?.some(([x]) => x === a))].flatMap(([a, b]) => {
        for (let s = a; s <= b; s += 0.25) {
          const p = pointAt(r.points, s);
          const road = surfacesAt(p.x, p.z).some((k) => k === "road" || k === "crossing" || k === "cobble");
          if (inMap(p.x, p.z) && (!road || (inBuilding(p.x, p.z) && !inPassage(p.x, p.z)))) return [{ at: near(p.x, p.z), what: `${r.id} at ${s.toFixed(1)}` }];
        }
        return [];
      }),
    ),
  /** A crowd lane's walker on a car lane (the set pieces' own lanes aside). */
  "walker-on-car-lane": () =>
    CROWD_LANES.filter((l) => !l.id.startsWith("targ-") && !l.id.startsWith("doki-")).flatMap((l) =>
      l.points.flatMap(([x, z]) => (cars.some((r) => projectOn(r.points, x, z).d < 2.5) ? [{ at: near(x, z), what: l.id }] : [])),
    ),
  /** A solid piece of furniture (covers and bollards aside) a car would drive into. */
  "furniture-in-car-lane": () =>
    Object.values(WORLD_STREET_PROPS)
      .flat()
      .filter((i) => i.prop !== "manhole" && i.prop !== "bollard" && furnitureRadius(i) > 0)
      .flatMap((i) => (cars.some((r) => projectOn(r.points, i.x, i.z).d < furnitureRadius(i) + 0.9) ? [{ at: near(i.x, i.z), what: i.prop }] : [])),
  /** A bulky free-standing piece reaching into a wall. */
  "furniture-in-wall": () =>
    Object.values(WORLD_STREET_PROPS)
      .flat()
      .filter((i) => ["artwork", "monument", "kiosk", "bus-shelter", "bench", "vending-machine", "advertising-column"].includes(i.prop))
      .flatMap((i) => (nearestWall(i.x, i.z).d < furnitureRadius(i) - 0.3 ? [{ at: near(i.x, i.z), what: i.prop }] : [])),
  /**
   * Two solid pieces (bollards aside, they stand in rows) whose footprints run more than 5 cm into
   * each other. Judged on the real prisms, not their radii, which reach far past a long bench's
   * sides; a stall or a shelter takes the ground between its posts and walls too.
   */
  "furniture-overlap": () => {
    const solid = Object.values(WORLD_STREET_PROPS)
      .flat()
      .filter((i) => i.prop !== "bollard" && i.prop !== "manhole" && furnitureRadius(i) > 0)
      .map((i) => ({ i, r: furnitureRadius(i), f: footprint(i) }));
    return solid.flatMap((a, k) =>
      solid.slice(k + 1).flatMap((b) => {
        if (Math.hypot(a.i.x - b.i.x, a.i.z - b.i.z) >= a.r + b.r) return [];
        const d = depth(a.f, b.f);
        return d > 0.05 ? [{ at: near(a.i.x, a.i.z), what: `${a.i.prop} and ${b.i.prop} ${d.toFixed(2)} m` }] : [];
      }),
    );
  },
  /** A flower basket hanging in the air: no pastoral lamp or candelabrum within 0.3 m to hang on (G-004). */
  "hanging-basket-orphan": () => {
    const pieces = Object.values(WORLD_STREET_PROPS).flat();
    const lamps = pieces.filter((i) => i.prop === "lamp-pastoral" || i.prop === "lamp-candelabra");
    return pieces
      .filter((i) => i.prop === "hanging-basket")
      .flatMap((i) => (lamps.some((l) => Math.hypot(l.x - i.x, l.z - i.z) <= 0.3) ? [] : [{ at: near(i.x, i.z), what: i.prop }]));
  },
  /** A bollard's chain whose end hangs in the air: more than 0.2 m from every other bollard and off the shaft of a pole (G-032). */
  "bollard-chain-loose": () => {
    const pieces = Object.values(WORLD_STREET_PROPS).flat();
    const posts = pieces.filter((i) => i.prop === "bollard");
    return posts.flatMap((i) =>
      chainSegments(i).flatMap(({ to }) => {
        const close = (o: StreetPropItem) => o !== i && Math.abs(o.x - to.x) < 1 && Math.abs(o.z - to.z) < 1;
        const held = pieces.some((o) => close(o) && (o.prop === "bollard" ? distanceToPiece(o, to.x, to.z) <= 0.2 : anchors(o, to)));
        return held ? [] : [{ at: near(to.x, to.z), what: `chain of the bollard at ${near(i.x, i.z)}` }];
      }),
    );
  },
  /** A bollard's chain through a building, a third post or the solid of another piece of furniture (G-032). */
  "bollard-chain-through-furniture": () => {
    const pieces = Object.values(WORLD_STREET_PROPS).flat();
    // Other furniture and other posts than the one holding the chain and the one it ends at.
    const solids = pieces.filter((i) => furnitureRadius(i) > 0);
    return pieces.flatMap((i) =>
      chainSegments(i).flatMap(({ from, to }) => {
        const wall = alongSegment(from, to, 0.1).find((p) => inBuilding(p.x, p.z));
        const hit = solids
          // The post or the lamp a chain hangs on is its end, not in its way.
          .filter((o) => o !== i && !(o.prop === "bollard" ? distanceToPiece(o, to.x, to.z) <= 0.2 : anchors(o, to)))
          .filter((o) => Math.hypot(o.x - i.x, o.z - i.z) < 4 + furnitureRadius(o) && chainThrough(from, to, o))
          .map((o) => ({ at: near(i.x, i.z), what: `chain through ${o.prop} at ${near(o.x, o.z)}` }));
        return wall ? [...hit, { at: near(i.x, i.z), what: `chain through a building at ${near(wall.x, wall.z)}` }] : hit;
      }),
    );
  },
  /** A bollard or its chain in the mouth of a zebra crossing, where the walkers step off it (G-032). */
  "bollard-blocks-crossing": () =>
    Object.values(WORLD_STREET_PROPS)
      .flat()
      .filter((i) => i.prop === "bollard")
      .flatMap((i) => {
        const close = BANDS.filter((b) => Math.hypot(b.c.x - i.x, b.c.z - i.z) < b.along + b.across + 4);
        const post = close.some((b) => inCrossingBand(b, i, BOLLARD.side / 2));
        const chain = chainSegments(i).some((s) => close.some((b) => alongSegment(s.from, s.to, 0.1).some((p) => inCrossingBand(b, p))));
        return post || chain ? [{ at: near(i.x, i.z), what: post ? "bollard" : "chain" }] : [];
      }),
  /** A piece of furniture (wall lanterns aside, they hang on a facade) standing more than 0.5 m inside a building. */
  "furniture-in-building": () =>
    Object.values(WORLD_STREET_PROPS)
      .flat()
      .filter((i) => i.prop !== "lamp-wall-lantern" && inBuilding(i.x, i.z) && nearestWall(i.x, i.z).d > 0.5)
      .map((i) => ({ at: near(i.x, i.z), what: `${i.prop} ${nearestWall(i.x, i.z).d.toFixed(1)} m` })),
  /** A parked car with a piece of furniture inside its body. */
  "parked-car-in-furniture": () =>
    PARKED_CARS.flatMap((c) => {
      const { width, length } = VEHICLE_SIZE[c.model];
      const hit = [-0.5, 0, 0.5].some((t) => furnitureClearance(c.x + Math.sin(c.yaw) * length * t, c.z + Math.cos(c.yaw) * length * t) < width / 2);
      return hit ? [{ at: near(c.x, c.z), what: c.model }] : [];
    }),
  /** A parked car with a corner or its middle off the carriageway and the squares (on grass, a pavement). */
  "parked-car-off-road": () =>
    PARKED_CARS.flatMap((c) => {
      const { width, length } = VEHICLE_SIZE[c.model];
      const fx = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      const at = (a: number, b: number) => surfacesAt(c.x + fx * length * b + fz * width * a, c.z + fz * length * b - fx * width * a);
      const spots = [at(0, 0), at(-0.5, -0.5), at(0.5, -0.5), at(0.5, 0.5), at(-0.5, 0.5)];
      const off = spots.filter((s) => !s.some((k) => k === "road" || k === "crossing" || k === "cobble" || k === "square")).length;
      return off > 0 ? [{ at: near(c.x, c.z), what: `${c.model} ${off}/5 off` }] : [];
    }),
  /** A parked car with any of its footprint (sampled every half metre) on a zebra crossing. */
  "parked-car-on-crossing": () =>
    PARKED_CARS.flatMap((c) => {
      const { width, length } = VEHICLE_SIZE[c.model];
      const fx = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      let on = 0;
      for (let a = -width / 2; a <= width / 2 + 1e-6; a += width / Math.ceil(width / 0.5))
        for (let b = -length / 2; b <= length / 2 + 1e-6; b += length / Math.ceil(length / 0.5))
          if (surfacesAt(c.x + fx * b + fz * a, c.z + fz * b - fx * a).includes("crossing")) on++;
      return on > 0 ? [{ at: near(c.x, c.z), what: `${c.model} ${on} points on a zebra` }] : [];
    }),
  /**
   * A parked car on a one-way street (or a roundabout) facing against its traffic: its street is
   * the car road whose axis runs nearest alongside it. Plac Zamkowy's car park aside.
   */
  "parked-car-against-traffic": () =>
    PARKED_CARS.filter((c) => !(c.x > 712 && c.x < 762 && c.z > 188 && c.z < 300)).flatMap((c) => {
      const fx = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      let street: { name: string; d: number; dot: number; directed: boolean } | undefined;
      for (const r of carStreets) {
        const q = projectOn(r.points, c.x, c.z);
        const t = pointAt(r.points, q.s);
        const dot = t.tx * fx + t.tz * fz;
        if (Math.abs(dot) >= 0.7 && (!street || q.d < street.d)) street = { name: r.name, d: q.d, dot, directed: r.oneway || r.name.startsWith("Rondo") };
      }
      return street?.directed && street.dot < 0 ? [{ at: near(c.x, c.z), what: `${c.model} against ${street.name}` }] : [];
    }),
  /**
   * A kerb car on the carriageway of another car road than the one it parks by: nearer that
   * road's axis than the paving reaches on the car's side of it and half a metre. Its own street
   * is the nearest side street within 12 m whose axis runs within 20° of the car; cars with none
   * (the square's bays) are no kerb cars.
   */
  "parked-car-on-other-road": () =>
    PARKED_CARS.flatMap((c) => {
      const fx = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      let own: { street: RoadChain; d: number } | undefined;
      for (const r of kerbStreets) {
        const q = projectOn(r.points, c.x, c.z);
        const t = pointAt(r.points, q.s);
        if (q.d <= 12 && Math.abs(t.tx * fx + t.tz * fz) >= Math.cos((20 * Math.PI) / 180) && (!own || q.d < own.d)) own = { street: r, d: q.d };
      }
      if (!own) return [];
      const by = own.street;
      return carStreets.flatMap((r) => {
        if (r === by) return [];
        const q = projectOn(r.points, c.x, c.z);
        return q.d < roadHalfWidth(r.points, q.side >= 0 ? 1 : -1) + 0.5 ? [{ at: near(c.x, c.z), what: `${c.model} by ${by.name} ${q.d.toFixed(1)} m from ${r.name}` }] : [];
      });
    }),
  /** A game block standing on the ground (not an awning or a deck) that floats or sinks. */
  "prop-off-ground": () =>
    GAME_PROPS.flatMap((p) => {
      if (p.view.kind !== "block" || !p.solid || p.view.size.y < 0.8) return [];
      const gap = p.center.y - p.view.size.y / 2 - groundY(p.center.x, p.center.z);
      return (gap > 0.15 && gap < 1) || gap < -0.3 ? [{ at: near(p.center.x, p.center.z), what: `${p.view.skin?.style ?? p.view.material} ${gap.toFixed(2)} m` }] : [];
    }),
  /** A map building that stays in the game through a set piece's block, or over a quarter of it on a set piece. */
  "building-in-set-piece": () =>
    MAP_CHUNKS.flatMap((c) =>
      c.buildings
        .filter((b) => !clearedBuilding(b))
        .flatMap((b) => {
          const wall = setPieceBlocks.find((r) => coveredArea(r, b.outline, b.x, b.z) > 0);
          const share = CLEARED_BUILDINGS.reduce((s, r) => s + coveredArea(r, b.outline, b.x, b.z), 0) / outlineArea(b.outline, b.x, b.z);
          if (!wall && share <= 0.25) return [];
          return [{ at: near(b.x, b.z), what: wall ? `${b.id} through a block at ${near((wall.minX + wall.maxX) / 2, (wall.minZ + wall.maxZ) / 2)}` : `${b.id} ${(share * 100).toFixed(0)}% over a set piece` }];
        }),
    ),
  /**
   * A flight of map steps drawn with most of its risers under 4.5 cm (G-018): too low to read as
   * steps, each is only a dark line on the paving, and a gentle slope gets a row of them. A real
   * flight on uneven ground may have a few.
   */
  "steps-micro-riser": () =>
    MAP_CHUNKS.flatMap((c) =>
      c.ground
        .filter((g) => g.surface === "steps")
        .flatMap((g) => {
          const risers = riserHeights(g.outline);
          const low = risers.filter((h) => h < 0.045).length;
          return low * 2 > risers.length ? [{ at: near(g.outline[0]!, g.outline[1]!), what: `${c.id} ${low} of ${risers.length} risers under 4.5 cm` }] : [];
        }),
    ),
  /** A piece of road or path on a bridge laid on the valley instead of a deck. */
  "bridge-without-deck": () => MAP_CHUNKS.flatMap((c) => c.ground.filter((g) => g.bridge && !g.deck).map((g) => ({ at: near(g.outline[0]!, g.outline[1]!), what: g.surface }))),
  /**
   * A way of the map off the bridge (a street, a path, steps) under a bridge's deck more than 2 m
   * over the terrain, which a walker cannot follow under it (G-062): walked on the simulation's
   * ground from 5 m before the deck to 5 m past it, the feet jump by more than 0.5 m in a step.
   */
  "under-deck-blocked": () =>
    [...SOURCE_OSM.ways.values()].flatMap((w) => {
      const t = w.tags ?? {};
      if (!t.highway || (t.bridge && t.bridge !== "no")) return [];
      const pts = wayPoints(w.nodes);
      return BRIDGES.flatMap((bridge) => {
        const terrain = (p: { x: number; z: number }) => {
          const g = FIELD.gridAt(p.x, p.z);
          return g ? terrainHeightAt(g, p.x, p.z) : 0;
        };
        const under = pts.flatMap((p, i) => ((deckAt(bridge, p.x, p.z) ?? -Infinity) - terrain(p) > 2 ? [i] : []));
        if (under.length === 0) return [];
        const walk = pts.slice(Math.max(0, under[0]! - 10), under[under.length - 1]! + 11);
        let feet = terrain(walk[0]!);
        let jump = 0;
        for (const p of walk) {
          const y = groundAt([], FIELD, p.x, p.z, feet);
          jump = Math.max(jump, Math.abs(y - feet));
          feet = y;
        }
        const at = pts[under[0]!]!;
        return jump > 0.5 ? [{ at: near(at.x, at.z), what: `w${w.id} ${t.name ?? t.highway} under a deck, a step of ${jump.toFixed(1)} m` }] : [];
      });
    }),
  /**
   * A tier of a superstructure (ADR-0051) rising over the top of a landmark less than 5 m from
   * its outline: the house towering over the gate it adjoins (G-050). The tiers as the renderer
   * stacks them, the landmarks from the map.
   */
  "landmark-overbuilt": () => {
    const buildings = MAP_CHUNKS.flatMap((c) => c.buildings.map((b) => ({ b, district: c.district, outline: worldOutline(b) })));
    const landmarks = buildings.filter(({ b }) => isLandmark(b)).map((l) => ({ ...l, top: l.b.y + l.b.height + (l.b.roof ?? 0) }));
    return buildings.flatMap(({ b, district, outline }, i) => {
      const view = buildingView(b, district);
      if (view.kind !== "building" || !view.vertical?.rise) return [];
      const near5 = landmarks.filter((l) => Math.hypot(l.b.x - b.x, l.b.z - b.z) < 200 && ringGap(outline, l.outline) < 5);
      if (near5.length === 0) return [];
      return tiersOf(view, b, outline, i).flatMap((t, k) => {
        const over = near5.find((l) => t.y1 > l.top + 0.01 && ringGap(t.ring, l.outline) < 5);
        return over ? [{ at: near(b.x, b.z), what: `${b.id} tier ${k} up to ${t.y1.toFixed(1)}, ${ringGap(t.ring, over.outline).toFixed(1)} m off ${over.b.name ?? over.b.id} (top ${over.top.toFixed(1)})` }] : [];
      });
    });
  },
  /**
   * A way of the map through a gateway, a tunnel or a covered lane under a building
   * (`tunnel=building_passage`, `tunnel=yes`, `covered=yes`, G-076) a walker cannot get through:
   * from 1.5 m before its first point to 1.5 m past its last, within 4 m of them (`walkable`).
   * Not one joined to another tunnel (the Underground Route lies under the streets, with no ground
   * to walk), nor one with an end in a solid (a filled courtyard is a glitch of its own, G-079).
   */
  "passage-blocked": () => {
    const ways = [...SOURCE_OSM.ways.values()];
    const under = new Map<number, number[]>();
    for (const w of ways) if (w.tags?.highway && tunnelled(w.tags)) for (const n of w.nodes) under.set(n, [...(under.get(n) ?? []), w.id]);
    return ways.flatMap((w) => {
      const t = w.tags ?? {};
      if (!t.highway || !(t.tunnel === "building_passage" || t.tunnel === "yes" || t.covered === "yes")) return [];
      if (w.nodes.some((n) => (under.get(n) ?? []).some((id) => id !== w.id))) return [];
      const pts = w.nodes.flatMap((id) => {
        const n = SOURCE_OSM.nodes.get(id);
        return n ? [geoToWorld(n.lat, n.lon)] : [];
      });
      if (pts.length < 2 || !pts.every((p) => onChunk(p.x, p.z))) return [];
      const past = (p: Pt, q: Pt) => {
        const d = Math.hypot(p.x - q.x, p.z - q.z) || 1;
        return { x: p.x + ((p.x - q.x) / d) * 1.5, z: p.z + ((p.z - q.z) / d) * 1.5 };
      };
      const a = past(pts[0]!, pts[1]!);
      return walkable(a, past(pts[pts.length - 1]!, pts[pts.length - 2]!), 4) === "cut" ? [{ at: near(a.x, a.z), what: `w${w.id} ${t.name ?? t.highway} tunnel=${t.tunnel ?? "-"}` }] : [];
    });
  },
  /** A passage through a building with an end off every chunk, where there is no ground to come out on. */
  "passage-off-map": () =>
    PASSAGES.filter((p) => [p.from, p.to].some(({ x, z }) => !MAP_CHUNKS.some(({ bounds: b }) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ))).map((p) => ({
      at: near(p.from.x, p.from.z),
      what: p.building,
    })),
  /**
   * A part of a building in the map data (`building:part`: a tower, a helmet, a nave, G-049) over
   * which the game's walls stop more than a storey under the part's own eaves.
   */
  "building-part-ignored": () => {
    const kept = MAP_CHUNKS.flatMap((c) => c.buildings.filter((b) => !clearedBuilding(b)));
    return [...SOURCE_OSM.ways.values()].flatMap((w) => {
      const t = w.tags ?? {};
      const height = Number(t.height ?? NaN) - Number(t["roof:height"] ?? 0);
      const eaves = Number.isFinite(height) ? height : Number(t["building:levels"] ?? NaN) * 3.2;
      if (!t["building:part"] || t["building:part"] === "no" || t.building || !Number.isFinite(eaves)) return [];
      const pts = w.nodes.slice(1).flatMap((id) => {
        const n = SOURCE_OSM.nodes.get(id);
        return n ? [geoToWorld(n.lat, n.lon)] : [];
      });
      const c = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, z: pts.reduce((s, p) => s + p.z, 0) / pts.length };
      const over = kept.filter((b) => inOutline(c.x, c.z, b.outline, b.x, b.z));
      if (pts.length === 0 || over.length === 0) return [];
      const top = Math.max(...over.map((b) => b.y + b.height)) - Math.min(...over.map((b) => b.y + b.plinth));
      return top < eaves - 3.2 ? [{ at: near(c.x, c.z), what: `w${w.id} walls to ${eaves.toFixed(1)} m, the game's to ${top.toFixed(1)} m` }] : [];
    });
  },
  /**
   * A marketplace of the map data (`amenity=marketplace`, G-064) with fewer than one stall per
   * 150 m² of its open ground (sampled every metre, the chunks' rectangles in, its buildings out):
   * a market square left as bare paving.
   */
  "marketplace-empty": () => {
    const stalls = Object.values(WORLD_STREET_PROPS)
      .flat()
      .filter((i) => i.prop === "market-stall");
    return [...SOURCE_OSM.ways.values()].flatMap((w) => {
      if (w.tags?.amenity !== "marketplace") return [];
      const ring = w.nodes.flatMap((id) => {
        const n = SOURCE_OSM.nodes.get(id);
        return n ? [geoToWorld(n.lat, n.lon)] : [];
      });
      if (ring.length < 4) return [];
      const xs = ring.map((p) => p.x);
      const zs = ring.map((p) => p.z);
      let area = 0;
      for (let x = Math.floor(Math.min(...xs)) + 0.5; x < Math.max(...xs); x++)
        for (let z = Math.floor(Math.min(...zs)) + 0.5; z < Math.max(...zs); z++) if (onChunk(x, z) && pointInRing({ x, z }, ring) && !inBuilding(x, z)) area++;
      const n = stalls.filter((i) => pointInRing(i, ring)).length;
      return area >= 150 && n * 150 < area ? [{ at: near(ring[0]!.x, ring[0]!.z), what: `w${w.id} ${w.tags.name ?? ""}: ${n} stalls on ${area} m²` }] : [];
    });
  },
  /**
   * A church with parts from the map lifted onto it (its nave, turrets, chapels, G-049) whose block
   * the renderer still crowns with bell towers of its own, matching nothing in the data (G-057).
   */
  "church-towers-over-parts": () => {
    const sources = MAP_CHUNKS.flatMap((c) => c.buildings.filter((b) => !clearedBuilding(b))).map((b): BuildingSource => {
      const view = buildingView(b) as BuildingSource["view"];
      return { ring: cleanRing(view.outline.map((p) => ({ x: p.x + b.x, z: p.z + b.z }))), view, at: { x: b.x, y: b.y, z: b.z } };
    });
    const lifted = sources.filter((s) => s.view.soffit !== undefined);
    return sources.flatMap((s, i) => {
      if (s.view.use !== "church" || s.view.soffit !== undefined || !lifted.some((p) => pointInRing(centroid(p.ring), s.ring))) return [];
      const sink = new MeshSink();
      planFarBuilding(sink, facadeFrame(mapBuilding(i + 1, s, () => null, lifted), () => null));
      const top = Math.max(...sink.positions.filter((_, k) => k % 3 === 1)) - (s.at.y + s.view.height + (s.view.roof ?? 0));
      return top > 0.5 ? [{ at: near(s.at.x, s.at.z), what: `${s.view.name ?? "church"}: ${top.toFixed(1)} m over its roof` }] : [];
    });
  },
};

describe("the glitch scan (ADR-0054)", () => {
  it("stacks Grodzka 36a 5 m back from the Grodzka Gate instead of over it (G-050)", () => {
    const house = MAP_CHUNKS.flatMap((c) => c.buildings.map((b) => ({ b, district: c.district }))).find(({ b }) => b.id === "w66293355")!;
    const gate = MAP_CHUNKS.flatMap((c) => c.buildings).find((b) => b.name === "Brama Grodzka")!;
    const view = buildingView(house.b, house.district);
    if (view.kind !== "building") throw new Error("not a building");
    expect(view.vertical?.rise).toBeGreaterThan(0);
    const tiers = tiersOf(view, house.b, worldOutline(house.b), 1);
    expect(tiers.length).toBeGreaterThan(0);
    const gateTop = gate.y + gate.height + (gate.roof ?? 0);
    for (const t of tiers) if (t.y1 > gateTop) expect(ringGap(t.ring, worldOutline(gate))).toBeGreaterThanOrEqual(5);
  });

  it("finds no more glitches of any known kind than its baseline", () => {
    const found = Object.fromEntries(Object.entries(CHECKS).map(([k, check]) => [k, check()]));
    const counts = Object.fromEntries(Object.entries(found).map(([k, f]) => [k, f.length]));
    mkdirSync("reports", { recursive: true });
    writeFileSync("reports/glitch-scan.json", JSON.stringify({ counts, found }, null, 2));
    if (process.env.GLITCH_BASELINE === "update" || !existsSync(BASELINE)) writeFileSync(BASELINE, `${JSON.stringify(counts, null, 2)}\n`);
    const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as Record<string, number>;
    for (const [k, n] of Object.entries(counts)) expect(n, `${k}: ${n} found, baseline ${baseline[k] ?? 0} (see reports/glitch-scan.json)`).toBeLessThanOrEqual(baseline[k] ?? 0);
  });
});
