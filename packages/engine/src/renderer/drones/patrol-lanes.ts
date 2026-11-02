import { BinIndex } from "../mapcity/map-index";
import { type Box2, type P2, boundsOf, pointInRing } from "../mapcity/polygon";
import { type DroneLane, STEP, joinAxes, resample } from "./drone-lanes";
import type { PatrolAir } from "./patrol-air";
import { PATROL_ALTITUDE, PATROL_BOB, PATROL_CEILING, PATROL_REACH, PATROL_SIZE, type PatrolLane } from "./patrol-flight";

/**
 * The low patrols' lanes over the pedestrian streets (ADR-0058 stage 7b), from rules on the map's
 * data, no list of places: a lane follows the axis of a pedestrian street or a living street (OSM
 * `highway`) a few metres over its paving, where the air is clear. Pure: the renderer plans from the
 * whole scenery once, the glitch scan from the same scenery.
 *
 * The rules, per sample every `STEP` metres along a joined axis, and metre by metre to the next:
 * - over the street's surfaces `ROOM` metres either side of the axis;
 * - the patrol's height band (its box, bobbing included) `ROOM` metres round clear of the air
 *   (`PatrolAir`: buildings with their facades' room, furniture, poles, cables, curtains, billboards);
 * - not within `SEPARATION` metres of a lane already planned, so two patrols never meet.
 * Runs of good samples between two samples whose whole column up to their ceiling is clear (where a
 * patrol comes into sight, comes down, climbs and goes: over the roofs round it, under the canyon
 * drones), at least `MIN_LANE` long, make the lanes. Unlike the canyon
 * drones (ADR-0058 stage 7) they may come near the landmarks: the user's decision for the low
 * patrols only.
 */

/** What the lanes are planned from. */
export interface PatrolWorld {
  readonly axes: readonly (readonly P2[])[];
  readonly roads: readonly (readonly P2[])[];
  readonly air: PatrolAir;
  /** Terrain height at (x, z), null off the map. */
  readonly groundAt: (x: number, z: number) => number | null;
  /** The paving's drawn height at (x, z) (the terrain and the paving's lift). */
  readonly surfaceAt: (x: number, z: number) => number;
  /** Over the Old Town (the long pauses). */
  readonly quietAt: (x: number, z: number) => boolean;
  /** On a square's paving (OSM `place=square`, `area:highway`: the Rynek, Plac Litewski); none without. */
  readonly squareAt?: (x: number, z: number) => boolean;
}

/** The clearance round the patrol's box that the planner keeps (m), over the half diagonal. */
export const MARGIN = 0.35;
/** The radius kept clear round a patrol's middle (m). */
export const ROOM = PATROL_REACH + MARGIN;
export const SEPARATION = 12;
export const MIN_LANE = 40;
/** A patrol comes into sight and goes this much over the highest roof (masts included) within `POP_ROOM` of it (m). */
export const ROOF_ROOM = 2;
export const POP_ROOM = 25;
/** Its column's top keeps this far under the lowest canyon drone flying within `CANYON_ROOM` of it (m). */
export const CANYON_GAP = 2;
/** The canyon drones' loops reach `LEG` past their axis and half the widest drone more; with the patrol's reach and a margin (m). */
const CANYON_ROOM = 8;

const around = (p: P2, r: number): Box2 => ({ minX: p.x - r, maxX: p.x + r, minZ: p.z - r, maxZ: p.z + r });

/** The queries of a plan: the street's surfaces by their 32 m bins, the band and the column. */
const queries = (world: PatrolWorld, canyon: readonly DroneLane[]) => {
  const floors: { p: P2; level: number }[] = canyon.flatMap((l) => l.points.map((p, i) => ({ p, level: l.levels[i] as number })));
  const floorIndex = new BinIndex();
  floors.forEach((f, i) => floorIndex.add(i, around(f.p, 0)));
  /** The lowest foot of a canyon drone flying near `p`: its lane's level (the advertisers fly on it, ADR-0058 stage 7). */
  const canyonFloor = (p: P2): number => Math.min(Infinity, ...[...floorIndex.within(around(p, CANYON_ROOM))].map((i) => (floors[i] as { level: number }).level));
  const roads = world.roads.map((ring) => ({ ring }));
  const index = new BinIndex();
  roads.forEach((r, i) => index.add(i, boundsOf(r.ring)));
  const onRoad = (p: P2): boolean => [...index.at(p.x, p.z)].some((i) => pointInRing(p, (roads[i] as { ring: readonly P2[] }).ring));
  const band = (p: P2, top: number): boolean => {
    const ground = world.surfaceAt(p.x, p.z);
    return world.air.clear(p, ground + PATROL_ALTITUDE - PATROL_BOB - MARGIN, ground + top + PATROL_BOB + MARGIN, ROOM);
  };
  return {
    /** The band from `p` a step on towards `q`, metre by metre: over the street either side, clear of the air. */
    band: (p: P2, q: P2, nx: number, nz: number): boolean => {
      for (let t = 0; t < STEP; t++) {
        const c = { x: p.x + ((q.x - p.x) * t) / STEP, z: p.z + ((q.z - p.z) * t) / STEP };
        if (!onRoad({ x: c.x + nx * ROOM, z: c.z + nz * ROOM }) || !onRoad({ x: c.x - nx * ROOM, z: c.z - nz * ROOM }) || !onRoad(c)) return false;
        if (!band(c, PATROL_ALTITUDE + PATROL_SIZE.height)) return false;
      }
      return true;
    },
    /**
     * The ceiling over `p` (the foot's y where a patrol comes into sight or goes): `ROOF_ROOM` over the
     * roofs round it, `PATROL_CEILING` over the paving at least; null where the column from the band up
     * to it is not clear or reaches a canyon drone.
     */
    column: (p: P2): number | null => {
      const ground = world.surfaceAt(p.x, p.z);
      const ceiling = Math.max(ground + PATROL_CEILING, world.air.highest(p, POP_ROOM) + ROOF_ROOM);
      const top = ceiling + PATROL_SIZE.height + PATROL_BOB;
      if (top + CANYON_GAP > canyonFloor(p)) return null;
      return band(p, ceiling - ground + PATROL_SIZE.height) ? ceiling : null;
    },
  };
};

interface Sample {
  readonly p: P2;
  readonly band: boolean;
  /** Where a patrol may come into sight or go over it, null where it may not. */
  readonly column: number | null;
}

/** The lanes of the city, in the order of the joined axes; `canyon`, the canyon drones' lanes (ADR-0058 stage 7) the columns keep under. */
export const planPatrolLanes = (world: PatrolWorld, canyon: readonly DroneLane[] = []): PatrolLane[] => {
  const q = queries(world, canyon);
  const taken = new BinIndex();
  let takenId = 0;
  const lanes: PatrolLane[] = [];
  for (const line of joinAxes(world.axes)) {
    const pts = resample(line);
    if ((pts.length - 1) * STEP < MIN_LANE) continue;
    const samples: Sample[] = pts.map((p, i) => {
      const a = pts[Math.max(0, i - 1)] as P2;
      const b = pts[Math.min(pts.length - 1, i + 1)] as P2;
      const d = Math.hypot(b.x - a.x, b.z - a.z) || 1;
      const nx = -(b.z - a.z) / d;
      const nz = (b.x - a.x) / d;
      const free = world.groundAt(p.x, p.z) !== null && [...taken.within(around(p, SEPARATION))].length === 0;
      // The last sample has no step on: only itself.
      const band = free && q.band(p, i + 1 < pts.length ? b : p, nx, nz);
      return { p, band, column: band ? q.column(p) : null };
    });
    for (const run of runsOf(samples)) {
      const lane = laneOf(run, world);
      lanes.push(lane);
      for (const p of lane.points) taken.add(takenId++, around(p, 0));
    }
  }
  return lanes;
};

/** Runs of samples clear in the band, cut to their first and last with a clear column, at least `MIN_LANE` long. */
const runsOf = (samples: readonly Sample[]): Sample[][] => {
  const out: Sample[][] = [];
  let start = -1;
  for (let i = 0; i <= samples.length; i++) {
    const ok = i < samples.length && (samples[i] as Sample).band;
    if (ok && start < 0) start = i;
    if (ok || start < 0) continue;
    let a = start;
    let b = i - 1;
    while (a < b && (samples[a] as Sample).column === null) a++;
    while (b > a && (samples[b] as Sample).column === null) b--;
    if ((b - a) * STEP >= MIN_LANE) out.push(samples.slice(a, b + 1));
    start = -1;
  }
  return out;
};

/** A lane from a run: its points, the paving under them, and its seed from where it starts. */
const laneOf = (run: readonly Sample[], world: PatrolWorld): PatrolLane => {
  const first = (run[0] as Sample).p;
  const points = run.map((s) => s.p);
  return {
    points,
    grounds: points.map((p) => world.surfaceAt(p.x, p.z)),
    length: (run.length - 1) * STEP,
    seed: (Math.imul(Math.round(first.x * 10), 83492791) ^ Math.imul(Math.round(first.z * 10), 2654435761)) >>> 0,
    quiet: points.filter((p) => world.quietAt(p.x, p.z)).length * 2 > points.length,
    square: points.filter((p) => world.squareAt?.(p.x, p.z) ?? false).length / points.length,
    ceilings: [(run[0] as Sample).column as number, (run[run.length - 1] as Sample).column as number],
  };
};
