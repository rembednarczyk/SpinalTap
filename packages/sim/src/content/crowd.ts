import type { ActivityId, Vec3 } from "@seki/core";
import { placeAt, v } from "./builders";
import { DISTRICT_M0_PROPS } from "./district-m0";
import { KANAL_PROPS } from "./district-kanal";
import { KOI_CROWD_SPOTS } from "./interiors";
import { METRO_STATIONS } from "./metro";
import { againstWall, inBuilding, nearestWall } from "./lublin/places";
import { DOCKS_PLACE, MAP_CHUNKS, MARKET_PLACE } from "./lublin/sites";
import { furnitureClearance, furnitureNear } from "./furniture-index";
import { SEAT_SPOTS } from "./crowd-seats";
import type { CrowdSpot } from "./crowd-spot";

/** The chunks of Lublin that hold the market and the docks (ADR-0045). */
const MARKET_CHUNK = "podzamcze-1-0";
const DOCKS_CHUNK = "nabrzeze-1-1";

/**
 * The residents of the city (ADR-0041): the crowd on the sidewalks. Pure data: the routes the
 * walkers loop along, the places where the others stand, and how full each district is by the
 * hour. Kept apart from the district tables, so their content and ids stay as they were.
 */

/** Quality setting the crowd follows (the graphics quality: phones take "low"). */
export type CrowdDensity = "off" | "low" | "medium" | "high";

/** Most residents a chunk ever holds, per density. */
export const CROWD_CAP: Readonly<Record<CrowdDensity, number>> = { off: 0, low: 6, medium: 18, high: 32 };

/**
 * A closed route along the sidewalks, as a polygon of points (x, z) on the ground. Walkers go
 * round it both ways, each way on its own side (they keep left), and it is rounded at the corners.
 */
export interface CrowdLane {
  readonly id: string;
  readonly chunk: string;
  readonly points: readonly (readonly [number, number])[];
}

export type { CrowdSpot } from "./crowd-spot";

const EAST = Math.PI / 2;
const WEST = -Math.PI / 2;
const NORTH = 0;
const SOUTH = Math.PI;

/** A lane of a set piece in the world, from its own coordinates. */
const placedLane = (d: Vec3, lane: CrowdLane): CrowdLane => ({ ...lane, points: lane.points.map(([x, z]) => [x + d.x, z + d.z] as const) });

/** Half the width of a lane laid along a street of the map: walkers go up one side and back down the other. */
const STREET_LANE_HALF = 1.6;
/** Half widths tried for a street's lane, widest usual first: furniture (ADR-0050) can push a loop in or out. */
const LANE_HALVES: readonly number[] = [STREET_LANE_HALF, 1, 2.2, 2.8, 0.7, 3.4];
/** Every point of a street's lane keeps this far from the walls (the walkers' own offset and a body included). */
const LANE_CLEARANCE = 1.15;
/** Streets shorter than this make no lane. */
const MIN_LANE_LENGTH = 30;
/** The chunks of the deptak and the Rynek: the evening's full streets (ADR-0050). */
const BUSY_CHUNKS: ReadonlySet<string> = new Set(["krakowskie-1-0", "krakowskie-2-0", "stare-miasto-0-0", "stare-miasto-0-1"]);
/** Most lanes in such a chunk. */
const BUSY_LANES_PER_CHUNK = 6;
/** Most lanes per chunk: its longest streets. */
const LANES_PER_CHUNK = 3;

type Pt = readonly [number, number];

/** The loop round a polyline `half` metres either side of it (the left side out, the right side back). */
const loopAround = (line: readonly Pt[], half: number): Pt[] => {
  const side = (sign: 1 | -1): Pt[] =>
    line.map(([x, z], i) => {
      const [px, pz] = line[Math.max(0, i - 1)] as Pt;
      const [nx, nz] = line[Math.min(line.length - 1, i + 1)] as Pt;
      const dx = nx - px;
      const dz = nz - pz;
      const len = Math.hypot(dx, dz) || 1;
      // Left of the way along the line (+X east, +Z north): (-dz, dx).
      return [Math.round((x - (dz / len) * half * sign) * 100) / 100, Math.round((z + (dx / len) * half * sign) * 100) / 100] as const;
    });
  return [...side(1), ...side(-1).reverse()];
};

/** The game's own solid blocks on the streets (the wreck, the van, kiosks, crates): routes keep off them too. */
const BLOCKS: readonly { minX: number; maxX: number; minZ: number; maxZ: number }[] = [...DISTRICT_M0_PROPS, ...KANAL_PROPS, ...METRO_STATIONS.flatMap((m) => m.props)]
  .flatMap((p) => (p.solid && p.view.kind === "block" ? [{ minX: p.center.x - p.view.size.x / 2, maxX: p.center.x + p.view.size.x / 2, minZ: p.center.z - p.view.size.z / 2, maxZ: p.center.z + p.view.size.z / 2 }] : []))
  .concat(METRO_STATIONS.map((m) => ({ minX: m.kiosk.x - 0.5, maxX: m.kiosk.x + 0.5, minZ: m.kiosk.z - 0.5, maxZ: m.kiosk.z + 0.5 })));

/** Clearance a route keeps from the game's blocks (the walkers' own offset and a body included). */
const BLOCK_CLEARANCE = 0.9;

/** How far a lane bends round a piece of furniture: the walkers' own side, a body and a margin (m). */
const WEAVE_CLEARANCE = 1.0;

/** Pushes a point out of every furniture circle it is too close to. */
const pushOut = (p: Pt): Pt => {
  let [x, z] = p;
  for (const f of furnitureNear(x, z)) {
    const d = Math.hypot(x - f.x, z - f.z);
    const want = f.r + WEAVE_CLEARANCE;
    if (d >= want) continue;
    // Straight through the middle: out to the east.
    const ux = d > 1e-6 ? (x - f.x) / d : 1;
    const uz = d > 1e-6 ? (z - f.z) / d : 0;
    x = f.x + ux * want;
    z = f.z + uz * want;
  }
  return [Math.round(x * 100) / 100, Math.round(z * 100) / 100];
};

/**
 * A loop bent round the furniture on it (ADR-0050): resampled every metre, each sample pushed
 * out of the pieces it is too close to, then smoothed so the walk curves instead of zigzagging.
 */
const weave = (loop: readonly Pt[]): Pt[] => {
  const dense: Pt[] = [];
  for (let i = 0; i < loop.length; i++) {
    const [ax, az] = loop[i] as Pt;
    const [bx, bz] = loop[(i + 1) % loop.length] as Pt;
    const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az)));
    for (let k = 0; k < n; k++) dense.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  if (!dense.some((p) => furnitureClearance(p[0], p[1]) < WEAVE_CLEARANCE)) return [...loop];
  let pts = dense.map(pushOut);
  for (let pass = 0; pass < 2; pass++) {
    pts = pts.map((p, i) => {
      const a = pts[(i + pts.length - 1) % pts.length] as Pt;
      const b = pts[(i + 1) % pts.length] as Pt;
      return pushOut([(a[0] + 2 * p[0] + b[0]) / 4, (a[1] + 2 * p[1] + b[1]) / 4]);
    });
  }
  return pts;
};

const nearBlock = (x: number, z: number): boolean =>
  furnitureClearance(x, z) < BLOCK_CLEARANCE || BLOCKS.some((b) => Math.hypot(Math.max(b.minX - x, 0, x - b.maxX), Math.max(b.minZ - z, 0, z - b.maxZ)) < BLOCK_CLEARANCE);

/** Shortest out-and-back walk worth a lane, metres. */
const MIN_RUN = 25;

const clearAt = (x: number, z: number): boolean => !inBuilding(x, z) && nearestWall(x, z).d >= LANE_CLEARANCE && !nearBlock(x, z);

/**
 * The longest stretch of a loop clear of walls and blocks, walked there and back (an alley of
 * Plac Litewski's park runs by a tenement's wall at one end): null when no stretch is
 * `MIN_RUN` metres long. Sampled every metre, so the stretch is too.
 */
const clearRun = (loop: readonly Pt[]): Pt[] | null => {
  const dense: Pt[] = [];
  for (let i = 0; i < loop.length; i++) {
    const [ax, az] = loop[i] as Pt;
    const [bx, bz] = loop[(i + 1) % loop.length] as Pt;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az)));
    for (let k = 0; k < n; k++) dense.push([Math.round((ax + ((bx - ax) * k) / n) * 100) / 100, Math.round((az + ((bz - az) * k) / n) * 100) / 100]);
  }
  const ok = dense.map(([x, z]) => clearAt(x, z));
  const start = ok.indexOf(false);
  if (start < 0) return null;
  let best: Pt[] = [];
  let run: Pt[] = [];
  // From the first blocked sample once round, so a stretch across the loop's seam stays whole.
  for (let k = 1; k <= dense.length; k++) {
    const i = (start + k) % dense.length;
    if (ok[i]) run.push(dense[i] as Pt);
    else {
      if (run.length > best.length) best = run;
      run = [];
    }
  }
  if (best.length < MIN_RUN) return null;
  return [...best, ...best.slice(1, -1).reverse()];
};

/** Is every metre along the loop clear of the map's walls and the game's blocks? */
const clearLoop = (loop: readonly Pt[]): boolean => {
  for (let i = 0; i < loop.length; i++) {
    const [ax, az] = loop[i] as Pt;
    const [bx, bz] = loop[(i + 1) % loop.length] as Pt;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az)));
    for (let k = 0; k < n; k++) {
      const x = ax + ((bx - ax) * k) / n;
      const z = az + ((bz - az) * k) / n;
      if (inBuilding(x, z) || nearestWall(x, z).d < LANE_CLEARANCE || nearBlock(x, z)) return false;
    }
  }
  return true;
};

const polyLength = (line: readonly Pt[]): number => line.reduce((s, p, i) => (i === 0 ? 0 : s + Math.hypot(p[0] - (line[i - 1] as Pt)[0], p[1] - (line[i - 1] as Pt)[1])), 0);

/**
 * Lanes along the pedestrian streets of the map (ADR-0045): for each chunk of Krakowskie
 * Przedmieście and Stare Miasto, loops round its longest deptak, square and alley lines that
 * stay clear of the walls (a narrower loop where the wide one touches a wall).
 */
const streetLanes = (): CrowdLane[] =>
  MAP_CHUNKS.filter((c) => c.district === "shinsekai-7" || c.district === "kanal").flatMap((c) => {
    const lines = c.streets
      .filter((st) => st.kind === "pedestrian" || st.kind === "living_street")
      .map((st) => {
        const pts: Pt[] = [];
        for (let i = 0; i + 1 < st.line.length; i += 2) pts.push([st.line[i] as number, st.line[i + 1] as number]);
        return pts;
      })
      .filter((pts) => pts.length >= 2 && polyLength(pts) >= MIN_LANE_LENGTH)
      .sort((a, b) => polyLength(b) - polyLength(a));
    const out: CrowdLane[] = [];
    // The deptak and the Rynek (ADR-0050): more routes, two side by side on a wide street.
    const busy = BUSY_CHUNKS.has(c.id);
    for (const line of lines) {
      const used: number[] = [];
      for (const half of LANE_HALVES) {
        if (out.length >= (busy ? BUSY_LANES_PER_CHUNK : LANES_PER_CHUNK) || used.length >= (busy ? 2 : 1)) break;
        if (used.some((u) => Math.abs(u - half) < 1.4)) continue;
        const loop = weave(loopAround(line, half));
        if (!clearLoop(loop)) continue;
        out.push({ id: `${c.id}-${out.length}`, chunk: c.id, points: loop });
        used.push(half);
      }
    }
    return out;
  });

/** Squares this large (m²) get loops of their own: Plac Litewski, Plac Łokietka, the Rynek. */
const SQUARE_AREA = 1500;
/** How far towards its middle a square's loop is drawn in, as shares of the way from the edge. */
const SQUARE_INSETS: readonly number[] = [0.7, 0.5, 0.3];
/** Most loops a chunk's squares and alleys add. */
const SQUARE_LANES_PER_CHUNK = 3;
/** Paths this large (m², some 60 m of a 2.5 m alley) make a loop of their own. */
const ALLEY_AREA = 150;

const ringOf = (flat: readonly number[]): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i] as number, flat[i + 1] as number]);
  return out;
};

const ringArea = (ring: readonly Pt[]): number => Math.abs(ring.reduce((s, p, i) => {
  const q = ring[(i + 1) % ring.length] as Pt;
  return s + p[0] * q[1] - q[0] * p[1];
}, 0)) / 2;

const insideRing = (x: number, z: number, ring: readonly Pt[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i] as Pt;
    const [xj, zj] = ring[j] as Pt;
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = true !== inside;
  }
  return inside;
};

/**
 * Loops across the big squares (Plac Litewski's alleys are paths without names, so no street
 * lane reaches them): the square's outline drawn in towards its middle, kept only where it stays
 * clear of the walls, the furniture and the fountains' water.
 */
const squareLanes = (): CrowdLane[] =>
  MAP_CHUNKS.filter((c) => c.district === "shinsekai-7" || c.district === "kanal").flatMap((c) => {
    const water = c.ground.filter((g) => g.surface === "water" || g.surface === "basin").map((g) => ringOf(g.outline));
    const dry = (loop: readonly Pt[]) => loop.every(([x, z]) => !water.some((w) => insideRing(x, z, w)));
    const squares = c.ground
      .filter((g) => g.surface === "square")
      .map((g) => ringOf(g.outline))
      .filter((r) => r.length >= 3 && ringArea(r) >= SQUARE_AREA)
      .sort((a, b) => ringArea(b) - ringArea(a));
    // The squares' alleys: a path's band is already a loop up one side and back down the other.
    const alleys = c.ground
      .filter((g) => g.surface === "footway")
      .map((g) => ringOf(g.outline))
      .filter((r) => r.length >= 4 && ringArea(r) >= ALLEY_AREA)
      .sort((a, b) => ringArea(b) - ringArea(a));
    const out: CrowdLane[] = [];
    for (const ring of alleys) {
      if (out.length >= SQUARE_LANES_PER_CHUNK) break;
      const loop = weave(ring);
      // An alley that touches a wall or a block somewhere is still walked where it is clear.
      const walk = clearLoop(loop) ? loop : clearRun(loop);
      if (walk && dry(walk)) out.push({ id: `${c.id}-square-${out.length}`, chunk: c.id, points: walk });
    }
    for (const ring of squares) {
      const cx = ring.reduce((s, p) => s + p[0], 0) / ring.length;
      const cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
      for (const k of SQUARE_INSETS) {
        if (out.length >= SQUARE_LANES_PER_CHUNK) break;
        const loop = weave(ring.map(([x, z]) => [cx + (x - cx) * k, cz + (z - cz) * k] as const));
        if (clearLoop(loop) && dry(loop)) out.push({ id: `${c.id}-square-${out.length}`, chunk: c.id, points: loop });
      }
    }
    return out;
  });

/** The market's and the docks' own lanes (ADR-0041), placed with their set pieces. */
const SET_PIECE_LANES: readonly CrowdLane[] = [
  // The market: round the edge of the square (east of Sachiko's kiosk at the gate), and round
  // the stalls in its middle.
  placedLane(MARKET_PLACE, {
    id: "targ-square",
    chunk: MARKET_CHUNK,
    points: [
      [77.65, 65.1],
      [112.75, 65.1],
      [112.75, 82.6],
      [77.65, 82.6],
    ],
  }),
  placedLane(MARKET_PLACE, {
    id: "targ-stalls",
    chunk: MARKET_CHUNK,
    points: [
      [80.5, 70.6],
      [109, 70.6],
      [109, 77.8],
      [80.5, 77.8],
    ],
  }),
  // Under the viaduct: along the north stalls, down past the east pillars, back west between
  // the pillar pairs and up past the stairs.
  placedLane(MARKET_PLACE, {
    id: "targ-deck",
    chunk: MARKET_CHUNK,
    points: [
      [69.4, 104.75],
      [117, 104.75],
      [117, 90.8],
      [69.4, 90.8],
    ],
  }),
  // The docks: the footpath along the east wall, west along the quay fence, back east past the
  // office and the vending machine, north up the yard.
  placedLane(DOCKS_PLACE, {
    id: "doki-round",
    chunk: DOCKS_CHUNK,
    points: [
      [31.3, 93],
      [31.3, 113.6],
      [27.9, 114.4],
      [27.9, 117.6],
      [31.3, 118.6],
      [31.3, 148.75],
      [-34.2, 148.75],
      [-34.2, 125.6],
      [22.6, 125.6],
      [22.6, 123.3],
      [24.4, 122.6],
      [24.4, 93],
    ],
  }),
];

export { furnitureClearance };

export const CROWD_LANES: readonly CrowdLane[] = [...streetLanes(), ...squareLanes(), ...SET_PIECE_LANES];

const spot = (chunk: string, at: Vec3, yaw: number, does: readonly [ActivityId, ...ActivityId[]], indoor = false): CrowdSpot =>
  indoor ? { chunk, at, yaw, does, indoor: true } : { chunk, at, yaw, does };

/** The chunk of Lublin holding a point (the first one, as streaming counts). */
const chunkOf = (x: number, z: number): string =>
  MAP_CHUNKS.find((c) => x >= c.bounds.minX && x <= c.bounds.maxX && z >= c.bounds.minZ && z <= c.bounds.maxZ)?.id ?? "";

/** A stander against the facade nearest to (x, z), facing away from it, in the chunk it ends up in. */
const wallSpot = (x: number, z: number, does: readonly [ActivityId, ...ActivityId[]]): CrowdSpot => {
  const w = againstWall(x, z, 0.45);
  return spot(chunkOf(w.at.x, w.at.z), w.at, w.yaw, does);
};

const inMarket = (x: number, z: number): Vec3 => placeAt(MARKET_PLACE, v(x, 0, z));
const inDocks = (x: number, z: number): Vec3 => placeAt(DOCKS_PLACE, v(x, 0, z));

/**
 * Where residents stand: at the shop fronts of the deptak and the Rynek (out of the walkers'
 * way), at the Neon Koi counter, in the market and on the quay. Clear of the passers-by's spots
 * and the named characters.
 */
export const CROWD_SPOTS: readonly CrowdSpot[] = [
  wallSpot(300, -73, ["smoke", "phone"]),
  wallSpot(333, -77, ["phone", "lean"]),
  wallSpot(291, -95, ["talk"]),
  wallSpot(326.5, -93, ["lean", "smoke"]),
  wallSpot(344, -97, ["smoke", "phone"]),
  wallSpot(160, -60.5, ["talk", "phone"]),
  ...KOI_CROWD_SPOTS.map((s, i) => spot("krakowskie-2-0", s.at, s.yaw, i === 1 ? ["talk", "drink"] : i === 3 ? ["lean", "phone"] : ["drink"], true)),
  wallSpot(536, -60, ["lean", "smoke"]),
  wallSpot(566, -48, ["smoke", "phone"]),
  wallSpot(604, -100, ["phone", "lean"]),
  wallSpot(520, -60, ["smoke"]),
  wallSpot(590, -42, ["talk", "phone"]),
  spot(MARKET_CHUNK, inMarket(76, 64.45), SOUTH, ["phone"]),
  spot(MARKET_CHUNK, inMarket(89.4, 64.45), EAST, ["talk"]),
  spot(MARKET_CHUNK, inMarket(113.55, 76), WEST, ["smoke", "lean"]),
  spot(MARKET_CHUNK, inMarket(90.5, 64.45), WEST, ["talk"]),
  spot(MARKET_CHUNK, inMarket(100, 64.45), SOUTH, ["phone", "lean"]),
  spot(MARKET_CHUNK, inMarket(88, 105.55), NORTH, ["phone"]),
  spot(MARKET_CHUNK, inMarket(100, 105.55), NORTH, ["lean", "phone"]),
  spot(MARKET_CHUNK, inMarket(96, 87.2), SOUTH, ["smoke", "lean"]),
  spot(MARKET_CHUNK, inMarket(118, 105.55), NORTH, ["smoke"]),
  spot(DOCKS_CHUNK, inDocks(12.6, 101.2), WEST, ["smoke", "lean"]),
  spot(DOCKS_CHUNK, inDocks(26, 104), NORTH, ["phone"]),
  spot(DOCKS_CHUNK, inDocks(12.6, 137.5), NORTH, ["lean", "smoke"]),
  spot(DOCKS_CHUNK, inDocks(5.5, 134), SOUTH, ["talk", "phone"]),
  // At the street furniture (ADR-0050): benches, café gardens, kiosks, bus shelters.
  ...SEAT_SPOTS,
];

/**
 * How full a district is by the hour (0..1 of the chunk's share of the cap): Shinsekai lives at
 * night, the market is busiest in the evening, the docks work by day and are empty at night, the
 * deptak and the Rynek are full in the evening (ADR-0050).
 */
export const CROWD_BY_HOUR: Readonly<Record<string, readonly number[]>> = {
  //            0    1    2    3    4    5    6    7    8    9   10   11   12   13   14   15   16   17   18   19   20   21   22   23
  nightlife: [0.9, 0.9, 0.8, 0.6, 0.3, 0.2, 0.2, 0.4, 0.5, 0.5, 0.5, 0.6, 0.6, 0.6, 0.6, 0.6, 0.7, 0.8, 0.8, 0.9, 1.0, 1.0, 1.0, 1.0],
  street: [0.5, 0.4, 0.3, 0.2, 0.1, 0.2, 0.4, 0.7, 0.8, 0.6, 0.6, 0.7, 0.8, 0.7, 0.6, 0.6, 0.7, 0.9, 0.9, 0.8, 0.8, 0.7, 0.6, 0.6],
  market: [0.4, 0.3, 0.1, 0.1, 0.1, 0.1, 0.3, 0.5, 0.5, 0.6, 0.7, 0.8, 0.9, 0.8, 0.7, 0.7, 0.8, 1.0, 1.0, 1.0, 1.0, 1.0, 0.8, 0.6],
  docks: [0, 0, 0, 0, 0, 0.2, 0.5, 0.8, 0.9, 0.9, 0.9, 0.9, 0.7, 0.9, 0.9, 0.9, 0.8, 0.6, 0.3, 0.1, 0, 0, 0, 0],
  // The deptak of Krakowskie Przedmieście and the Rynek (ADR-0050): full from the evening to past midnight.
  evening: [0.9, 0.8, 0.6, 0.4, 0.2, 0.15, 0.2, 0.35, 0.5, 0.55, 0.6, 0.65, 0.7, 0.7, 0.7, 0.7, 0.8, 0.95, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
};



/** Each chunk's crowd: its profile by the hour and its share of the cap. */
export const CROWD_CHUNKS: Readonly<Record<string, { readonly profile: keyof typeof CROWD_BY_HOUR; readonly share: number }>> = Object.fromEntries(
  MAP_CHUNKS.flatMap((c) => {
    if (!CROWD_LANES.some((l) => l.chunk === c.id) && !CROWD_SPOTS.some((sp) => sp.chunk === c.id)) return [];
    const crowd =
      c.id === MARKET_CHUNK
        ? { profile: "market" as const, share: 1 }
        : c.id === DOCKS_CHUNK
          ? { profile: "docks" as const, share: 0.6 }
          : BUSY_CHUNKS.has(c.id)
            ? { profile: "evening" as const, share: 1 }
            : c.district === "shinsekai-7"
              ? { profile: "nightlife" as const, share: 0.6 }
              : c.district === "kanal"
                ? { profile: "street" as const, share: 0.8 }
                : c.district === "targ"
                  ? { profile: "street" as const, share: 0.7 }
                  : { profile: "street" as const, share: 0.4 };
    return [[c.id, crowd]];
  }),
);
