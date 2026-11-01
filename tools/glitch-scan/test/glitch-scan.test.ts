import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { type StreetPropItem, VEHICLE_SIZE, terrainHeightAt } from "../../../packages/core/src";
import { planSteps } from "../../../packages/engine/src/renderer/mapcity/steps-plan";
import { lampWallLantern } from "../../../packages/engine/src/renderer/mapcity/prop-lamps";
import { facadeFrame } from "../../../packages/engine/src/renderer/mapcity/facade-frame";
import { planFarBuilding } from "../../../packages/engine/src/renderer/mapcity/facade-plan";
import { landmarkAt } from "../../../packages/engine/src/renderer/mapcity/landmarks";
import { LANDMARK_RECIPES } from "../../../packages/engine/src/renderer/mapcity/landmarks/recipes";
import { type BuildingSource, mapBuilding } from "../../../packages/engine/src/renderer/mapcity/map-building";
import { centroid, cleanRing, pointInRing } from "../../../packages/engine/src/renderer/mapcity/polygon";
import { stackTiers } from "../../../packages/engine/src/renderer/mapcity/vertical-plan";
import { MeshSink } from "../../../packages/engine/src/renderer/mesh-sink";
import { MAP_SIGN_KIND } from "../../../packages/engine/src/renderer/mapcity/sign-plan";
import { signsInNeighbours } from "./sign-neighbours";
import { SMALL_ALONE_AREA, smallAlone } from "../../osm-import/src/building-alone.ts";
import { extractFeatures } from "../../osm-import/src/features.ts";
import { roadWidth } from "../../osm-import/src/ground.ts";
import { oneway } from "../../osm-import/src/markings.ts";
import { mergeOsm, parseExtract } from "../../osm-import/src/osm.ts";
import { SHAPES } from "../../osm-import/src/props-kinds.ts";
import { addressOf } from "../../osm-import/src/labels.ts";
import { geoToWorld } from "../../osm-import/src/project.ts";
import { cityVenueBoards } from "../../osm-import/src/venue-boards.ts";
import { CROWD_LANES } from "../../../packages/sim/src/content/crowd";
import { INTERIORS, interiorAt } from "../../../packages/sim/src/content/interior-areas";
import { CLINIC_DOOR, KOI_DOOR } from "../../../packages/sim/src/content/interiors";
import { furnitureClearance } from "../../../packages/sim/src/content/furniture-index";
import { BOLLARD, alongSegment, anchors, chainSegments, chainThrough, distanceToPiece, furniturePrisms, furnitureRadius, turnLocal } from "../../../packages/sim/src/content/lublin/furniture";
import { buildingView, isLandmark } from "../../../packages/sim/src/content/lublin";
import { inBuilding, nearestWall } from "../../../packages/sim/src/content/lublin/places";
import { ROAD_CHAINS, type RoadChain, polylineLength, surfaceLiftAt, surfacesAt } from "../../../packages/sim/src/content/lublin/roads";
import { clearedBuilding } from "../../../packages/sim/src/content/cleared-buildings";
import { CLEARED_BUILDINGS, MAP_CHUNKS, PASSAGES, ROOM_SITES } from "../../../packages/sim/src/content/lublin/sites";
import { groundY } from "../../../packages/sim/src/content/lublin/terrain";
import { BRIDGE_DECKS, bridgeDeckAt } from "../../../packages/sim/src/content/lublin/decks";
import { WORLD_CHUNKS, WORLD_SCENERY } from "../../../packages/sim/src/content/world-map";
import { type GroundDeck, deckAt } from "../../../packages/sim/src/world/deck";
import { GroundField } from "../../../packages/sim/src/world/ground";
import { type Prism, circleTouchesPrism, makePrism, prismsAt } from "../../../packages/sim/src/world/prism";
import { groundAt } from "../../../packages/sim/src/systems/movement-system";
import { PARKED_CARS } from "../../../packages/sim/src/content/parked-cars";
import { GAME_PROPS, WORLD_STREET_PROPS } from "../../../packages/sim/src/content/street-props";
import { crossingBands, inCrossingBand } from "../../../packages/sim/src/content/lublin/crossing-bands";
import { CAR_MODELS, MIN_ROUTE, TRAFFIC_LANES, TRAFFIC_ROUTES, type TrafficRoute, pointAt, projectOn, roadHalfWidth } from "../../../packages/sim/src/content/traffic";

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

/** The outlines of a passage's building (worked out on first use: `worldOutline` comes later in the file). */
const passageRings = (() => {
  const memo = new Map<string, Pt[][]>();
  return (id: string) => memo.get(id) ?? memo.set(id, MAP_CHUNKS.flatMap((c) => c.buildings).filter((b) => b.id === id).map((b) => worldOutline(b))).get(id)!;
})();

/** Where (x, z) is along a passage and how far off its axis, when the axis there runs under the passage's building; else null. */
const underVault = (p: (typeof PASSAGES)[number], x: number, z: number): { s: number; off: number } | null => {
  const len = Math.hypot(p.to.x - p.from.x, p.to.z - p.from.z);
  const [ux, uz] = [(p.to.x - p.from.x) / len, (p.to.z - p.from.z) / len];
  const s = (x - p.from.x) * ux + (z - p.from.z) * uz;
  const off = (x - p.from.x) * uz - (z - p.from.z) * ux;
  if (s < 0 || s > len || Math.abs(off) > p.width / 2 + 3) return null;
  const axis = { x: p.from.x + ux * s, z: p.from.z + uz * s };
  return passageRings(p.building).some((r) => pointInRing(axis, r)) ? { s, off } : null;
};

/** The landmarks of the curator's audits (docs/topografia.md): buildings by map id, and the statues of Plac Litewski. */
const LANDMARK_BUILDINGS = [
  ...["r7224409", "w66286371", "w66286341", "w66264159", "w66264120", "w232362876", "w66286338", "r2366732"],
  ...["w48500136", "w450180469", "w66258167", "w67508958", "w66330578"],
];
const LANDMARK_MONUMENTS = ["n481952877", "n481952879", "n481952880"];

const near = (x: number, z: number) => `${x.toFixed(0)},${z.toFixed(0)}`;

/** The lantern of the wall lantern's model (its points over 0.5 m out from the wall plate), in the piece's frame. */
const LANTERN_HEAD = (() => {
  const p = lampWallLantern(0).sink.positions;
  const out: { x: number; y: number; z: number }[] = [];
  for (let k = 0; k < p.length; k += 3) if (p[k + 2]! > 0.5) out.push({ x: p[k]!, y: p[k + 1]!, z: p[k + 2]! });
  return out;
})();
const inMap = (x: number, z: number) => MAP_CHUNKS.some((c) => x > c.bounds.minX + 1 && x < c.bounds.maxX - 1 && z > c.bounds.minZ + 1 && z < c.bounds.maxZ - 1);
const onChunk = (x: number, z: number) => MAP_CHUNKS.some(({ bounds: b }) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ);
/** Distance from (x, z) to the segment a-b. */
const segmentGap = (x: number, z: number, a: { x: number; z: number }, b: { x: number; z: number }) => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const k = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(a.x + dx * k - x, a.z + dz * k - z);
};
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

/** Top of what the renderer draws at (x, z): the ground and the highest paving of its level there (a bridge's deck or the terrain). */
const drawnAt = (x: number, z: number) => {
  const y = groundY(x, z);
  return y + surfaceLiftAt(x, z, bridgeDeckAt(x, z) === y);
};

/** Every vehicle standing still: parked cars and set pieces' car, van and wreck blocks, with the drawn surface under a 3 x 3 grid of the footprint. */
const standingVehicles = (() => {
  let memo: { at: string; what: string; bottom: number; under: number[] }[] | null = null;
  const grid = (x: number, z: number, ax: number, az: number, bx: number, bz: number) =>
    [-0.5, 0, 0.5].flatMap((a) => [-0.5, 0, 0.5].map((b) => drawnAt(x + ax * a + bx * b, z + az * a + bz * b)));
  return () => {
    memo ??= [
      ...PARKED_CARS.map((c) => {
        const { width, length } = VEHICLE_SIZE[c.model];
        const fx = Math.sin(c.yaw);
        const fz = Math.cos(c.yaw);
        return { at: near(c.x, c.z), what: c.model, bottom: c.y, under: grid(c.x, c.z, fz * width, -fx * width, fx * length, fz * length) };
      }),
      ...GAME_PROPS.flatMap((p) => {
        const style = p.view.kind === "block" ? p.view.skin?.style : undefined;
        if (p.view.kind !== "block" || (style !== "car" && style !== "van" && style !== "wreck")) return [];
        const { x, y, z } = p.view.size;
        return [{ at: near(p.center.x, p.center.z), what: style, bottom: p.center.y - y / 2, under: grid(p.center.x, p.center.z, x, 0, 0, z) }];
      }),
    ];
    return memo;
  };
})();

/** The map buildings' signs of these kinds in another building (G-157, G-159). */
const signsIn = (kinds: readonly number[]): Finding[] =>
  signsInNeighbours()
    .filter((s) => kinds.includes(s.kind))
    .map((s) => ({ at: near(s.x, s.z), what: `${s.building} kind ${s.kind} at y ${s.y.toFixed(1)} in ${s.neighbour} (${s.points} points)` }));

/** Tag values of things on a facade or in the paving, not free-standing (G-149). */
const FLAT_ART = new Set(["plaque", "stolperstein", "mural", "mosaic", "graffiti", "relief"]);

/** Do a monument's tags bear out its shape (`monument-shape-off-tags`)? */
const tagsBearOut = (shape: string, t: Readonly<Record<string, string>>): boolean => {
  if (FLAT_ART.has(t.memorial ?? "") || FLAT_ART.has(t.artwork_type ?? "")) return false;
  const kozio = /kozio/i.test(t.name ?? "");
  if (shape === "obelisk") return t.memorial === "obelisk" || /obelisk|unii/i.test(t.name ?? "");
  if (shape === "figure") return !kozio && (["statue", "bust"].includes(t.memorial ?? "") || ["statue", "bust", "sculpture"].includes(t.artwork_type ?? ""));
  if (shape === "koziolek") return kozio;
  if (shape === "abstract") return !kozio && t.artwork_type === "sculpture";
  return true;
};

const CHECKS: Readonly<Record<string, () => Finding[]>> = {
  /**
   * A car lane off every road surface (on grass, a square, a pavement), away from the map's edges.
   * Lane by lane, so a junction's join does not move the samples; the joins' arcs, straight on too,
   * have `turn-off-road`.
   */
  "car-lane-off-road": () =>
    carLanes.flatMap((r) => along(r, 3).filter((p) => inMap(p.x, p.z) && !surfacesAt(p.x, p.z).some((s) => s === "road" || s === "crossing" || s === "cobble")).map((p) => ({ at: near(p.x, p.z), what: r.id }))),
  /**
   * A point of a lane (every use, every metre) with no paving under it at all, or where the
   * ground the simulation walks (`GroundField`) and the map's `groundY` part by over 0.2 m: off
   * the map, where the one takes the nearest chunk and the other 0 (G-138). The edges too, unlike
   * `car-lane-off-road`.
   */
  "lane-off-ground": () =>
    TRAFFIC_LANES.flatMap((r) =>
      along(r, 1)
        .filter((p) => surfacesAt(p.x, p.z).length === 0 || Math.abs(FIELD.heightAt(p.x, p.z) - groundY(p.x, p.z)) > 0.2)
        .map((p) => ({ at: near(p.x, p.z), what: `${r.id} at ${p.s.toFixed(0)}` })),
    ),
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
      .filter((i) => ["artwork", "monument", "kiosk", "bus-shelter", "bench", "vending-machine", "advertising-column", "atm", "bike-rack", "food-cart", "container"].includes(i.prop))
      .flatMap((i) => (nearestWall(i.x, i.z).d < furnitureRadius(i) - 0.3 ? [{ at: near(i.x, i.z), what: i.prop }] : [])),
  /**
   * A market stall whose canvas (2.4 x 1.8 m at 2.35 m) reaches over a container or a food cart
   * (ADR-0058 stage 2): the cart's roof and the container's wall stand higher than the canvas.
   */
  "stall-canvas-over-piece": () => {
    const all = Object.values(WORLD_STREET_PROPS).flat();
    const pieces = all.filter((i) => i.prop === "container" || i.prop === "food-cart");
    return all
      .filter((s) => s.prop === "market-stall")
      .flatMap((s) => {
        const close = pieces.filter((o) => Math.hypot(o.x - s.x, o.z - s.z) < 8);
        for (let a = -1.2; a <= 1.2 + 1e-9; a += 0.1)
          for (let b = -0.9; b <= 0.9 + 1e-9; b += 0.1) {
            const q = turnLocal(s.yaw, a, b);
            const hit = close.find((o) => distanceToPiece(o, s.x + q.x, s.z + q.z) === 0);
            if (hit) return [{ at: near(s.x, s.z), what: hit.prop }];
          }
        return [];
      });
  },
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
  /**
   * A parked car whose body (sampled every eighth of its length and width) comes nearer than
   * 1.5 m to the axis of a service road of the map data (a driveway, a yard's lane; not a car
   * park's aisle): it stands across the road's mouth (G-140).
   */
  "parked-car-on-service-road": () => {
    const ways = extractFeatures(SOURCE_OSM).lines.filter((l) => l.tags.highway === "service" && l.tags.service !== "parking_aisle" && l.tags.area !== "yes" && Number(l.tags.layer ?? 0) >= 0);
    const segs = ways.flatMap((l) => l.line.slice(1).map((b, i) => ({ id: l.id, a: l.line[i]!, b })));
    return PARKED_CARS.flatMap((c) => {
      const { width, length } = VEHICLE_SIZE[c.model];
      const fx = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      const body = [0, 1, 2, 3, 4, 5, 6, 7, 8].flatMap((i) => [0, 1, 2, 3, 4, 5, 6, 7, 8].map((k) => ({ x: c.x + fz * width * (i / 8 - 0.5) + fx * length * (k / 8 - 0.5), z: c.z - fx * width * (i / 8 - 0.5) + fz * length * (k / 8 - 0.5) })));
      const hit = segs.find(({ a, b }) => Math.max(a.x, b.x) > c.x - 8 && Math.min(a.x, b.x) < c.x + 8 && Math.max(a.z, b.z) > c.z - 8 && Math.min(a.z, b.z) < c.z + 8 && body.some((p) => segmentGap(p.x, p.z, a, b) < 1.5));
      return hit ? [{ at: near(c.x, c.z), what: `${c.model} on ${hit.id}` }] : [];
    });
  },
  /**
   * A parked car whose body (sampled every eighth of its length and width) comes nearer than 1 m
   * to the axis of a footway, path, pedestrian street or cycleway of the map data mapped on its
   * own (not a sidewalk along a kerb, not a crossing; on the ground, off bridges and tunnels): it
   * stands on the walkers' or the riders' way (G-143, G-156).
   */
  "parked-car-on-footway": () => {
    const ways = extractFeatures(SOURCE_OSM).lines.filter(
      ({ tags: t }) =>
        (t.highway === "footway" || t.highway === "path" || t.highway === "pedestrian" || t.highway === "cycleway") &&
        t.footway !== "sidewalk" &&
        t.path !== "sidewalk" &&
        t.footway !== "crossing" &&
        t.path !== "crossing" &&
        t.cycleway !== "crossing" &&
        t.area !== "yes" &&
        t.tunnel === undefined &&
        t.covered === undefined &&
        (t.bridge === undefined || t.bridge === "no") &&
        Number(t.layer ?? 0) === 0,
    );
    const segs = ways.flatMap((l) => l.line.slice(1).map((b, i) => ({ id: l.id, a: l.line[i]!, b })));
    return PARKED_CARS.flatMap((c) => {
      const { width, length } = VEHICLE_SIZE[c.model];
      const fx = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      const body = [0, 1, 2, 3, 4, 5, 6, 7, 8].flatMap((i) => [0, 1, 2, 3, 4, 5, 6, 7, 8].map((k) => ({ x: c.x + fz * width * (i / 8 - 0.5) + fx * length * (k / 8 - 0.5), z: c.z - fx * width * (i / 8 - 0.5) + fz * length * (k / 8 - 0.5) })));
      const hit = segs.find(({ a, b }) => Math.max(a.x, b.x) > c.x - 8 && Math.min(a.x, b.x) < c.x + 8 && Math.max(a.z, b.z) > c.z - 8 && Math.min(a.z, b.z) < c.z + 8 && body.some((p) => segmentGap(p.x, p.z, a, b) < 1));
      return hit ? [{ at: near(c.x, c.z), what: `${c.model} on ${hit.id}` }] : [];
    });
  },
  /**
   * A parked car at a bus stop of the map data (a `highway=bus_stop` or `public_transport=platform`
   * node, or a platform way's vertex): its middle nearer the stop's post than 15 m and half its
   * length along the street the post stands by (its nearest car road, within 20 m), less than 7 m
   * across, on the post's side of that street. The Polish code (art. 49 ust. 1 pkt 9 PoRD) bans
   * stopping there (G-156).
   */
  "parked-car-at-bus-stop": () => {
    const { lines, areas } = extractFeatures(SOURCE_OSM);
    const platform = (t: Readonly<Record<string, string>>) => t.highway === "bus_stop" || t.public_transport === "platform" || t.highway === "platform";
    const posts = [
      ...[...SOURCE_OSM.nodes.values()].filter((n) => n.tags && platform(n.tags)).map((n) => ({ id: `n${n.id}`, ...geoToWorld(n.lat, n.lon) })),
      ...[...lines.map((l) => ({ id: l.id, tags: l.tags, pts: l.line })), ...areas.map((a) => ({ id: a.id, tags: a.tags, pts: a.ring }))].filter((w) => platform(w.tags)).flatMap((w) => w.pts.map((p) => ({ id: w.id, ...p }))),
    ];
    const roadKinds = new Set(["primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link", "residential", "unclassified", "living_street"]);
    const segs = lines.filter((l) => roadKinds.has(l.tags.highway ?? "")).flatMap((l) => l.line.slice(1).map((b, i) => ({ a: l.line[i]!, b })));
    return PARKED_CARS.flatMap((c) => {
      const hit = posts.find((p) => {
        if (Math.hypot(p.x - c.x, p.z - c.z) > 30) return false;
        const by = segs.map((s) => ({ s, d: segmentGap(p.x, p.z, s.a, s.b) })).filter((q) => q.d < 20).sort((x, y) => x.d - y.d)[0]?.s;
        if (!by) return false;
        const len = Math.hypot(by.b.x - by.a.x, by.b.z - by.a.z);
        const [tx, tz] = [(by.b.x - by.a.x) / len, (by.b.z - by.a.z) / len];
        const sideOf = (x: number, z: number) => Math.sign((x - by.a.x) * tz - (z - by.a.z) * tx);
        const along = Math.abs((c.x - p.x) * tx + (c.z - p.z) * tz);
        const across = Math.abs((c.x - p.x) * tz - (c.z - p.z) * tx);
        return sideOf(c.x, c.z) === sideOf(p.x, p.z) && along < 15 + VEHICLE_SIZE[c.model].length / 2 && across < 7;
      });
      return hit ? [{ at: near(c.x, c.z), what: `${c.model} ${Math.hypot(hit.x - c.x, hit.z - c.z).toFixed(1)} m from ${hit.id}` }] : [];
    });
  },
  /**
   * A parked car by the kerb of a street with two lanes or more a way (`lanes` 4 or more, or
   * `lanes:forward` or `lanes:backward` 2 or more) and outside every car park (`amenity=parking`)
   * of the map data: it stands on the outer lane (G-155). Its street is the car road of the map
   * data whose axis runs nearest within 12 m and within 20° of the car.
   */
  "parked-car-multilane-kerb": () => {
    const { lines, areas } = extractFeatures(SOURCE_OSM);
    const roadKinds = new Set(["primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link", "residential", "unclassified", "living_street"]);
    const segs = lines.filter((l) => roadKinds.has(l.tags.highway ?? "")).flatMap((l) => l.line.slice(1).map((b, i) => ({ way: l, a: l.line[i]!, b })));
    const parks = areas.filter((a) => a.tags.amenity === "parking");
    const multiLane = (t: Readonly<Record<string, string>>) => Number(t.lanes ?? 0) >= 4 || Number(t["lanes:forward"] ?? 0) >= 2 || Number(t["lanes:backward"] ?? 0) >= 2;
    return PARKED_CARS.flatMap((c) => {
      const fx = Math.sin(c.yaw);
      const fz = Math.cos(c.yaw);
      const by = segs
        .map((s) => ({ s, d: segmentGap(c.x, c.z, s.a, s.b), len: Math.hypot(s.b.x - s.a.x, s.b.z - s.a.z) }))
        .filter((q) => q.d < 12 && q.len > 0 && Math.abs(((q.s.b.x - q.s.a.x) * fx + (q.s.b.z - q.s.a.z) * fz) / q.len) >= Math.cos((20 * Math.PI) / 180))
        .sort((x, y) => x.d - y.d)[0];
      if (!by || !multiLane(by.s.way.tags) || parks.some((p) => pointInRing({ x: c.x, z: c.z }, p.ring))) return [];
      return [{ at: near(c.x, c.z), what: `${c.model} ${by.d.toFixed(1)} m from ${by.s.way.id} (lanes ${by.s.way.tags.lanes ?? "?"})` }];
    });
  },
  /** A game block standing on the ground (not an awning or a deck) that floats or sinks. */
  "prop-off-ground": () =>
    GAME_PROPS.flatMap((p) => {
      if (p.view.kind !== "block" || !p.solid || p.view.size.y < 0.8) return [];
      const gap = p.center.y - p.view.size.y / 2 - groundY(p.center.x, p.center.z);
      return (gap > 0.15 && gap < 1) || gap < -0.3 ? [{ at: near(p.center.x, p.center.z), what: `${p.view.skin?.style ?? p.view.material} ${gap.toFixed(2)} m` }] : [];
    }),
  /**
   * A vehicle (a parked car, a set piece's car, van or wreck) whose bottom lies more than 0.1 m
   * under the surface drawn beneath it (G-130): the renderer drapes each surface its own lift over
   * the terrain (`SURFACE_LIFT`), so wheels set on the bare terrain sink into the paving.
   */
  "vehicle-below-surface": () =>
    standingVehicles().flatMap((v) => {
      const worst = Math.max(...v.under) - v.bottom;
      return worst > 0.1 ? [{ at: v.at, what: `${v.what} ${worst.toFixed(2)} m` }] : [];
    }),
  /**
   * A vehicle whose bottom lies more than 0.15 m over the surface drawn under its lower side
   * (G-130): a level body on a slope lifts off the paving downhill. Set pieces' vehicles standing
   * on something else than the map's paving (the market's overpass) aside.
   */
  "vehicle-off-surface": () =>
    standingVehicles().flatMap((v) => {
      const gap = v.bottom - Math.min(...v.under);
      return gap > 0.15 && v.bottom - Math.max(...v.under) < 1 ? [{ at: v.at, what: `${v.what} ${gap.toFixed(2)} m` }] : [];
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
   * A landmark from the curator's list (docs/topografia.md) with no building in the game: off
   * every chunk of the map (G-052) or cleared by a set piece.
   */
  "landmark-missing": () => {
    const kept = new Set(MAP_CHUNKS.flatMap((c) => c.buildings.filter((b) => !clearedBuilding(b)).map((b) => b.id)));
    const buildings = LANDMARK_BUILDINGS.filter((id) => !kept.has(id)).map((id) => {
      const w = id.startsWith("w") ? SOURCE_OSM.ways.get(Number(id.slice(1))) : undefined;
      const n = w && SOURCE_OSM.nodes.get(w.nodes[0]!);
      const at = n ? geoToWorld(n.lat, n.lon) : { x: 0, z: 0 };
      return { at: near(at.x, at.z), what: `${id} ${w?.tags?.name ?? ""}`.trim() };
    });
    const monuments = Object.values(WORLD_STREET_PROPS)
      .flat()
      .filter((i) => i.prop === "monument");
    const statues = LANDMARK_MONUMENTS.flatMap((id) => {
      const n = SOURCE_OSM.nodes.get(Number(id.slice(1)));
      const at = n ? geoToWorld(n.lat, n.lon) : null;
      if (at && monuments.some((m) => Math.hypot(m.x - at.x, m.z - at.z) <= 1)) return [];
      return [{ at: at ? near(at.x, at.z) : "?", what: `${id} ${n?.tags?.name ?? ""}`.trim() }];
    });
    return [...buildings, ...statues];
  },
  /**
   * A monument or an artwork whose shape its OSM tags do not bear out (G-149), judged by the
   * tagged node nearest within 3 m: anything standing for a plaque, a stumbling stone, a mural or
   * a mosaic; an obelisk not named one (or the Union); a figure not tagged statue, bust or
   * sculpture, or a Koziołek as a figure; a Koziołek not named one; an abstract sculpture not
   * tagged `artwork_type=sculpture` (with no node near either). Other shapes are neutral.
   */
  "monument-shape-off-tags": () => {
    const nodes = [...SOURCE_OSM.nodes.values()].flatMap((n) => {
      const t = n.tags ?? {};
      return t.tourism === "artwork" || t.historic === "memorial" || t.historic === "monument" || t.historic === "wayside_shrine" || t.historic === "wayside_cross" ? [{ t, ...geoToWorld(n.lat, n.lon) }] : [];
    });
    return Object.values(WORLD_STREET_PROPS)
      .flat()
      .filter((i) => i.prop === "monument" || i.prop === "artwork")
      .flatMap((i) => {
        const shape = ["obelisk", "figure", "koziolek", "abstract"][i.variant % (SHAPES[i.prop] ?? 1)] ?? "neutral";
        const by = nodes.map((n) => ({ n, d: Math.hypot(n.x - i.x, n.z - i.z) })).filter((q) => q.d < 3).sort((a, b) => a.d - b.d)[0]?.n;
        const ok = by ? tagsBearOut(shape, by.t) : shape !== "abstract";
        const t = by?.t ?? {};
        return ok ? [] : [{ at: near(i.x, i.z), what: `${i.prop} ${shape}: ${t.name ?? "no tagged node"} ${t.memorial ?? t.artwork_type ?? ""}`.trim() }];
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
  /**
   * A small building standing on its own (under `SMALL_ALONE_AREA`, no other outline within 1 m:
   * a pavilion, a kiosk, a shed) raised to the district's default houses when the map gives it no
   * height (G-127: Bar Centralny by Pedet, 4 storeys for a round one-storey pavilion).
   */
  "small-freestanding-tall": () => {
    const all = MAP_CHUNKS.flatMap((c) => c.buildings.filter((b) => !clearedBuilding(b)));
    const areas = all.map((b) => ({ id: b.id, tags: {}, ring: worldOutline(b), holes: 0 }) as unknown as Parameters<typeof smallAlone>[0][number]);
    const alone = smallAlone(areas);
    return all.filter((b) => alone.has(b.id) && b.source === "default" && b.levels > 1).map((b) => ({ at: near(b.x, b.z), what: `${b.id} ${b.levels} storeys on ${SMALL_ALONE_AREA} m² or less` }));
  },
  /**
   * A building the map puts under ground (`location=underground`: a cellar, a shelter, G-077)
   * standing as a solid on the street over it.
   */
  "building-underground-solid": () => {
    const under = new Set([
      ...[...SOURCE_OSM.ways.values()].filter((w) => w.tags?.building !== undefined && w.tags.location === "underground").map((w) => `w${w.id}`),
      ...[...SOURCE_OSM.relations.values()].filter((r) => r.tags?.building !== undefined && r.tags.location === "underground").map((r) => `r${r.id}`),
    ]);
    return MAP_CHUNKS.flatMap((c) => c.buildings.filter((b) => !clearedBuilding(b) && under.has(b.id.split("/")[0]!))).map((b) => ({ at: near(b.x, b.z), what: `${b.id} under ground, ${b.height} m over the street` }));
  },
  /**
   * A passage whose way the map signs with a clearance (`maxheight`, in metres or `below_default`,
   * under 4 m) lower than the game's vault over it (G-089): the passage's middle within 1.5 m of the way.
   */
  "passage-maxheight": () =>
    [...SOURCE_OSM.ways.values()].flatMap((w) => {
      const t = w.tags ?? {};
      const max = t.maxheight === "below_default" ? 4 : Number(/^\s*(\d+(?:[.,]\d+)?)\s*m?\s*$/.exec(t.maxheight ?? "")?.[1]?.replace(",", ".") ?? NaN);
      if (!t.highway || !(max <= 4)) return [];
      const pts = w.nodes.flatMap((id) => {
        const n = SOURCE_OSM.nodes.get(id);
        return n ? [geoToWorld(n.lat, n.lon)] : [];
      });
      const off = (p: Pt) =>
        Math.min(
          ...pts.slice(1).map((b, i) => {
            const a = pts[i]!;
            const dx = b.x - a.x;
            const dz = b.z - a.z;
            const u = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
            return Math.hypot(a.x + dx * u - p.x, a.z + dz * u - p.z);
          }),
        );
      const tooHigh = (h: number) => (t.maxheight === "below_default" ? h >= max : h > max + 0.01);
      return PASSAGES.filter((p) => off({ x: (p.from.x + p.to.x) / 2, z: (p.from.z + p.to.z) / 2 }) < 1.5 && tooHigh(p.height)).map((p) => ({ at: near(p.from.x, p.from.z), what: `w${w.id} maxheight=${t.maxheight}, vault ${p.height} m in ${p.building}` }));
    }),
  /**
   * A city gate's passage (`historic=city_gate`, G-136) with a mouth more than 0.5 m off the middle
   * of the front's clean part: the wall it opens in, less the stretches a neighbouring building
   * stands in front of (within 0.35 m), sampled every centimetre.
   */
  "gate-mouth-off-axis": () => {
    const kept = MAP_CHUNKS.flatMap((c) => c.buildings.filter((b) => !clearedBuilding(b)));
    return PASSAGES.flatMap((p) => {
      const b = kept.find((q) => q.id === p.building);
      if (!b || osmTags(b.id).historic !== "city_gate") return [];
      const ring = cleanRing(worldOutline(b));
      const others = kept.filter((q) => q !== b && Math.hypot(q.x - b.x, q.z - b.z) < 60).map(worldOutline);
      const [dx, dz] = [p.to.x - p.from.x, p.to.z - p.from.z];
      return ring.flatMap((a, i) => {
        const c = ring[(i + 1) % ring.length]!;
        const [ex, ez] = [c.x - a.x, c.z - a.z];
        const len = Math.hypot(ex, ez);
        const den = dx * ez - dz * ex;
        const t = ((a.x - p.from.x) * ez - (a.z - p.from.z) * ex) / den;
        const s = ((a.x - p.from.x) * dz - (a.z - p.from.z) * dx) / den;
        if (Math.abs(den) < 1e-9 || t < 0 || t > 1 || s < 0 || s > 1) return [];
        const out = pointInRing({ x: a.x + ex / 2 + (ez / len) * 0.1, z: a.z + ez / 2 - (ex / len) * 0.1 }, ring) ? -1 : 1;
        const at = (u: number, o: number) => ({ x: a.x + (ex / len) * u + (ez / len) * o * out, z: a.z + (ez / len) * u - (ex / len) * o * out });
        const clean = (k: number) => ![0.05, 0.15, 0.25, 0.35].some((o) => others.some((r) => pointInRing(at(k / 100, o), r)));
        const mouth = Math.round(s * len * 100);
        let [k0, k1] = [mouth, mouth];
        while (k0 > 0 && clean(k0 - 1)) k0--;
        while (k1 < Math.floor(len * 100) && clean(k1 + 1)) k1++;
        const off = s * len - (k0 + k1) / 200;
        const m = at(s * len, 0);
        return Math.abs(off) > 0.5 ? [{ at: near(m.x, m.z), what: `${b.id} ${b.name ?? ""}: mouth ${off.toFixed(2)} m off the middle of ${((k1 - k0) / 100).toFixed(2)} m of clean front` }] : [];
      });
    });
  },
  /**
   * A route's vehicle reaching out of a passage under a building (G-136): a point of the route
   * every quarter metre under the building (the passage's axis there inside the outline) where
   * half the widest vehicle of the route's kind, from its line, is past half the passage's width.
   */
  "vehicle-outside-passage": () => {
    const widest = (r: TrafficRoute) => (r.use === "trolley" ? VEHICLE_SIZE.trolleybus.width : r.use === "deliveries" ? Math.max(VEHICLE_SIZE.van.width, VEHICLE_SIZE.delivery.width) : Math.max(...CAR_MODELS.map(([m]) => VEHICLE_SIZE[m].width)));
    return TRAFFIC_ROUTES.flatMap((r) =>
      PASSAGES.flatMap((p) => {
        const out = along(r, 0.25).flatMap((q) => {
          const v = underVault(p, q.x, q.z);
          return v && Math.abs(v.off) + widest(r) / 2 > p.width / 2 ? [Math.abs(v.off)] : [];
        });
        return out.length > 0 ? [{ at: near(p.from.x, p.from.z), what: `${r.id} through ${p.building}: ${Math.max(...out).toFixed(2)} m off the axis` }] : [];
      }),
    );
  },
  /** A wall lantern under a passage's vault (G-136; `furniture-in-building` passes wall lanterns over): within half the passage's width and 0.5 m of its axis, under the building. */
  "wall-lantern-in-passage": () =>
    Object.values(WORLD_STREET_PROPS)
      .flat()
      .filter((i) => i.prop === "lamp-wall-lantern")
      .flatMap((i) => PASSAGES.filter((p) => Math.abs(underVault(p, i.x, i.z)?.off ?? Infinity) < p.width / 2 + 0.5).map((p) => ({ at: near(i.x, i.z), what: `lamp-wall-lantern in ${p.building}` }))),
  /**
   * A wall lantern hung in front of a venue's board (G-158): the lantern of the drawn model
   * (`prop-lamps.ts`, turned by the piece's yaw) out in front of the board's face and over it,
   * along the wall and in height.
   */
  "wall-lantern-over-venue-board": () => {
    const boards = cityVenueBoards(WORLD_SCENERY);
    return Object.values(WORLD_STREET_PROPS)
      .flat()
      .filter((i) => i.prop === "lamp-wall-lantern")
      .flatMap((i) => {
        const head = LANTERN_HEAD.map((v) => ({ x: i.x + v.x * Math.cos(i.yaw) + v.z * Math.sin(i.yaw), y: i.y + v.y, z: i.z - v.x * Math.sin(i.yaw) + v.z * Math.cos(i.yaw) }));
        const b = boards.find((s) => {
          const len = Math.hypot(s.b.x - s.a.x, s.b.z - s.a.z);
          const along = head.map((v) => ((v.x - s.a.x) * (s.b.x - s.a.x) + (v.z - s.a.z) * (s.b.z - s.a.z)) / len);
          const off = head.map((v) => (v.x - s.a.x) * s.nx + (v.z - s.a.z) * s.nz);
          const ys = head.map((v) => v.y);
          return Math.max(...off) > 0.13 && Math.min(...off) < 3 && Math.max(...along) > 0 && Math.min(...along) < len && Math.max(...ys) > s.bottom && Math.min(...ys) < s.top;
        });
        return b ? [{ at: near(i.x, i.z), what: `lamp-wall-lantern over ${b.text}` }] : [];
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
  /** A `building:part` of the map on the map's ground with no building of the game round it: dropped (G-061). */
  "building-part-orphan": () => {
    const all = MAP_CHUNKS.flatMap((c) => c.buildings);
    return [...SOURCE_OSM.ways.values()].flatMap((w) => {
      const t = w.tags ?? {};
      if (!t["building:part"] || t["building:part"] === "no" || t.building) return [];
      const pts = w.nodes.slice(1).flatMap((id) => {
        const n = SOURCE_OSM.nodes.get(id);
        return n ? [geoToWorld(n.lat, n.lon)] : [];
      });
      if (pts.length === 0) return [];
      const c = { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, z: pts.reduce((s, p) => s + p.z, 0) / pts.length };
      if (!inMap(c.x, c.z) || all.some((b) => inOutline(c.x, c.z, b.outline, b.x, b.z))) return [];
      return [{ at: near(c.x, c.z), what: `w${w.id} ${t.name ?? t["building:part"]}` }];
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
  /**
   * An interior (ADR-0061) of a map building reaching out of its outline by more than 0.3 m
   * anywhere along a room's walls (sampled every 0.5 m), or over its eaves.
   */
  "interior-outside-building": () =>
    INTERIORS.flatMap((i) => {
      if (i.building === null) return [];
      const b = MAP_CHUNKS.flatMap((c) => c.buildings).find((m) => m.id === i.building);
      if (!b) return [{ at: i.id, what: `${i.building} not on the map` }];
      const ring = worldOutline(b);
      return i.rooms.flatMap((r) => {
        const edge: Pt[] = [{ x: r.maxX, z: r.maxZ }];
        for (let x = r.minX; x <= r.maxX; x += 0.5) edge.push({ x, z: r.minZ }, { x, z: r.maxZ });
        for (let z = r.minZ; z <= r.maxZ; z += 0.5) edge.push({ x: r.minX, z }, { x: r.maxX, z });
        const out = edge.filter((p) => !inOutline(p.x, p.z, b.outline, b.x, b.z) && outlineGap([p], ring) > 0.3);
        const eaves = b.y + b.height;
        if (out.length === 0 && r.top <= eaves) return [];
        return [{ at: near(r.minX, r.minZ), what: out.length > 0 ? `${i.id} ${out.length} wall points out of ${b.id}` : `${i.id} up to ${r.top.toFixed(1)}, eaves ${eaves.toFixed(1)}` }];
      });
    }),
  /**
   * An interior (ADR-0061) of a map building not starting at the building's door or passage
   * (G-094): the feet 0.3 m in from the doorway, on its floor, in no room of it, so the player
   * counts as inside only some way past the door. A door's doorway is its opening in the front
   * wall; a passage's is where its axis enters the outline from `from` (sampled every 0.01 m).
   */
  "interior-entrance-gap": () =>
    INTERIORS.flatMap((i) => {
      if (i.building === null) return [];
      const b = MAP_CHUNKS.flatMap((c) => c.buildings).find((m) => m.id === i.building);
      if (!b) return [{ at: i.id, what: `${i.building} not on the map` }];
      const doors = ROOM_SITES.filter((s) => s.building === i.building).flatMap((s) =>
        [CLINIC_DOOR, KOI_DOOR].filter((d) => d.at.x > s.rect.minX && d.at.x < s.rect.maxX && Math.abs(d.at.z - s.front) < 1.5).map((d) => ({ x: d.at.x, y: d.at.y, z: d.at.z - s.faces * 0.3 })),
      );
      const passages = PASSAGES.filter((p) => p.building === i.building).flatMap((p) => {
        const len = Math.hypot(p.to.x - p.from.x, p.to.z - p.from.z);
        const dx = (p.to.x - p.from.x) / len;
        const dz = (p.to.z - p.from.z) / len;
        let s = 0;
        while (s < len && !inOutline(p.from.x + dx * s, p.from.z + dz * s, b.outline, b.x, b.z)) s += 0.01;
        if (s === 0 || s >= len) return [];
        const x = p.from.x + dx * (s + 0.3);
        const z = p.from.z + dz * (s + 0.3);
        return [{ x, y: p.floor ?? groundY(x, z), z }];
      });
      return [...doors, ...passages].flatMap((e) =>
        interiorAt({ x: e.x, y: e.y + 0.1, z: e.z })?.id === i.id ? [] : [{ at: near(e.x, e.z), what: `${i.id}: 0.3 m behind the facade of ${i.building} at ${e.x.toFixed(1)}, ${e.z.toFixed(1)} not inside` }],
      );
    }),
  /**
   * A building whose map data gives its roof a shape (`roof:shape`: a gable, a mansard, a dome, an
   * onion helmet, ADR-0064) that the renderer draws as another, a hipped roof most of all (G-056).
   */
  "roof-shape-ignored": () =>
    MAP_CHUNKS.flatMap((c) => c.buildings.filter((b) => !clearedBuilding(b) && b.roofShape !== undefined)).flatMap((b, i) => {
      const view = buildingView(b) as BuildingSource["view"];
      const source: BuildingSource = { ring: cleanRing(view.outline.map((p) => ({ x: p.x + b.x, z: p.z + b.z }))), view, at: { x: b.x, y: b.y, z: b.z } };
      const drawn = facadeFrame(mapBuilding(i + 1, source, () => null), () => null).style.roof;
      const want = (b.roof ?? 0) <= 0.3 ? "flat" : ROOF_KIND[b.roofShape!];
      return drawn === want ? [] : [{ at: near(b.x, b.z), what: `${b.id} ${b.name ?? ""} roof:shape=${b.roofShape} drawn as ${drawn}` }];
    }),
  /**
   * A building or part of a landmark recipe (ADR-0062) the map city does not draw from it: missing
   * from the map, or not matched by its position, so it gets the tenements' facade instead.
   */
  "landmark-recipe-unmatched": () => {
    const byId = new Map(MAP_CHUNKS.flatMap((c) => c.buildings.map((b) => [b.id, b] as const)));
    return LANDMARK_RECIPES.flatMap((r) =>
      r.parts.flatMap((p) => {
        const b = byId.get(p.osm);
        const view = b ? buildingView(b) : null;
        if (b && view?.kind === "building" && landmarkAt(b.x, b.z, view.outline.length)?.part.osm === p.osm) return [];
        return [{ at: b ? near(b.x, b.z) : "-", what: `${r.key} ${p.osm} ${b ? "drawn as a tenement" : "not in the map"}` }];
      }),
    );
  },
  /**
   * A public building drawn as a house (G-097, G-120): its own tags say an office of government, a
   * town hall, a court, a library, a theatre, a post office or an arts centre (A), or a point of a
   * town hall, a court, a theatre, a library or an arts centre lies in its plain outline at the
   * same street address or with none on either (B, as G-051); its use is neither civic, historic
   * nor church.
   */
  "civic-as-residential": () => {
    const points = [...SOURCE_OSM.nodes.values()].filter((n) => CIVIC_POINT.has(n.tags?.amenity ?? "")).map((n) => ({ at: geoToWorld(n.lat, n.lon), tags: n.tags! }));
    return MAP_CHUNKS.flatMap((c) => c.buildings.filter((b) => !clearedBuilding(b) && b.soffit === undefined && !PUBLIC_USE.has(b.use))).flatMap((b) => {
      const t = osmTags(b.id);
      if (t.office === "government" || t.government !== undefined || CIVIC_OWN.has(t.amenity ?? "")) return [{ at: near(b.x, b.z), what: `A ${b.id} ${t.name ?? ""} ${b.use}` }];
      if (!PLAIN_BUILDING.has(t.building ?? "")) return [];
      const own = addressOf(t);
      const p = points.find((q) => inOutline(q.at.x, q.at.z, b.outline, b.x, b.z) && (own === undefined || addressOf(q.tags) === undefined || addressOf(q.tags) === own));
      return p ? [{ at: near(b.x, b.z), what: `B ${b.id} amenity=${p.tags.amenity} ${p.tags.name ?? ""} ${b.use}` }] : [];
    });
  },
  /**
   * A building or a lifted part with fractional `building:levels` and no height whose walls over
   * its plinth (a part's from the building's base, as the map counts its storeys) top the storeys'
   * `levels × 3.2 m` (a shop floor 0.8 m more) by more than 0.5 m: the half storey rounded up to a
   * whole one (G-116).
   */
  "fractional-levels-rounded": () =>
    MAP_CHUNKS.flatMap((c) => c.buildings.filter((b) => !clearedBuilding(b))).flatMap((b) => {
      const t = osmTags(b.id);
      const levels = Number((t["building:levels"] ?? "").replace(",", "."));
      if (t.height !== undefined || t["building:height"] !== undefined || !Number.isFinite(levels) || Number.isInteger(levels)) return [];
      const walls = b.height - b.plinth;
      const shop = b.use === "commercial" || b.shopfront === true ? 0.8 : 0;
      return walls > levels * 3.2 + shop + 0.5 ? [{ at: near(b.x, b.z), what: `${b.id} building:levels=${t["building:levels"]}: walls ${walls.toFixed(1)} m` }] : [];
    }),
  /**
   * A metre of a sidewalk mapped on its own (`footway=sidewalk`, off bridges and tunnels, 3 m and
   * more inside the chunks, off zebras) gone under the asphalt of the street it runs along (G-082):
   * the nearest carriageway within 15 m runs parallel to it (|cos| > 0.9), its axis is closer than
   * half the street's width from the map's tags, and the game's ground there is road with no
   * sidewalk or footway on it. One finding per metre.
   */
  "sidewalk-under-carriageway": () => {
    const lines = extractFeatures(SOURCE_OSM).lines;
    const roads = lines.filter((l) => CARRIAGEWAYS.has(l.tags.highway ?? "") && l.tags.area !== "yes" && l.tags.tunnel === undefined && Number(l.tags.layer ?? 0) >= 0);
    const segs = roads.flatMap((l) => l.line.slice(1).map((b, i) => ({ l, a: l.line[i]!, b })));
    const deep = (x: number, z: number) => MAP_CHUNKS.some(({ bounds: b }) => x > b.minX + 3 && x < b.maxX - 3 && z > b.minZ + 3 && z < b.maxZ - 3);
    const nearest = (x: number, z: number) => {
      let best: { d: number; road: (typeof roads)[number]; tx: number; tz: number } | null = null;
      for (const { l, a, b } of segs) {
        if (Math.min(a.x, b.x) > x + 15 || Math.max(a.x, b.x) < x - 15 || Math.min(a.z, b.z) > z + 15 || Math.max(a.z, b.z) < z - 15) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz);
        if (len < 1e-3) continue;
        const k = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (len * len)));
        const d = Math.hypot(a.x + dx * k - x, a.z + dz * k - z);
        if (d <= 15 && (!best || d < best.d)) best = { d, road: l, tx: dx / len, tz: dz / len };
      }
      return best;
    };
    return lines.flatMap((l) => {
      const t = l.tags;
      if (t.footway !== "sidewalk" || t.tunnel !== undefined || Number(t.layer ?? 0) < 0 || (t.bridge !== undefined && t.bridge !== "no")) return [];
      return l.line.slice(1).flatMap((b, i) => {
        const a = l.line[i]!;
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        const out: Finding[] = [];
        for (let s = 0.5; s < len; s += 1) {
          const x = a.x + ((b.x - a.x) * s) / len;
          const z = a.z + ((b.z - a.z) * s) / len;
          if (!deep(x, z)) continue;
          const surfaces = surfacesAt(x, z);
          if (surfaces.includes("crossing") || !surfaces.includes("road") || surfaces.includes("sidewalk") || surfaces.includes("footway")) continue;
          const n = nearest(x, z);
          if (!n || Math.abs(((b.x - a.x) * n.tx + (b.z - a.z) * n.tz) / len) < 0.9 || n.d >= roadWidth(n.road.tags) / 2) continue;
          out.push({ at: near(x, z), what: `${l.id} under ${n.road.id} ${n.road.tags.name ?? ""}` });
        }
        return out;
      });
    });
  },
  /**
   * A street narrowed to its mapped sidewalks (G-082) although they run along less than half of it
   * on either side (G-112): the width came from where a sidewalk turns in to a junction's crossing.
   */
  "kerb-fit-sparse": () => FITTED().flatMap((r) => (r.cover * 2 < 1 ? [{ at: r.at, what: `${r.id} ${r.name}: ${r.width.toFixed(1)} m, sidewalks along ${(r.cover * 100).toFixed(0)} %` }] : [])),
  /** A two-way street (no `oneway`) narrowed to its mapped sidewalks below two 2.25 m lanes (G-113). */
  "two-way-fit-narrow": () => FITTED().flatMap((r) => (!r.oneway && r.width < 4.4 ? [{ at: r.at, what: `${r.id} ${r.name}: ${r.width.toFixed(1)} m` }] : [])),
  /** A venue's board (ADR-0064 stage 4) reaching into the building next door, which stands out in front of its wall (G-159). */
  "venue-board-in-neighbour": () => signsIn([MAP_SIGN_KIND.venue]),
  /** A banner or a superstructure's ad (ADR-0051) sticking into the building next door (G-157). */
  "banner-in-neighbour": () => signsIn([MAP_SIGN_KIND.ad]),
  /** A holo-ad or a blade sign (ADR-0044) sticking into the building next door (G-157). */
  "holo-or-blade-in-neighbour": () => signsIn([MAP_SIGN_KIND.holo, MAP_SIGN_KIND.blade]),
  /** A neon tube under the cornice (ADR-0044) running on into the building next door (G-170). */
  "tube-in-neighbour": () => signsIn([MAP_SIGN_KIND.tube]),
};

/** A building's own tags in the map data, by the game's id (`w…`, `r…`, a split's `/n` dropped). */
const osmTags = (id: string): Readonly<Record<string, string>> => {
  const key = id.split("/")[0]!;
  const n = Number(key.slice(1));
  return (key.startsWith("r") ? SOURCE_OSM.relations.get(n)?.tags : SOURCE_OSM.ways.get(n)?.tags) ?? {};
};
const PUBLIC_USE = new Set(["civic", "historic", "church"]);
const CIVIC_OWN = new Set(["townhall", "courthouse", "library", "theatre", "post_office", "arts_centre"]);
const CIVIC_POINT = new Set(["townhall", "courthouse", "theatre", "library", "arts_centre"]);
const PLAIN_BUILDING = new Set(["yes", "public", "government", "civic"]);

/** The carriageways of the map's lines, by `highway` (the importer's `ROAD_WIDTH`). */
const CARRIAGEWAYS = new Set(["motorway", "trunk", "primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link", "unclassified", "residential", "living_street", "service", "busway", "road"]);

/**
 * The map's streets without `width` or `lanes` whose asphalt in the game is narrower than the
 * importer's width by type (by over 0.5 m, the median over samples every 2 m more than 3 m inside
 * the chunks, measured across from the axis every 5 cm): the ones fitted to their sidewalks. With
 * `cover`, the larger share of the street's samples that a mapped sidewalk runs along on one side
 * (parallel, beside it, its axis on the carriageway by type).
 */
const FITTED = (() => {
  let memo: { id: string; name: string; at: string; width: number; cover: number; oneway: boolean }[] | null = null;
  return () => {
    if (memo) return memo;
    const lines = extractFeatures(SOURCE_OSM).lines;
    const walks = lines.filter((l) => l.tags.footway === "sidewalk").flatMap((l) => l.line.slice(1).map((b, i) => ({ a: l.line[i]!, b })));
    const deep = (x: number, z: number) => MAP_CHUNKS.some(({ bounds: b }) => x > b.minX + 3 && x < b.maxX - 3 && z > b.minZ + 3 && z < b.maxZ - 3);
    memo = lines.flatMap((l) => {
      const t = l.tags;
      if (!CARRIAGEWAYS.has(t.highway ?? "") || t.area === "yes" || t.tunnel !== undefined || Number(t.layer ?? 0) < 0 || t.width !== undefined || t["width:carriageway"] !== undefined || t.lanes !== undefined) return [];
      const w = roadWidth(t);
      const widths: number[] = [];
      const sides = [0, 0];
      let total = 0;
      for (let i = 0; i + 1 < l.line.length; i++) {
        const a = l.line[i]!;
        const b = l.line[i + 1]!;
        const len = Math.hypot(b.x - a.x, b.z - a.z);
        if (len < 1e-3) continue;
        const [tx, tz] = [(b.x - a.x) / len, (b.z - a.z) / len];
        for (let s = 0; s < len; s += 2) {
          const x = a.x + tx * s;
          const z = a.z + tz * s;
          total++;
          const side = [false, false];
          for (const q of walks) {
            const dx = q.b.x - q.a.x;
            const dz = q.b.z - q.a.z;
            const ql = Math.hypot(dx, dz);
            if (ql < 1e-3 || Math.abs((dx * tx + dz * tz) / ql) < 0.9) continue;
            const k = ((x - q.a.x) * dx + (z - q.a.z) * dz) / (ql * ql);
            if (k < 0 || k > 1) continue;
            const across = (q.a.z + dz * k - z) * tx - (q.a.x + dx * k - x) * tz;
            if (Math.abs(across) < w / 2) side[across >= 0 ? 0 : 1] = true;
          }
          side.forEach((on, k) => (sides[k]! += on ? 1 : 0));
          if (!deep(x, z) || !surfacesAt(x, z).includes("road")) continue;
          const reach = (sgn: number) => {
            let d = 0;
            while (d < w / 2 + 1 && surfacesAt(x - tz * sgn * (d + 0.05), z + tx * sgn * (d + 0.05)).includes("road")) d += 0.05;
            return d;
          };
          widths.push(reach(1) + reach(-1));
        }
      }
      if (widths.length < 5) return [];
      const width = [...widths].sort((p, q) => p - q)[Math.floor(widths.length / 2)]!;
      if (width >= w - 0.5) return [];
      return [{ id: l.id, name: t.name ?? "", at: near(l.line[0]!.x, l.line[0]!.z), width, cover: Math.max(...sides) / (total || 1), oneway: oneway(t) }];
    });
    return memo;
  };
})();

/** The renderer's roof for each `roof:shape` (ADR-0064). */
const ROOF_KIND: Readonly<Record<string, string>> = { gabled: "gable", "half-hipped": "half-hip", mansard: "mansard", hipped: "hip", pyramidal: "pyramid", skillion: "skillion", dome: "dome", onion: "onion", flat: "flat" };

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
});

/**
 * The ratchet: one test per kind, so each stays far under the time limit on a loaded CI runner,
 * where the whole scan in a single test went over 20 s under coverage (PR #80, 7.5 s alone).
 * The report and an updated baseline are written once all kinds have run.
 */
describe("the glitch scan against its baseline (ADR-0054)", () => {
  const update = process.env.GLITCH_BASELINE === "update" || !existsSync(BASELINE);
  const baseline = update ? {} : (JSON.parse(readFileSync(BASELINE, "utf8")) as Record<string, number>);
  const found: Record<string, Finding[]> = {};
  afterAll(() => {
    const counts = Object.fromEntries(Object.entries(found).map(([k, f]) => [k, f.length]));
    mkdirSync("reports", { recursive: true });
    writeFileSync("reports/glitch-scan.json", JSON.stringify({ counts, found }, null, 2));
    if (update && Object.keys(found).length === Object.keys(CHECKS).length) writeFileSync(BASELINE, `${JSON.stringify(counts, null, 2)}\n`);
  });
  for (const [k, check] of Object.entries(CHECKS)) {
    it(`finds no more ${k} than its baseline`, () => {
      found[k] = check();
      if (!update) expect(found[k].length, `${k}: ${found[k].length} found, baseline ${baseline[k] ?? 0} (see reports/glitch-scan.json)`).toBeLessThanOrEqual(baseline[k] ?? 0);
    });
  }
});
