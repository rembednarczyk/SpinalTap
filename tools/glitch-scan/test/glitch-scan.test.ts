import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { type StreetPropItem, VEHICLE_SIZE } from "../../../packages/core/src";
import { CROWD_LANES } from "../../../packages/sim/src/content/crowd";
import { furnitureClearance } from "../../../packages/sim/src/content/furniture-index";
import { furniturePrisms, furnitureRadius } from "../../../packages/sim/src/content/lublin/furniture";
import { inBuilding, nearestWall } from "../../../packages/sim/src/content/lublin/places";
import { ROAD_CHAINS, surfacesAt } from "../../../packages/sim/src/content/lublin/roads";
import { clearedBuilding } from "../../../packages/sim/src/content/cleared-buildings";
import { CLEARED_BUILDINGS, MAP_CHUNKS, PASSAGES } from "../../../packages/sim/src/content/lublin/sites";
import { groundY } from "../../../packages/sim/src/content/lublin/terrain";
import { PARKED_CARS } from "../../../packages/sim/src/content/parked-cars";
import { GAME_PROPS, WORLD_STREET_PROPS } from "../../../packages/sim/src/content/street-props";
import { TRAFFIC_ROUTES, type TrafficRoute, pointAt, projectOn } from "../../../packages/sim/src/content/traffic";

/**
 * The glitch scan (ADR-0054): the map's known kinds of glitch counted over the whole city, each
 * against its baseline in `glitch-baseline.json`. A count over its baseline is a regression and
 * fails; a count under it is a fix, and the baseline comes down with it (`GLITCH_BASELINE=update
 * pnpm vitest run tools/glitch-scan`), so it only ever ratchets down.
 * Each finding's place goes to `reports/glitch-scan.json` for the hunters (ADR-0054).
 */

type Finding = { readonly at: string; readonly what: string };

const BASELINE = join(__dirname, "glitch-baseline.json");
const cars = TRAFFIC_ROUTES.filter((r) => r.use !== "deliveries");
const carStreets = ROAD_CHAINS.filter((c) => c.use === "cars");

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

const overlaps = (a: Rect, b: Rect) => a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;

/** The game's solid blocks standing on the ground (not interiors, awnings or decks) in the rectangles that clear the map's buildings. */
const setPieceBlocks: readonly Rect[] = GAME_PROPS.flatMap((p) => {
  if (p.view.kind !== "block" || !p.solid || p.interior || p.center.y - p.view.size.y / 2 - groundY(p.center.x, p.center.z) > 0.5) return [];
  const r = { minX: p.center.x - p.view.size.x / 2, maxX: p.center.x + p.view.size.x / 2, minZ: p.center.z - p.view.size.z / 2, maxZ: p.center.z + p.view.size.z / 2 };
  return CLEARED_BUILDINGS.some((c) => overlaps(c, r)) ? [r] : [];
});

const CHECKS: Readonly<Record<string, () => Finding[]>> = {
  /** A car lane off every road surface (on grass, a square, a pavement), away from the map's edges. */
  "car-lane-off-road": () =>
    cars.flatMap((r) => along(r, 3).filter((p) => inMap(p.x, p.z) && !surfacesAt(p.x, p.z).some((s) => s === "road" || s === "crossing" || s === "cobble")).map((p) => ({ at: near(p.x, p.z), what: r.id }))),
  /** A lane through a building's solid (a delivery van too), its passages aside. */
  "lane-in-building": () => TRAFFIC_ROUTES.flatMap((r) => along(r, 1).filter((p) => inBuilding(p.x, p.z) && !inPassage(p.x, p.z)).map((p) => ({ at: near(p.x, p.z), what: r.id }))),
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
  /** A piece of road or path on a bridge laid on the valley instead of a deck. */
  "bridge-without-deck": () => MAP_CHUNKS.flatMap((c) => c.ground.filter((g) => g.bridge && !g.deck).map((g) => ({ at: near(g.outline[0]!, g.outline[1]!), what: g.surface }))),
  /** A passage through a building with an end off every chunk, where there is no ground to come out on. */
  "passage-off-map": () =>
    PASSAGES.filter((p) => [p.from, p.to].some(({ x, z }) => !MAP_CHUNKS.some(({ bounds: b }) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ))).map((p) => ({
      at: near(p.from.x, p.from.z),
      what: p.building,
    })),
};

describe("the glitch scan (ADR-0054)", () => {
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
