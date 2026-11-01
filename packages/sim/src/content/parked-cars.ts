import { type GroundSurface, VEHICLE_SIZE, type VehicleModel, type ViewDescriptor } from "@seki/core";
import type { StaticProp } from "./builders";
import { furnitureClearance } from "./furniture-index";
import { inBuilding, nearestWall } from "./lublin/places";
import { type Pt, ROAD_CHAINS, type RoadChain, polylineLength, surfacesAt } from "./lublin/roads";
import { MAP_CHUNKS } from "./lublin/sites";
import { groundY, restingY, surfaceY } from "./lublin/terrain";
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
/**
 * Shifts along the kerb tried for a bay none of whose nudges fits (on a slope, a bend, by a
 * driveway's mouth): to a flatter, straighter, free spot nearby (m). A mouth with its room is
 * some 5 m wide, so a bay at its middle has to move past ±2.5 m (G-140).
 */
const KERB_SLIDE = [0, -1.5, 1.5, -2.5, 2.5, -3.5, 3.5] as const;
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

/** Points under a car's body at (x, z), facing yaw: its corners, the middles of its sides and its centre. */
const underBody = (x: number, z: number, yaw: number, model: VehicleModel): { x: number; z: number }[] => {
  const { width, length } = VEHICLE_SIZE[model];
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  return [-0.5, 0, 0.5].flatMap((a) => [-0.5, 0, 0.5].map((b) => ({ x: x + fz * width * a + fx * length * b, z: z - fx * width * a + fz * length * b })));
};

/**
 * Most the paving drawn under a car's body may fall from its high side to its low one (m). A
 * parked car is drawn level (turned only by its yaw) and rests on its high side, so on a steeper
 * bay its low side would lift off the paving by more than a kerb (G-130).
 */
const LEVEL_DROP = 0.15;
const level = (x: number, z: number, yaw: number, model: VehicleModel): boolean => {
  const ys = underBody(x, z, yaw, model).map((p) => surfaceY(p.x, p.z));
  return Math.max(...ys) - Math.min(...ys) <= LEVEL_DROP;
};

/** Surfaces a car may stand on: the carriageway and the cobbled squares (never a zebra, see `clearOfZebras`). */
const PARKABLE: ReadonlySet<GroundSurface> = new Set<GroundSurface>(["road", "cobble", "square"]);
const parkable = (x: number, z: number): boolean => surfacesAt(x, z).some((s) => PARKABLE.has(s));

/**
 * Room a parked car leaves a zebra (m). The Polish code (art. 49 ust. 1 pkt 2 PoRD) bans parking
 * on a crossing and less than 10 m before it, so the free stretch runs ahead of the car's front
 * (its facing is the lane's way); behind it and to its sides the body only keeps a gap.
 */
const ZEBRA_AHEAD = 10;
const ZEBRA_GAP = 1;
const ZEBRAS = MAP_CHUNKS.flatMap((c) =>
  c.ground
    .filter((g) => g.surface === "crossing")
    .map((g) => {
      const pts = Array.from({ length: g.outline.length / 2 }, (_, i): Pt => [g.outline[2 * i]!, g.outline[2 * i + 1]!]);
      const xs = pts.map((p) => p[0]);
      const zs = pts.map((p) => p[1]);
      return { pts, minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) };
    }),
);

const cross = (o: Pt, a: Pt, b: Pt): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const segmentsGap = (a: Pt, b: Pt, c: Pt, d: Pt): number => {
  if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0;
  return Math.min(segmentDistance(a[0], a[1], c, d), segmentDistance(b[0], b[1], c, d), segmentDistance(c[0], c[1], a, b), segmentDistance(d[0], d[1], a, b));
};

/**
 * Does a car at (x, z), facing yaw, keep off every zebra and out of the 10 m before one? Its body
 * is taken as its axis grown by half its width and the gap (a capsule round the footprint, so no
 * corner slips onto a zebra), the axis drawn on ahead of the front by the banned stretch.
 */
const clearOfZebras = (x: number, z: number, yaw: number, model: VehicleModel): boolean => {
  if (surfacesAt(x, z).includes("crossing")) return false;
  const { width, length } = VEHICLE_SIZE[model];
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const back: Pt = [x - (fx * length) / 2, z - (fz * length) / 2];
  const reach = width / 2 + ZEBRA_GAP;
  // The capsule's round tip reaches `reach` past the axis' end: the stretch ahead of the front is then just ZEBRA_AHEAD.
  const ahead = length / 2 + Math.max(0, ZEBRA_AHEAD - reach);
  const front: Pt = [x + fx * ahead, z + fz * ahead];
  const r = reach + ahead;
  return ZEBRAS.every(
    ({ pts, minX, maxX, minZ, maxZ }) =>
      x < minX - r || x > maxX + r || z < minZ - r || z > maxZ + r || pts.every((p, i) => segmentsGap(back, front, pts[(i + 1) % pts.length]!, p) >= reach),
  );
};

const CAR_STREETS = ROAD_CHAINS.filter((c) => c.use === "cars");
/** Each car road's carriageway reach right and left of its axis (m), measured once. */
const CARRIAGEWAY = new Map(CAR_STREETS.map((c) => [c, [roadHalfWidth(c.points, 1), roadHalfWidth(c.points, -1)] as const]));

/**
 * Is a car of half width `hw` at (x, z) off the carriageway of every car road but its own? A
 * street's kerb line is set from how far paving reaches beside it, and beside a street that runs
 * alongside another one (a loop by an avenue) that paving is the other road's: the kerb then
 * falls on its lanes, which a short piece of road without a lane of its own does not guard.
 */
const offOtherRoads = (x: number, z: number, hw: number, own: RoadChain): boolean =>
  CAR_STREETS.every((c) => {
    if (c === own) return true;
    const q = projectOn(c.points, x, z);
    const [right, left] = CARRIAGEWAY.get(c)!;
    return q.d >= (q.side >= 0 ? right : left) + hw;
  });

/**
 * Room a parked car's body leaves the axis of an unnamed service road (a driveway, a yard's lane,
 * G-140): its half width and this gap (m). No lane of the game runs there, so nothing else keeps
 * the car off its mouth at the kerb.
 */
const SERVICE_GAP = 0.5;
/**
 * Least room a parked car's body leaves the axis of a footway or a path mapped on its own (m), or
 * its half width when wider (G-143). It is drawn over the asphalt where it meets a street, and the
 * paving check takes it for the carriageway.
 */
const FOOT_CLEAR = 1.25;

const wayRoom = (w: { readonly line: readonly number[] }, reach: number) => {
  const pts = Array.from({ length: w.line.length / 2 }, (_, i): Pt => [w.line[2 * i]!, w.line[2 * i + 1]!]);
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  return { pts, reach, minX: Math.min(...xs) - reach, maxX: Math.max(...xs) + reach, minZ: Math.min(...zs) - reach, maxZ: Math.max(...zs) + reach };
};
const KEPT_WAYS = [
  ...MAP_CHUNKS.flatMap((c) => c.serviceWays ?? []).map((w) => wayRoom(w, w.width / 2 + SERVICE_GAP)),
  ...MAP_CHUNKS.flatMap((c) => c.footWays ?? []).map((w) => wayRoom(w, Math.max(FOOT_CLEAR, w.width / 2))),
];

const inside = (p: Pt, poly: readonly Pt[]): boolean => poly.every((a, i) => cross(a, poly[(i + 1) % poly.length]!, p) <= 0) || poly.every((a, i) => cross(a, poly[(i + 1) % poly.length]!, p) >= 0);

/** Does a car's footprint at (x, z), facing yaw, keep its room off every service road's and footway's axis? */
const clearOfKeptWays = (x: number, z: number, yaw: number, model: VehicleModel): boolean => {
  const body = footprint(x, z, yaw, model, 0);
  const r = Math.hypot(VEHICLE_SIZE[model].width, VEHICLE_SIZE[model].length) / 2;
  return KEPT_WAYS.every(
    (w) =>
      x + r < w.minX ||
      x - r > w.maxX ||
      z + r < w.minZ ||
      z - r > w.maxZ ||
      (!w.pts.some((p) => inside(p, body)) && w.pts.every((p, i) => i === 0 || body.every((a, k) => segmentsGap(w.pts[i - 1]!, p, a, body[(k + 1) % 4]!) >= w.reach))),
  );
};

/**
 * Room a parked car leaves a bus stop (m). The Polish code (art. 49 ust. 1 pkt 9 PoRD) bans
 * stopping less than 15 m from the stop's post, before or after it, on the post's side of its
 * street: within `STOP_ACROSS` of the post across the street (as far as that kerb's cars stand)
 * the car's body keeps that far along it (G-156).
 */
const STOP_CLEAR = 15;
const STOP_ACROSS = 7;
/** A post is by the nearest car road within this (m); one farther off stands by none of them. */
const STOP_STREET = 20;
const BUS_STOPS = MAP_CHUNKS.flatMap((c) => Array.from({ length: (c.busStops ?? []).length / 2 }, (_, i): Pt => [c.busStops![2 * i]!, c.busStops![2 * i + 1]!]))
  .filter((p, i, all) => all.findIndex((q) => q[0] === p[0] && q[1] === p[1]) === i)
  .flatMap(([x, z]) => {
    const by = CAR_STREETS.map((c) => ({ c, q: projectOn(c.points, x, z) })).sort((a, b) => a.q.d - b.q.d)[0];
    if (!by || by.q.d >= STOP_STREET) return [];
    const t = pointAt(by.c.points, by.q.s);
    return [{ x, z, street: by.c, side: Math.sign(by.q.side), tx: t.tx, tz: t.tz }];
  });

/** Does a car at (x, z) keep out of every bus stop's banned stretch (`STOP_CLEAR`)? */
const clearOfStops = (x: number, z: number, model: VehicleModel): boolean => {
  const reach = STOP_CLEAR + VEHICLE_SIZE[model].length / 2;
  return BUS_STOPS.every(
    (p) =>
      Math.hypot(x - p.x, z - p.z) > reach + STOP_ACROSS ||
      Math.abs((x - p.x) * p.tx + (z - p.z) * p.tz) >= reach ||
      Math.abs((x - p.x) * p.tz - (z - p.z) * p.tx) >= STOP_ACROSS ||
      Math.sign(projectOn(p.street.points, x, z).side) !== p.side,
  );
};

/** The car parks of the map data, each once (one reaching over a chunk's edge is in both chunks). */
const CAR_PARKS = [...new Map(MAP_CHUNKS.flatMap((c) => c.carParks ?? []).map((p) => [p.id, p])).values()].map((p) => ({
  kind: p.kind,
  ring: Array.from({ length: p.outline.length / 2 }, (_, i): Pt => [p.outline[2 * i]!, p.outline[2 * i + 1]!]),
}));
/** Car parks along a street's kerb: a strip beside the carriageway, a parking lane, half on the pavement. */
const KERB_PARKS = CAR_PARKS.filter((p) => p.kind === "street_side" || p.kind === "lane" || p.kind === "half_on_kerb");

const inRing = (x: number, z: number, ring: readonly Pt[]): boolean => {
  let on = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [ax, az] = ring[i]!;
    const [bx, bz] = ring[j]!;
    if (az > z !== bz > z && x < ((bx - ax) * (z - az)) / (bz - az) + ax) on = !on;
  }
  return on;
};

/**
 * A street of two lanes or more a way has no room at its kerb: a car parked there stands on the
 * outer lane (G-155). The game drives one lane a way, so nothing else keeps a car off it. A car
 * is by such a kerb when an axis of one runs within this of it (m) and within 20° of its facing.
 */
const MULTI_LANE_REACH = 12;
const MULTI_LANE_SEGMENTS = MAP_CHUNKS.flatMap((c) => c.multiLaneWays ?? []).flatMap((w) =>
  Array.from({ length: w.line.length / 2 - 1 }, (_, i) => {
    const a: Pt = [w.line[2 * i]!, w.line[2 * i + 1]!];
    const b: Pt = [w.line[2 * i + 2]!, w.line[2 * i + 3]!];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return { a, b, tx: (b[0] - a[0]) / (len || 1), tz: (b[1] - a[1]) / (len || 1) };
  }),
);

/** Is a car at (x, z), facing yaw, off every multi-lane street's kerb, or in a car park the map draws there? */
const offMultiLaneKerbs = (x: number, z: number, yaw: number): boolean =>
  MULTI_LANE_SEGMENTS.every(
    (s) => Math.abs(s.tx * Math.sin(yaw) + s.tz * Math.cos(yaw)) < Math.cos((20 * Math.PI) / 180) || segmentDistance(x, z, s.a, s.b) >= MULTI_LANE_REACH,
  ) || CAR_PARKS.some((p) => inRing(x, z, p.ring));

/**
 * Is a car's footprint at (x, z), facing yaw, wholly on a carriageway or a square and free of
 * walls, furniture, the game's places, service roads, footways, bus stops, multi-lane kerbs and other streets' axes (and carriageways, by the kerb of
 * `own`)? A street's kerb line is set from its median width, so where the carriageway narrows
 * (a bend, a pinch by a pavement) the bay falls on the grass or the pavement unless each corner
 * is checked. A bay on a slope too steep for a level car (`LEVEL_DROP`) stays empty.
 */
const fits = (x: number, z: number, yaw: number, model: VehicleModel, own?: RoadChain): boolean => {
  if (!parkable(x, z) || !footprint(x, z, yaw, model, 0).every(([px, pz]) => parkable(px, pz)) || !clearOfZebras(x, z, yaw, model)) return false;
  if (!level(x, z, yaw, model) || !clearOfKeptWays(x, z, yaw, model) || !clearOfStops(x, z, model) || !offMultiLaneKerbs(x, z, yaw)) return false;
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
  if (own && !offOtherRoads(x, z, width / 2, own)) return false;
  return clearOfGame(x, z, length / 2, length / 2) && chunkOf(x, z) !== "";
};

const modelAt = (x: number, z: number): VehicleModel => PARKED_MODELS[hash(x, z, 3) % PARKED_MODELS.length]!;

/**
 * Cars along both kerbs of the side streets that have the room: on a two-way street each kerb is
 * the right-hand one of its way; on a one-way street both face the way it is driven.
 */
const kerbCars = (): ParkedCar[] => {
  const out: ParkedCar[] = [];
  for (const c of ROAD_CHAINS) {
    if (c.use !== "cars" || (c.kind !== "residential" && c.kind !== "tertiary" && c.kind !== "unclassified")) continue;
    const len = polylineLength(c.points);
    for (const pts of [c.points, [...c.points].reverse()] as const) {
      // The far kerb of a one-way street is walked the other way, but its cars turn to the traffic's way.
      const turned = c.oneway && pts !== c.points;
      const half = roadHalfWidth(pts, 1);
      if (half < KERB_ROOM) continue;
      // By the kerb, and never closer to the axis than the lane's car leaves room for.
      const kerb: Pt[] = offsetLine(pts, Math.max(half - 1.15, laneOffset(half) + 2.2));
      for (let s = JUNCTION_CLEAR; s < len - JUNCTION_CLEAR; s += KERB_BAY) {
        const p = pointAt(kerb, s);
        if (hash(p.x, p.z, 1) / 0x100000000 >= KERB_TAKEN) continue;
        const yaw = turned ? Math.atan2(-p.tx, -p.tz) : Math.atan2(p.tx, p.tz);
        const model = modelAt(p.x, p.z);
        // The kerb line is the street's median one; where the carriageway is locally narrower the car edges in.
        const at = (a: number, d: number) => ({ x: p.x + p.tx * a + p.tz * d, z: p.z + p.tz * a - p.tx * d });
        const car = (q: { x: number; z: number }): ParkedCar => ({ chunk: chunkOf(q.x, q.z), x: Math.round(q.x * 100) / 100, y: 0, z: Math.round(q.z * 100) / 100, yaw: Math.round(yaw * 1000) / 1000, model, tint: hash(p.x, p.z, 2) });
        // A bay slid off a footway's mouth (G-143) may reach the last one's: it slides on past it instead.
        const spot = KERB_SLIDE.flatMap((a) => KERB_NUDGE.map((d) => at(a, d))).find((q) => fits(q.x, q.z, yaw, model, c) && !out.some((k) => Math.hypot(k.x - q.x, k.z - q.z) < 8 && overlap(k, car(q))));
        if (spot !== undefined) out.push(car(spot));
      }
    }
  }
  return out;
};

/** The farthest from a street's axis a kerb car park's cars are sought (m). */
const BAY_REACH = 16;
/** The narrowest strip across its street a kerb car park holds a car in (m): a car's width, give or take a nudge. */
const BAY_STRIP = 1.5;

/**
 * Cars in the car parks the map draws along a street's kerb (`parking=street_side`, `lane`,
 * `half_on_kerb`): walked along the street's axis, a bay every `KERB_BAY` in the middle of the
 * strip the area covers across it, along the kerb and facing the traffic's way on its side. A
 * mapped car park is as full as Plac Zamkowy's. The kerb line of `kerbCars` is the street's
 * median one and misses a strip that only widens the carriageway in places.
 */
const bayCars = (): ParkedCar[] => {
  const out: ParkedCar[] = [];
  for (const park of KERB_PARKS) {
    for (const c of CAR_STREETS) {
      if (!park.ring.some(([x, z]) => projectOn(c.points, x, z).d < BAY_REACH)) continue;
      const len = polylineLength(c.points);
      for (const side of [1, -1] as const) {
        const turned = !c.oneway && side < 0;
        for (let s = 0; s < len; s += KERB_BAY) {
          const p = pointAt(c.points, s);
          const across = (d: number) => ({ x: p.x + p.tz * side * d, z: p.z - p.tx * side * d });
          let from = -1;
          let to = -1;
          for (let d = 1; d <= BAY_REACH && (to < 0 || to === d - 0.25); d += 0.25) {
            const q = across(d);
            if (!inRing(q.x, q.z, park.ring)) continue;
            if (from < 0) from = d;
            to = d;
          }
          if (from < 0 || to - from < BAY_STRIP) continue;
          const at = across((from + to) / 2);
          if (hash(at.x, at.z, 1) / 0x100000000 >= SQUARE_TAKEN) continue;
          const yaw = Math.round((turned ? Math.atan2(-p.tx, -p.tz) : Math.atan2(p.tx, p.tz)) * 1000) / 1000;
          const model = modelAt(at.x, at.z);
          const car = (a: number, d: number): ParkedCar => {
            const q = across((from + to) / 2 + d);
            const x = Math.round((q.x + p.tx * a) * 100) / 100;
            const z = Math.round((q.z + p.tz * a) * 100) / 100;
            return { chunk: chunkOf(x, z), x, y: 0, z, yaw, model, tint: hash(at.x, at.z, 2) };
          };
          // Slid and nudged as a kerb bay is, but kept with its middle in the car park.
          const spot = KERB_SLIDE.flatMap((a) => KERB_NUDGE.map((d) => car(a, d))).find(
            (k) => inRing(k.x, k.z, park.ring) && fits(k.x, k.z, yaw, model) && !out.some((o) => Math.hypot(o.x - k.x, o.z - k.z) < 8 && overlap(o, k)),
          );
          if (spot) out.push(spot);
        }
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

/**
 * Every parked car of the city, on the paving drawn under its body (G-130), in a stable order;
 * the square's bays first, then the kerbs' and the mapped kerb car parks', no two overlapping.
 */
export const PARKED_CARS: readonly ParkedCar[] = [...squareCars(), ...kerbCars(), ...bayCars()]
  .reduce<ParkedCar[]>((kept, c) => (kept.some((k) => Math.hypot(k.x - c.x, k.z - c.z) < 8 && overlap(k, c)) ? kept : [...kept, c]), [])
  .map((c) => ({ ...c, y: Math.round(restingY(underBody(c.x, c.z, c.yaw, c.model)) * 100) / 100 }));

/** The view of a parked car: drawn by the scenery. */
export const parkedView = (c: ParkedCar): ViewDescriptor => ({ kind: "vehicle", model: c.model, tint: c.tint, parked: true });

/**
 * A parked car as a static solid of the simulation: its footprint turned by its yaw, as tall as
 * the car, reaching down into the terrain under its lowest point so nobody slips under its low side.
 */
export const parkedProp = (c: ParkedCar): StaticProp => {
  const { width, length, height } = VEHICLE_SIZE[c.model];
  const fx = Math.sin(c.yaw);
  const fz = Math.cos(c.yaw);
  const corner = (a: number, b: number) => ({ x: fx * length * b + fz * width * a, z: fz * length * b - fx * width * a });
  const low = Math.min(...underBody(c.x, c.z, c.yaw, c.model).map((p) => groundY(p.x, p.z)));
  return {
    center: { x: c.x, y: c.y, z: c.z },
    view: parkedView(c),
    solid: true,
    prisms: [{ points: [corner(-0.5, -0.5), corner(0.5, -0.5), corner(0.5, 0.5), corner(-0.5, 0.5)], bottom: Math.min(-0.3, low - c.y - 0.1), top: height }],
    scenery: true,
  };
};
