import { BinIndex } from "../mapcity/map-index";
import { type Box2, type P2, boundsOf, pointInRing } from "../mapcity/polygon";

/**
 * The drones' lanes over the street canyons (ADR-0058 stage 7), from rules on the map's data, no
 * list of places: a lane follows the axis of a street (OSM `highway`, `drone-world.ts`) where
 * buildings line it, and flies over the roofs of the canyon. Pure: the renderer plans from the
 * views it holds, the glitch scan from the same views (ADR-0054).
 *
 * The rules, per sample every `STEP` metres along a joined axis:
 * - both legs of the loop (`LEG` metres either side of the axis) lie over the street's surfaces;
 * - a building within `FLANK` metres on one side at least (a street between houses, not across an
 *   open square, a park or a bridge);
 * - no landmark within `LANDMARK_CLEAR` metres (the Old Town and the churches stay calm, ADR-0058);
 * - not within `SEPARATION` metres of a lane already planned (the other carriageway of a dual road);
 * - the flight level `ROOF_CLEAR` over the highest roof (gear and masts included) of the canyon's walls
 *   and of every building within `CORRIDOR` metres, at least `MIN_AGL` and at most `MAX_AGL` over the
 *   street, raised ahead of a tall roof (`RISE_AHEAD`) and smoothed.
 * Runs of good samples at least `MIN_LANE` long make the lanes, `TRIM` metres short of their ends so the
 * turn from one leg to the other stays over the checked street.
 */

/** A building as the drones see it: its outline, the top of everything on it, and whether it is a landmark. */
export interface DroneBuilding {
  readonly ring: readonly P2[];
  readonly top: number;
  readonly landmark: boolean;
}

/** What the lanes are planned from: the streets' axes, the street's surfaces and the buildings. */
export interface DroneWorld {
  readonly axes: readonly (readonly P2[])[];
  readonly roads: readonly (readonly P2[])[];
  readonly buildings: readonly DroneBuilding[];
  /** Street level at (x, z), null off the map. */
  readonly groundAt: (x: number, z: number) => number | null;
}

/** A lane: its axis every `STEP` metres and the flight level (the drones' feet) over each point. */
export interface DroneLane {
  readonly points: readonly P2[];
  readonly levels: readonly number[];
  readonly length: number;
  /** Seed of the drones on it (from where it starts). */
  readonly seed: number;
}

export const STEP = 4;
/** Each leg of a lane's loop runs this far beside the axis (m), on the right of the way it flies: the legs lie wider apart than the widest drone. */
export const LEG = 1.8;
/** The carriageway must reach this much past each leg (m). */
const ROAD_MARGIN = 0.5;
const FLANK = 30;
const LANDMARK_CLEAR = 40;
const SEPARATION = 16;
/** Over the roof's top: masts with warning lights stand up to 9 m on the last tier (ADR-0051). */
export const ROOF_CLEAR = 11;
/** Buildings this near the axis count for the flight level (m): the legs, the widest drone and a margin. */
export const CORRIDOR = 9;
export const MIN_AGL = 22;
const MAX_AGL = 85;
const RISE_AHEAD = 40;
const SMOOTH = 16;
export const MIN_LANE = 60;
const TRIM = 4;
/** Pieces of an axis join when they meet within this (m) and turn by less than `JOIN_COS`. */
const JOIN = 1.5;
const JOIN_COS = Math.cos((35 * Math.PI) / 180);

const dist = (a: P2, b: P2): number => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * Joins the pieces of the streets' axes (clipped per chunk) where one ends at another's end or start
 * and the two carry on straight enough, turning a piece round as needed. Deterministic: pieces in
 * the given order, the first match wins.
 */
export const joinAxes = (axes: readonly (readonly P2[])[]): P2[][] => {
  const lines = axes.filter((l) => l.length >= 2).map((l) => [...l]);
  const heading = (a: P2, b: P2): P2 => {
    const d = dist(a, b) || 1;
    return { x: (b.x - a.x) / d, z: (b.z - a.z) / d };
  };
  /** `a` then `b`, when `a`'s end meets `b`'s start straight enough. */
  const join = (a: P2[], b: P2[]): P2[] | null => {
    if (dist(a[a.length - 1] as P2, b[0] as P2) >= JOIN) return null;
    const u = heading(a[a.length - 2] as P2, a[a.length - 1] as P2);
    const v = heading(b[0] as P2, b[1] as P2);
    return u.x * v.x + u.z * v.z >= JOIN_COS ? [...a, ...b.slice(1)] : null;
  };
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i] as P2[];
      const b = lines[j] as P2[];
      const joined = join(a, b) ?? join(b, a) ?? join(a, [...b].reverse()) ?? join([...b].reverse(), a);
      if (!joined) continue;
      lines[i] = joined;
      lines.splice(j, 1);
      // The longer line may meet a piece passed over before.
      j = i;
    }
  }
  return lines;
};

/** Points every `STEP` metres along a line, its last one included when it is over half a step on. */
export const resample = (line: readonly P2[]): P2[] => {
  const out: P2[] = [line[0] as P2];
  let carry = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1] as P2;
    const b = line[i] as P2;
    const d = dist(a, b);
    let s = STEP - carry;
    for (; s <= d; s += STEP) out.push({ x: a.x + ((b.x - a.x) * s) / d, z: a.z + ((b.z - a.z) * s) / d });
    carry = d - (s - STEP);
  }
  if (carry > STEP / 2) out.push(line[line.length - 1] as P2);
  return out;
};

/** Distance from a point to a ring's area (0 inside). */
const toRing = (p: P2, ring: readonly P2[]): number => {
  if (pointInRing(p, ring)) return 0;
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j] as P2;
    const b = ring[i] as P2;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    best = Math.min(best, Math.hypot(a.x + dx * t - p.x, a.z + dz * t - p.z));
  }
  return best;
};

const indexOf = (rings: readonly { readonly ring: readonly P2[] }[]): BinIndex => {
  const index = new BinIndex();
  rings.forEach((r, i) => index.add(i, boundsOf(r.ring)));
  return index;
};

const around = (p: P2, r: number): Box2 => ({ minX: p.x - r, maxX: p.x + r, minZ: p.z - r, maxZ: p.z + r });

interface Sample {
  readonly p: P2;
  readonly ok: boolean;
  readonly level: number;
}

/** The queries a plan asks of the world: street surfaces, houses and landmarks by their 32 m bins. */
const queries = (world: DroneWorld) => {
  const roads = world.roads.map((ring) => ({ ring }));
  const roadIndex = indexOf(roads);
  const houses = world.buildings;
  const houseIndex = indexOf(houses);
  const landmarks = houses.filter((h) => h.landmark);
  const landmarkIndex = indexOf(landmarks);
  const onRoad = (p: P2): boolean => [...roadIndex.at(p.x, p.z)].some((i) => pointInRing(p, (roads[i] as { ring: readonly P2[] }).ring));
  const houseAt = (p: P2): DroneBuilding | null => {
    for (const i of houseIndex.at(p.x, p.z)) if (pointInRing(p, (houses[i] as DroneBuilding).ring)) return houses[i] as DroneBuilding;
    return null;
  };
  return {
    /** The first house within `FLANK` metres along (nx, nz). */
    flank: (p: P2, nx: number, nz: number): DroneBuilding | null => {
      for (let d = 2; d <= FLANK; d += 2) {
        const h = houseAt({ x: p.x + nx * d, z: p.z + nz * d });
        if (h) return h;
      }
      return null;
    },
    /** The highest top of the houses within `CORRIDOR` metres. */
    roofNear: (p: P2): number => {
      let roof = -Infinity;
      for (const k of houseIndex.within(around(p, CORRIDOR))) {
        const h = houses[k] as DroneBuilding;
        if (h.top > roof && toRing(p, h.ring) <= CORRIDOR) roof = h.top;
      }
      return roof;
    },
    byLandmark: (p: P2): boolean => [...landmarkIndex.within(around(p, LANDMARK_CLEAR))].some((k) => toRing(p, (landmarks[k] as DroneBuilding).ring) < LANDMARK_CLEAR),
    /**
     * The band of the loop from `p` a step on towards `q`, metre by metre: both legs and the axis
     * over no house, the street's surfaces reaching `ROAD_MARGIN` past each leg.
     */
    streetBand: (p: P2, q: P2, nx: number, nz: number): boolean => {
      const reach = LEG + ROAD_MARGIN;
      for (let t = 0; t < STEP; t++) {
        const c = { x: p.x + ((q.x - p.x) * t) / STEP, z: p.z + ((q.z - p.z) * t) / STEP };
        const at = (side: number): P2 => ({ x: c.x + nx * side, z: c.z + nz * side });
        if (!onRoad(at(reach)) || !onRoad(at(-reach))) return false;
        if (houseAt(at(LEG)) || houseAt(at(0)) || houseAt(at(-LEG))) return false;
      }
      return true;
    },
  };
};

/** The lanes of the city, in the order of the joined axes. */
export const planDroneLanes = (world: DroneWorld): DroneLane[] => {
  const q = queries(world);
  const taken = new BinIndex();
  let takenId = 0;
  const lanes: DroneLane[] = [];
  for (const line of joinAxes(world.axes)) {
    const pts = resample(line);
    if ((pts.length - 1) * STEP < MIN_LANE) continue;
    const samples: Sample[] = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)] as P2;
      const b = pts[Math.min(pts.length - 1, i + 1)] as P2;
      const d = dist(a, b) || 1;
      const nx = -(b.z - a.z) / d;
      const nz = (b.x - a.x) / d;
      // The next sample, or a step on past the last.
      const next = i + 1 < pts.length ? b : { x: p.x + nz * STEP, z: p.z - nx * STEP };
      const ground = world.groundAt(p.x, p.z);
      const left = q.flank(p, nx, nz);
      const right = q.flank(p, -nx, -nz);
      const roof = Math.max(left?.top ?? -Infinity, right?.top ?? -Infinity, q.roofNear(p));
      const clear = !q.byLandmark(p) && [...taken.within(around(p, SEPARATION))].length === 0;
      const level = Math.max((ground ?? 0) + MIN_AGL, roof + ROOF_CLEAR);
      const ok = ground !== null && (left !== null || right !== null) && clear && level <= ground + MAX_AGL && q.streetBand(p, next, nx, nz);
      return { p, ok, level };
    });
    for (const run of runsOf(samples)) {
      const lane = laneOf(run);
      lanes.push(lane);
      for (const p of lane.points) taken.add(takenId++, around(p, 0));
    }
  }
  return lanes;
};

/** Runs of good samples, `TRIM` short of their ends, at least `MIN_LANE` long. */
const runsOf = (samples: readonly Sample[]): Sample[][] => {
  const out: Sample[][] = [];
  const cut = Math.ceil(TRIM / STEP);
  let start = -1;
  for (let i = 0; i <= samples.length; i++) {
    const ok = i < samples.length && (samples[i] as Sample).ok;
    if (ok && start < 0) start = i;
    if (ok || start < 0) continue;
    const run = samples.slice(start + cut, i - cut);
    if ((run.length - 1) * STEP >= MIN_LANE) out.push(run);
    start = -1;
  }
  return out;
};

/** A lane from a run: the level raised ahead of each roof, then smoothed (never below the raised one's floor). */
const laneOf = (run: readonly Sample[]): DroneLane => {
  const ahead = Math.round(RISE_AHEAD / STEP);
  const raised = run.map((_, i) => Math.max(...run.slice(Math.max(0, i - ahead), i + ahead + 1).map((s) => s.level)));
  const half = Math.round(SMOOTH / STEP);
  const levels = raised.map((_, i) => {
    const w = raised.slice(Math.max(0, i - half), i + half + 1);
    return w.reduce((a, b) => a + b, 0) / w.length;
  });
  const first = (run[0] as Sample).p;
  return {
    points: run.map((s) => s.p),
    levels,
    length: (run.length - 1) * STEP,
    seed: (Math.imul(Math.round(first.x * 10), 73856093) ^ Math.imul(Math.round(first.z * 10), 19349663)) >>> 0,
  };
};
