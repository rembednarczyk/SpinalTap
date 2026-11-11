import { BARRIER_OPENINGS, BARRIER_THICKNESS, type GroundPoint, barrierMaterial, type StreetPropItem, VEHICLE_SIZE, doorLayout } from "@seki/core";
import { CAPSULE_DOOR } from "./capsule-room";
import { CROWD_LANES } from "./crowd";
import { furnitureClearance } from "./furniture-index";
import { S7_DOORS } from "./interiors";
import { barrierPieces } from "./lublin/barriers";
import { bridgeDeckAt, flightDeckAt } from "./lublin/decks";
import { surfacesAt } from "./lublin/roads";
import { FLIGHT_RAMPS, MAP_CHUNKS } from "./lublin/sites";
import { groundY } from "./lublin/terrain";
import type { LublinBarrierData } from "./lublin/types";
import { PARKED_CARS } from "./parked-cars";
import { WORLD_STREET_PROPS, clearOfGame } from "./street-props";
import { inBuilding } from "./lublin/places";
import { TRAFFIC_ROUTES } from "./traffic";

/**
 * The map's barriers in the game (ADR-0077 point 4): each chunk's walls, fences and hedges laid
 * as street pieces (`lublin/barriers.ts`), cut where the game's content needs the way clear. The
 * import has cut them at the buildings, carriageways, steps, the map's ways and gates already;
 * here they give way to the game's doors and the doors on the facades, the crowd's routes, the
 * cars' lanes, the flights of steps, the decks of the bridges, the parked cars, the solid
 * furniture and the set pieces, blocks and characters.
 */

type Pt = GroundPoint;

/** A barrier keeps this far from the line of a crowd's route (its walkers' side and a body), and of a car lane (half a car and a margin), metres. */
const CROWD_ROOM = 0.75;
const CAR_ROOM = 1.5;
/** In front of a door the way stays clear this far out, and this much wider than the door either side (m). */
const DOOR_OUT = 2.2;
const DOOR_SIDE = 0.6;
/**
 * A barrier keeps this far from the line of a flight of steps the map gives an incline (G-236,
 * G-255): the map's walls by a flight stand on its edge and at its landings, the game's flights
 * are walked up to 1.2 m off their lines.
 */
const FLIGHT_ROOM = 1.9;
/** A barrier keeps this far from a solid piece of furniture and a parked car (m). */
const FURNITURE_ROOM = 0.25;
const CAR_PARK_ROOM = 0.35;
/** Tested every this many metres; a stretch shorter than `MIN_RUN` left between cuts goes too. */
const STEP = 0.25;
const MIN_RUN = 0.6;

/** Segments bucketed by 8 m, for the distance from a point to the nearest. */
class SegmentGrid {
  private readonly cells = new Map<string, [Pt, Pt][]>();
  private static readonly CELL = 8;

  add(a: Pt, b: Pt): void {
    const c = SegmentGrid.CELL;
    for (let i = Math.floor(Math.min(a.x, b.x) / c); i <= Math.floor(Math.max(a.x, b.x) / c); i++) {
      for (let k = Math.floor(Math.min(a.z, b.z) / c); k <= Math.floor(Math.max(a.z, b.z) / c); k++) {
        const key = `${i}:${k}`;
        const list = this.cells.get(key);
        if (list) list.push([a, b]);
        else this.cells.set(key, [[a, b]]);
      }
    }
  }

  /** Is (x, z) closer than `r` (at most a cell) to a segment? */
  near(x: number, z: number, r: number): boolean {
    const c = SegmentGrid.CELL;
    const cx = Math.floor(x / c);
    const cz = Math.floor(z / c);
    for (let i = cx - 1; i <= cx + 1; i++) {
      for (let k = cz - 1; k <= cz + 1; k++) {
        for (const [a, b] of this.cells.get(`${i}:${k}`) ?? []) if (segmentDistance(x, z, a, b) < r) return true;
      }
    }
    return false;
  }
}

const segmentDistance = (x: number, z: number, a: Pt, b: Pt): number => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
};

const pointsOf = (flat: readonly number[]): Pt[] => {
  const out: Pt[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push({ x: flat[i] as number, z: flat[i + 1] as number });
  return out;
};

const crowdLanes = new SegmentGrid();
for (const l of CROWD_LANES) {
  l.points.forEach((p, k) => {
    const q = l.points[(k + 1) % l.points.length] as readonly [number, number];
    crowdLanes.add({ x: p[0], z: p[1] }, { x: q[0], z: q[1] });
  });
}
const flights = new SegmentGrid();
for (const r of FLIGHT_RAMPS) flights.add(r.a, r.b);
for (const c of MAP_CHUNKS) {
  for (const f of c.flights ?? []) {
    const line = pointsOf(f.line);
    line.slice(1).forEach((p, k) => flights.add(line[k] as Pt, p));
  }
}
const carLanes = new SegmentGrid();
for (const r of TRAFFIC_ROUTES) {
  r.points.slice(1).forEach((p, k) => {
    const a = r.points[k] as readonly [number, number];
    carLanes.add({ x: a[0], z: a[1] }, { x: p[0], z: p[1] });
  });
}

/** The way in front of a door: its centre, the unit direction out of it, its half width. */
interface DoorWay {
  readonly x: number;
  readonly z: number;
  readonly ox: number;
  readonly oz: number;
  readonly half: number;
}

/** The game's doors (the clinic, Neon Koi, the capsule room) open both ways; the facades' doors out (+z of the piece). */
const DOOR_WAYS: readonly DoorWay[] = [
  ...S7_DOORS.flatMap((d) => {
    const [ox, oz] = d.along === "x" ? [0, 1] : [1, 0];
    return [1, -1].map((s) => ({ x: d.at.x, z: d.at.z, ox: ox * s, oz: oz * s, half: d.width / 2 }));
  }),
  ...[1, -1].map((s) => ({ x: CAPSULE_DOOR.at.x, z: CAPSULE_DOOR.at.z, ox: 0, oz: s, half: CAPSULE_DOOR.width / 2 })),
  ...Object.values(WORLD_STREET_PROPS)
    .flat()
    .filter((i) => i.prop === "door")
    .map((i) => ({ x: i.x, z: i.z, ox: Math.sin(i.yaw), oz: Math.cos(i.yaw), half: doorLayout(i.variant).width / 2 })),
];

/** Is (x, z) in the way in front of a door: out to `DOOR_OUT`, `DOOR_SIDE` wider than it either side? */
export const beforeDoor = (x: number, z: number, d: DoorWay, half = 0): boolean => {
  const dx = x - d.x;
  const dz = z - d.z;
  const out = dx * d.ox + dz * d.oz;
  const side = dx * d.oz - dz * d.ox;
  return out > -0.3 - half && out < DOOR_OUT + half && Math.abs(side) < d.half + DOOR_SIDE + half;
};

/** A barrier keeps this far from a bridge's or a flight's deck (m): the deck's own edges are its parapets, the ground under it is not where the map's wall stands. */
const DECK_ROOM = 1.5;
const AROUND: readonly (readonly [number, number])[] = [
  [0, 0],
  [DECK_ROOM, 0],
  [-DECK_ROOM, 0],
  [0, DECK_ROOM],
  [0, -DECK_ROOM],
];

/** Is (x, z) on a deck of a bridge or a flight, or within `DECK_ROOM` of one? */
const byDeck = (x: number, z: number): boolean => AROUND.some(([dx, dz]) => bridgeDeckAt(x + dx, z + dz) !== null || flightDeckAt(x + dx, z + dz) !== null);

/** Steps or a zebra drawn under a barrier's line or either face of it (the import cut its line off them already). */
const onStepsOrZebra = (x: number, z: number, half: number): boolean =>
  AROUND.some(([dx, dz]) => surfacesAt(x + (dx / DECK_ROOM) * (half + 0.1), z + (dz / DECK_ROOM) * (half + 0.1)).some((s) => s === "steps" || s === "crossing"));

/** Is (x, z) by a parked car's body (`CAR_PARK_ROOM` round it)? */
const byParkedCar = (x: number, z: number, half = 0): boolean =>
  PARKED_CARS.some((c) => {
    const size = VEHICLE_SIZE[c.model];
    const dx = x - c.x;
    const dz = z - c.z;
    if (Math.abs(dx) > 7 || Math.abs(dz) > 7) return false;
    const along = dx * Math.sin(c.yaw) + dz * Math.cos(c.yaw);
    const across = dx * Math.cos(c.yaw) - dz * Math.sin(c.yaw);
    return Math.abs(along) < size.length / 2 + CAR_PARK_ROOM + half && Math.abs(across) < size.width / 2 + CAR_PARK_ROOM + half;
  });

/**
 * Does the game need a barrier `half` metres thick either side of its line (x, z) out of the way:
 * its line in a building, its faces in a door's way, by a lane, steps, a deck or a solid?
 */
export const barrierBlocked = (x: number, z: number, half = 0): boolean =>
  inBuilding(x, z) ||
  !clearOfGame(x, z, 0.3 + half) ||
  DOOR_WAYS.some((d) => Math.abs(x - d.x) < 4 && Math.abs(z - d.z) < 4 && beforeDoor(x, z, d, half)) ||
  crowdLanes.near(x, z, CROWD_ROOM + half) ||
  carLanes.near(x, z, CAR_ROOM + half) ||
  flights.near(x, z, FLIGHT_ROOM + half) ||
  byDeck(x, z) ||
  onStepsOrZebra(x, z, half) ||
  furnitureClearance(x, z) < FURNITURE_ROOM + half ||
  byParkedCar(x, z, half);

/** The stretches of a polyline the game leaves clear of: tested every `STEP` metres, runs shorter than `MIN_RUN` dropped. */
const clearRuns = (line: readonly Pt[], half: number): Pt[][] => {
  const out: Pt[][] = [];
  let run: Pt[] = [];
  const close = () => {
    let len = 0;
    for (let k = 1; k < run.length; k++) len += Math.hypot((run[k] as Pt).x - (run[k - 1] as Pt).x, (run[k] as Pt).z - (run[k - 1] as Pt).z);
    if (len >= MIN_RUN) out.push(run);
    run = [];
  };
  for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i] as Pt;
    const b = line[i + 1] as Pt;
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / STEP));
    for (let k = i === 0 ? 0 : 1; k <= n; k++) {
      const p = { x: a.x + ((b.x - a.x) * k) / n, z: a.z + ((b.z - a.z) * k) / n };
      if (barrierBlocked(p.x, p.z, half)) close();
      else run.push(p);
    }
  }
  close();
  return out.map(simplifyRun);
};

/** Drops the samples of a run on a straight line between its neighbours: it keeps its corners and ends. */
const simplifyRun = (run: readonly Pt[]): Pt[] =>
  run.filter((p, k) => {
    if (k === 0 || k === run.length - 1) return true;
    const a = run[k - 1] as Pt;
    const b = run[k + 1] as Pt;
    return Math.abs((p.x - a.x) * (b.z - a.z) - (p.z - a.z) * (b.x - a.x)) > 1e-4;
  });

/** The pieces of one barrier of the map in the game: an opening whole where its posts stand clear, a solid kind in its clear runs. */
const piecesOf = (b: LublinBarrierData): StreetPropItem[] => {
  const line = pointsOf(b.line);
  const material = barrierMaterial(b.material);
  if (BARRIER_OPENINGS.has(b.kind)) return line.every((p) => clearOfGame(p.x, p.z, 0.2)) ? barrierPieces(b.kind, b.height, line, groundY, material) : [];
  return clearRuns(line, BARRIER_THICKNESS[b.kind] / 2).flatMap((run) => barrierPieces(b.kind, b.height, run, groundY, material));
};

/** The barriers of the game's Lublin per chunk (ADR-0077), as street pieces of kind `barrier`. */
export const WORLD_BARRIERS: Readonly<Record<string, readonly StreetPropItem[]>> = Object.fromEntries(
  MAP_CHUNKS.flatMap((c) => {
    const items = (c.barriers ?? []).flatMap(piecesOf);
    return items.length > 0 ? [[c.id, items]] : [];
  }),
);
