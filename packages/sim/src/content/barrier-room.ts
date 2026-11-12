import { type GroundPoint, type StreetPropItem, VEHICLE_SIZE, doorLayout } from "@seki/core";
import { ACTIVITY_SPOTS } from "./activity-spots";
import { CAPSULE_DOOR } from "./capsule-room";
import { CROWD_LANES, CROWD_SPOTS } from "./crowd";
import { furnitureClearance } from "./furniture-index";
import { S7_DOORS } from "./interiors";
import { bridgeDeckAt, flightDeckAt } from "./lublin/decks";
import { surfacesAt } from "./lublin/roads";
import { FLIGHT_RAMPS, MAP_CHUNKS } from "./lublin/sites";
import { PARKED_CARS } from "./parked-cars";
import { WORLD_STREET_PROPS, clearOfGame } from "./street-props";
import { inBuilding } from "./lublin/places";
import { BODY_RADIUS, WALKER_SIDE } from "./walker-size";
import { SegmentGrid } from "./segment-grid";
import { TRAFFIC_ROUTES } from "./traffic";

/**
 * Where the game needs the way clear of the map's barriers (ADR-0077 point 4): the import has cut
 * them at the buildings, carriageways, steps, the map's ways and gates already, and moved those
 * along a carriageway or a flight to its edge; here they give way to the game's doors and the
 * doors on the facades, the crowd's routes and places, the cars' lanes, the flights crossing
 * them, the decks of the bridges, the parked cars, the furniture (solid or not: a café's garden)
 * and the set pieces, blocks and characters.
 */

type Pt = GroundPoint;

/**
 * A barrier crossing a crowd's route keeps this far from its line (its walkers' side, 0.28 m, and
 * a body, 0.3 m); one running along a route keeps `CROWD_LINE` from it: a walker's side and
 * its body's radius, so that nobody walks into the solid (G-606: a route by a wall leaves
 * the wall; G-626: the walkers have no collision with solids, so the barrier gives way).
 * A barrier keeps `CAR_ROOM` from a car lane's line (half a delivery van and a margin), metres.
 */
const CROWD_ROOM = 0.65;
/** A little over, for the cut is tested every quarter metre and the piece rounded to the centimetre (m). */
const LINE_MARGIN = 0.04;
const CROWD_LINE = WALKER_SIDE + BODY_RADIUS + LINE_MARGIN;
const CAR_ROOM = 1.2;
/** In front of a door the way stays clear this far out, and this much wider than the door either side (m). */
const DOOR_OUT = 2.2;
const DOOR_SIDE = 0.6;
/**
 * A barrier crossing a flight of steps the map gives an incline (G-236, G-255) keeps this far from
 * its line: at its landings and its turns, where the game's flights are walked up to 1.2 m off
 * their lines. One running along it stays on its edge (G-607): the import moved it there.
 */
const FLIGHT_ROOM = 1.9;
/** A barrier keeps this far from a solid piece of furniture and a parked car (m). */
const FURNITURE_ROOM = 0.25;
const CAR_PARK_ROOM = 0.35;

export const pointsOf = (flat: readonly number[]): Pt[] => {
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
 * The pieces of furniture without a solid that a barrier still must not cut through (G-612): a
 * café's garden (its deck 4.2 x 3 m), a planter, a clump of shrubs; half extents in its frame.
 */
const FOOTPRINT: Readonly<Partial<Record<StreetPropItem["prop"], { readonly hx: number; readonly hz: number }>>> = {
  "cafe-garden": { hx: 2.1, hz: 1.5 },
  planter: { hx: 0.6, hz: 0.6 },
  shrubs: { hx: 0.8, hz: 0.8 },
};

/** Those pieces, by 16 m. */
const footprints = new Map<string, StreetPropItem[]>();
for (const i of Object.values(WORLD_STREET_PROPS).flat()) {
  if (!FOOTPRINT[i.prop]) continue;
  const k = `${Math.floor(i.x / 16)}:${Math.floor(i.z / 16)}`;
  footprints.set(k, [...(footprints.get(k) ?? []), i]);
}

/** Is (x, z) within `room` of the footprint of a café's garden, a planter or shrubs? */
export const inFootprint = (x: number, z: number, room: number): boolean => {
  const [cx, cz] = [Math.floor(x / 16), Math.floor(z / 16)];
  for (let i = cx - 1; i <= cx + 1; i++) {
    for (let k = cz - 1; k <= cz + 1; k++) {
      for (const p of footprints.get(`${i}:${k}`) ?? []) {
        const f = FOOTPRINT[p.prop]!;
        const [dx, dz] = [x - p.x, z - p.z];
        const along = Math.abs(dx * Math.sin(p.yaw) + dz * Math.cos(p.yaw));
        const across = Math.abs(dx * Math.cos(p.yaw) - dz * Math.sin(p.yaw));
        if (along < f.hz + room && across < f.hx + room) return true;
      }
    }
  }
  return false;
};

/** A resident's place keeps a body and the room before its face clear (G-612): the seats, the wall spots, the activities. */
const SPOT_ROOM = 0.8;
const SPOTS: readonly GroundPoint[] = [...CROWD_SPOTS.map((s) => s.at), ...ACTIVITY_SPOTS.map((s) => s.at)];
const bySpot = (x: number, z: number, half: number): boolean => SPOTS.some((s) => Math.abs(s.x - x) < 2 && Math.abs(s.z - z) < 2 && Math.hypot(s.x - x, s.z - z) < SPOT_ROOM + half);

/**
 * Does the game need a barrier `half` metres thick either side of its line (x, z), running along
 * `dir`, out of the way: its line in a building, its faces in a door's way, by a lane, a crossing
 * flight, steps, a deck, furniture or a resident's place?
 */
export const barrierBlocked = (x: number, z: number, half = 0, dir?: GroundPoint): boolean =>
  inBuilding(x, z) ||
  !clearOfGame(x, z, 0.3 + half) ||
  DOOR_WAYS.some((d) => Math.abs(x - d.x) < 4 && Math.abs(z - d.z) < 4 && beforeDoor(x, z, d, half)) ||
  crowdLanes.near(x, z, CROWD_ROOM + half, dir) ||
  crowdLanes.near(x, z, CROWD_LINE + half) ||
  carLanes.near(x, z, CAR_ROOM + half) ||
  flights.near(x, z, FLIGHT_ROOM + half, dir) ||
  byDeck(x, z) ||
  onStepsOrZebra(x, z, half) ||
  furnitureClearance(x, z) < FURNITURE_ROOM + half ||
  inFootprint(x, z, half + 0.05) ||
  bySpot(x, z, half) ||
  byParkedCar(x, z, half);
