import { type GroundSurface, VEHICLE_SIZE, type VehicleModel, type ViewDescriptor } from "@seki/core";
import type { StaticProp } from "./builders";
import { furnitureClearance } from "./furniture-index";
import { inBuilding, nearestWall } from "./lublin/places";
import { type Pt, ROAD_CHAINS, polylineLength, surfacesAt } from "./lublin/roads";
import { MAP_CHUNKS } from "./lublin/sites";
import { groundY } from "./lublin/terrain";
import { clearOfGame } from "./street-props";
import { KERB_ROOM, TRAFFIC_ROUTES, laneOffset, offsetLine, pointAt, projectOn, roadHalfWidth } from "./traffic";

/**
 * Cars parked along the kerbs and on Plac Zamkowy (ADR-0050), which really is a car park.
 * Pure data of the map, chosen once by position hashes: the side streets' right-hand kerb where
 * the carriageway leaves room beside the lane, and rows of bays on the square's cobbles. Each
 * one is a static solid of the simulation and a piece of the scenery.
 */

export interface ParkedCar {
  readonly chunk: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Facing (its front), radians from +z towards +x. */
  readonly yaw: number;
  readonly model: VehicleModel;
  readonly tint: number;
}

const hash = (x: number, z: number, salt: number): number => {
  let h = Math.imul(Math.round(x * 10) + salt * 7919, 73856093) ^ Math.imul(Math.round(z * 10), 19349663);
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
  return (h ^ (h >>> 15)) >>> 0;
};

const PARKED_MODELS: readonly VehicleModel[] = ["sedan", "sedan", "hatchback", "hatchback", "taxi", "van", "delivery"];

/** Bays this far apart along a kerb (m). */
const KERB_BAY = 6.2;
/** Bays this close to a street's ends (its junctions) stay empty. */
const JUNCTION_CLEAR = 12;
/** A parked car's side keeps this far from the axis of a lane cars drive (their half width and a gap, m). */
const LANE_CLEAR = 1.4;
/** Sideways shifts tried for a kerb bay, the kerb line's own first (m, negative towards the axis). */
const KERB_NUDGE = [0, -0.4, -0.8, -1.2, 0.4] as const;
/** Share of the bays taken. */
const KERB_TAKEN = 0.62;
const SQUARE_TAKEN = 0.8;

const chunkOf = (x: number, z: number): string =>
  MAP_CHUNKS.find((c) => x >= c.bounds.minX && x <= c.bounds.maxX && z >= c.bounds.minZ && z <= c.bounds.maxZ)?.id ?? "";

/** The corners of a car's footprint at (x, z), facing yaw, grown by `pad`. */
const footprint = (x: number, z: number, yaw: number, model: VehicleModel, pad: number): Pt[] => {
  const { width, length } = VEHICLE_SIZE[model];
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const hw = width / 2 + pad;
  const hl = length / 2 + pad;
  return [
    [x - fx * hl - fz * hw, z - fz * hl + fx * hw],
    [x + fx * hl - fz * hw, z + fz * hl + fx * hw],
    [x + fx * hl + fz * hw, z + fz * hl - fx * hw],
    [x - fx * hl + fz * hw, z - fz * hl - fx * hw],
  ];
};

/** Surfaces a car may stand on: the carriageway (a zebra on it too) and the cobbled squares. */
const PARKABLE: ReadonlySet<GroundSurface> = new Set<GroundSurface>(["road", "crossing", "cobble", "square"]);
const parkable = (x: number, z: number): boolean => surfacesAt(x, z).some((s) => PARKABLE.has(s));

/**
 * Is a car's footprint at (x, z), facing yaw, wholly on a carriageway or a square and free of
 * walls, furniture, the game's places and other streets' axes? A street's kerb line is set from
 * its median width, so where the carriageway narrows (a bend, a pinch by a pavement) the bay
 * falls on the grass or the pavement unless each corner is checked.
 */
const fits = (x: number, z: number, yaw: number, model: VehicleModel): boolean => {
  if (!parkable(x, z) || !footprint(x, z, yaw, model, 0).every(([px, pz]) => parkable(px, pz))) return false;
  const { width, length } = VEHICLE_SIZE[model];
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  for (const t of [-0.5, 0, 0.5]) {
    const px = x + fx * length * t;
    const pz = z + fz * length * t;
    if (inBuilding(px, pz) || nearestWall(px, pz).d < width / 2 + 0.4 || furnitureClearance(px, pz) < width / 2 + 0.3) return false;
  }
  // Off every lane cars drive (a junction, a bend of a crossing street).
  for (const r of TRAFFIC_ROUTES) if (r.use !== "deliveries" && projectOn(r.points, x, z).d < LANE_CLEAR + width / 2) return false;
  return clearOfGame(x, z, length / 2, length / 2) && chunkOf(x, z) !== "";
};

const modelAt = (x: number, z: number): VehicleModel => PARKED_MODELS[hash(x, z, 3) % PARKED_MODELS.length]!;

/** Cars along the right-hand kerb of the two-way side streets that have the room. */
const kerbCars = (): ParkedCar[] => {
  const out: ParkedCar[] = [];
  for (const c of ROAD_CHAINS) {
    if (c.use !== "cars" || (c.kind !== "residential" && c.kind !== "tertiary" && c.kind !== "unclassified")) continue;
    const len = polylineLength(c.points);
    for (const pts of [c.points, [...c.points].reverse()] as const) {
      const half = roadHalfWidth(pts, 1);
      if (half < KERB_ROOM) continue;
      // By the kerb, and never closer to the axis than the lane's car leaves room for.
      const kerb: Pt[] = offsetLine(pts, Math.max(half - 1.15, laneOffset(half) + 2.2));
      for (let s = JUNCTION_CLEAR; s < len - JUNCTION_CLEAR; s += KERB_BAY) {
        const p = pointAt(kerb, s);
        if (hash(p.x, p.z, 1) / 0x100000000 >= KERB_TAKEN) continue;
        const yaw = Math.atan2(p.tx, p.tz);
        const model = modelAt(p.x, p.z);
        // The kerb line is the street's median one; where the carriageway is locally narrower the car edges in.
        const shift = KERB_NUDGE.find((d) => fits(p.x + p.tz * d, p.z - p.tx * d, yaw, model));
        if (shift === undefined) continue;
        const x = p.x + p.tz * shift;
        const z = p.z - p.tx * shift;
        out.push({ chunk: chunkOf(x, z), x: Math.round(x * 100) / 100, y: 0, z: Math.round(z * 100) / 100, yaw: Math.round(yaw * 1000) / 1000, model, tint: hash(p.x, p.z, 2) });
      }
    }
  }
  return out;
};

/** The car park of Plac Zamkowy: the square's cobbles west of the castle stairs, in rows of bays. */
const PLAC_ZAMKOWY = { minX: 712, maxX: 762, minZ: 188, maxZ: 300 } as const;
/** Bays: across 2.7 m, rows 6 m deep with a 6 m aisle every second row. */
const BAY_WIDTH = 2.7;
const ROW_STEP = [6, 12] as const;

/** The square's own street (its ring) stays a free way round the bays. */
const RING = ROAD_CHAINS.filter((c) => c.name === "Plac Zamkowy");
const nearRing = (x: number, z: number): boolean =>
  RING.some((c) => c.points.some((p, i) => i > 0 && segmentDistance(x, z, c.points[i - 1]!, p) < 4.5));

const segmentDistance = (x: number, z: number, a: Pt, b: Pt): number => {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / len2));
  return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
};

const squareCars = (): ParkedCar[] => {
  const out: ParkedCar[] = [];
  let x = PLAC_ZAMKOWY.minX + 3;
  for (let row = 0; x < PLAC_ZAMKOWY.maxX; row++) {
    // Rows face each other across an aisle: east, then west.
    const yaw = row % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
    for (let z = PLAC_ZAMKOWY.minZ + 2; z < PLAC_ZAMKOWY.maxZ; z += BAY_WIDTH) {
      const surfaces = surfacesAt(x, z);
      if (!surfaces.includes("cobble") && !surfaces.includes("square")) continue;
      if (nearRing(x, z) || hash(x, z, 4) / 0x100000000 >= SQUARE_TAKEN) continue;
      const model = modelAt(x, z);
      if (model === "delivery" || !fits(x, z, yaw, model)) continue;
      out.push({ chunk: chunkOf(x, z), x, y: 0, z: Math.round(z * 100) / 100, yaw, model, tint: hash(x, z, 5) });
    }
    x += ROW_STEP[row % 2]!;
  }
  return out;
};

/** Do two footprints overlap (separating axes of two rectangles)? */
const overlap = (a: ParkedCar, b: ParkedCar): boolean => {
  const pa = footprint(a.x, a.z, a.yaw, a.model, 0.15);
  const pb = footprint(b.x, b.z, b.yaw, b.model, 0.15);
  for (const poly of [pa, pb]) {
    for (let i = 0; i < 2; i++) {
      const ex = poly[i + 1]![0] - poly[i]![0];
      const ez = poly[i + 1]![1] - poly[i]![1];
      const ax = -ez;
      const az = ex;
      const span = (pts: Pt[]) => pts.map((p) => p[0] * ax + p[1] * az);
      const sa = span(pa);
      const sb = span(pb);
      if (Math.max(...sa) < Math.min(...sb) || Math.max(...sb) < Math.min(...sa)) return false;
    }
  }
  return true;
};

/** Every parked car of the city, on the game's terrain, in a stable order; the square's bays first, no two overlapping. */
export const PARKED_CARS: readonly ParkedCar[] = [...squareCars(), ...kerbCars()]
  .reduce<ParkedCar[]>((kept, c) => (kept.some((k) => Math.hypot(k.x - c.x, k.z - c.z) < 8 && overlap(k, c)) ? kept : [...kept, c]), [])
  .map((c) => ({ ...c, y: Math.round(groundY(c.x, c.z) * 100) / 100 }));

/** The view of a parked car: drawn by the scenery. */
export const parkedView = (c: ParkedCar): ViewDescriptor => ({ kind: "vehicle", model: c.model, tint: c.tint, parked: true });

/** A parked car as a static solid of the simulation: its footprint turned by its yaw, as tall as the car. */
export const parkedProp = (c: ParkedCar): StaticProp => {
  const { width, length, height } = VEHICLE_SIZE[c.model];
  const fx = Math.sin(c.yaw);
  const fz = Math.cos(c.yaw);
  const corner = (a: number, b: number) => ({ x: fx * length * b + fz * width * a, z: fz * length * b - fx * width * a });
  return {
    center: { x: c.x, y: c.y, z: c.z },
    view: parkedView(c),
    solid: true,
    prisms: [{ points: [corner(-0.5, -0.5), corner(0.5, -0.5), corner(0.5, 0.5), corner(-0.5, 0.5)], bottom: -0.3, top: height }],
    scenery: true,
  };
};
