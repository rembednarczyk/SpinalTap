import { arcBetween, bezier, onCarriageway, tightest } from "./traffic-junctions";
import { TURN_SPEED, type TrafficRoute, pointAt, projectOn, slice, stitch, uTurn } from "./traffic-lane";

/**
 * The cars at the deptak's south mouth (ADR-0074, T-324): Lubartowska from Bajkowskiego to Olejna
 * has no car lane, so the streets that met there have no way north any more. Bajkowskiego (one way
 * east, `turn:lanes=left|right`) turns only right, south into Lubartowska w40050981 and on to
 * Królewska: its right lane turns, its left lane changes onto the right one before the junction.
 * Lubartowska's lane northwards (w40050981) turns round by Bajkowskiego onto its lane southwards,
 * and Królewska's lanes turn round at its end (the Old Town's setts) as before: the two make a ring,
 * driven round and round, which Bajkowskiego's lanes run into where Królewska turns round. Without
 * this the junction joins only one of Bajkowskiego's lanes into the one lane south, and the other
 * one and Lubartowska's lane north end at the junction (`lane-dead-end`). Built on the city's
 * routes as joined at the junctions; pure data of the map, built once.
 */

/** Where Bajkowskiego, Lubartowska w40050981 and the short w173533826 into the deptak meet (Bajkowskiego's last point). */
export const DEPTAK_MOUTH = { x: 442.3, z: -15.8 } as const;
/** Bajkowskiego's lanes are found this far west of the junction (m). */
const APPROACH = 15;
/** The left lane changes onto the right one over this far (m), ending this far short of the right lane's turn. */
const CHANGE = 14;
const CHANGE_CLEAR = 4;
/** A lane change bends no tighter than this (m). */
const CHANGE_RADIUS = 8;
/** Lubartowska's route north ends within this of the junction, unturned (m). */
const END_REACH = 20;

/** The city's routes along Bajkowskiego eastwards by the junction: [right lane, left lane] (heading east, right is south). */
const bajkowskiegoLanes = (routes: readonly TrafficRoute[]): [number, number] => {
  const at = { x: DEPTAK_MOUTH.x - APPROACH, z: DEPTAK_MOUTH.z };
  const east = routes.flatMap((r, i) => {
    const q = projectOn(r.points, at.x, at.z);
    return r.use === "cars" && r.id.split(">")[0]!.includes("Bajkowskiego#") && q.d < 4 && pointAt(r.points, q.s).tx > 0.9 ? [{ i, z: pointAt(r.points, q.s).z }] : [];
  });
  if (east.length !== 2) throw new Error(`Bajkowskiego by the deptak: ${east.length} lanes eastwards, not 2`);
  const [a, b] = east.sort((p, q) => p.z - q.z);
  return [a!.i, b!.i];
};

/**
 * The routes with Bajkowskiego's two and the ring south of the deptak in place of the city's:
 * the right lane's route where the right lane's was, the left lane's where the left lane's was,
 * the ring last, so every other route keeps its place (and its vehicles their ids).
 */
export const deptakMouthRoutes = (routes: readonly TrafficRoute[], lanes: readonly TrafficRoute[]): TrafficRoute[] => {
  const [ri, li] = bajkowskiegoLanes(routes);
  const right = routes[ri]!;
  const left = routes[li]!;
  // The left lane's route: its turn south, Królewska, the turn round there and Lubartowska north, ended short of the junction.
  const end = pointAt(left.points, left.length);
  const back = left.turns?.find(([a, b]) => {
    const [p, q] = [pointAt(left.points, a), pointAt(left.points, b)];
    return p.tx * q.tx + p.tz * q.tz < -0.7;
  });
  const own = lanes.find((l) => l.id === right.id);
  if (!back || !own || !left.arcs?.[0] || end.tz < 0.9 || Math.hypot(end.x - DEPTAK_MOUTH.x, end.z - DEPTAK_MOUTH.z) > END_REACH) throw new Error("No way south from Bajkowskiego by the deptak");
  // Lubartowska north turns round onto its lane south, beside it on the left lane's route before Królewska.
  const south = projectOn(slice(left.points, 0, back[0]), end.x, end.z);
  const r = south.d / 2;
  const into = pointAt(left.points, left.length - r);
  const onto = pointAt(left.points, south.s + r);
  const ring = stitch(
    `${left.id.slice(left.id.indexOf(">") + 1)}+ring`,
    [
      { of: left, from: back[0], to: left.length - r },
      { points: [[into.x, into.z], ...uTurn([into.x, into.z], [onto.x, onto.z], into.tx, into.tz), [onto.x, onto.z]], speed: TURN_SPEED, turn: true },
      { of: left, from: south.s + r, to: back[0] },
    ],
    1,
    true,
  );
  // The right lane turns south into Lubartowska as the left lane's route does, and on to where Królewska turns round.
  const turnAt = left.arcs[0][1];
  const lane = { points: slice(left.points, turnAt, back[0]), length: back[0] - turnAt };
  const arc = arcBetween(own, lane);
  if (!arc) throw new Error("No turn south off Bajkowskiego's right lane");
  const rightRoute = stitch(
    `${right.id}>${left.id.split(">")[1]}`,
    [
      { of: own, from: 0, to: own.length - arc.cutEnd },
      { points: arc.arc, speed: TURN_SPEED, turn: true },
      { of: left, from: turnAt + arc.cutStart, to: back[0] },
    ],
    1,
  );
  // The left lane onto the right one, ended `CHANGE_CLEAR` short of its turn.
  const to = own.length - arc.cutEnd - CHANGE_CLEAR;
  const p = pointAt(own.points, to - CHANGE);
  const fromS = projectOn(left.points, p.x, p.z).s;
  const a = pointAt(left.points, fromS);
  const b = pointAt(own.points, to);
  const change = bezier([a.x, a.z], a, [b.x, b.z], b);
  if (tightest(change) < CHANGE_RADIUS || !onCarriageway(change)) throw new Error("No room for Bajkowskiego's left lane to change onto the right one");
  const leftRoute = stitch(
    `${left.id.split(">")[0]}~${rightRoute.id}`,
    [
      { of: left, from: 0, to: fromS },
      { points: change, speed: own.speed },
      { of: rightRoute, from: projectOn(rightRoute.points, b.x, b.z).s, to: rightRoute.length },
    ],
    1,
  );
  // The city keeps its traffic: the right lane's vehicles on its route, the left lane's between its route and the ring by their lengths.
  const onRing = Math.max(1, Math.min(left.vehicles - 1, Math.round((left.vehicles * ring.length) / (ring.length + leftRoute.length))));
  const as = (x: TrafficRoute, vehicles: number): TrafficRoute => ({ ...x, vehicles: Math.max(1, vehicles) });
  return [...routes.map((x, i) => (i === ri ? as(rightRoute, right.vehicles) : i === li ? as(leftRoute, left.vehicles - onRing) : x)), as(ring, onRing)];
};

/** A route's end this near a ring's start, heading its way, runs on into it (m). */
const ONTO_RING = 0.5;

/**
 * The routes with each car lane that ends where a ring starts, on its lane, linked on into it (`TrafficRoute.then`, G-966):
 * Bajkowskiego's two and the way out of Alchemia's P-1 end at the start of the pocket's ring south of the deptak, and a
 * vehicle held on its end in the player's view stood in the ring's way. Pattern: a lane graph's successor link, as
 * traffic simulations join lanes (a vehicle at a lane's end goes on in the next).
 */
export const ontoRings = (routes: readonly TrafficRoute[]): TrafficRoute[] =>
  routes.map((r) => {
    if (r.ring || r.use !== "cars" || r.points.length < 2) return r;
    const end = pointAt(r.points, r.length);
    const ring = routes.findIndex((o) => {
      if (!o.ring) return false;
      const start = pointAt(o.points, 0);
      return Math.hypot(start.x - end.x, start.z - end.z) < ONTO_RING && start.tx * end.tx + start.tz * end.tz > 0.9;
    });
    return ring < 0 ? r : { ...r, then: { route: ring, s: 0 } };
  });

