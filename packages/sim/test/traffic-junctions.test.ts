import { describe, expect, it } from "vitest";
import { TRAFFIC_LANES, TRAFFIC_ROUTES, TURN_SPEED, type TrafficRoute, pointAt } from "../src/content/traffic";
import { JUNCTION_REACH, joinAtJunctions, junctionJoins } from "../src/content/traffic-junctions";
import { surfacesAt } from "../src/content/lublin/roads";
import { inBuilding } from "../src/content/lublin/places";
import { VEHICLE_IDS_PER_ROUTE } from "../src/world/traffic";

const end = (r: TrafficRoute) => pointAt(r.points, r.length);
/** Lane `n` (its id's last part) of `street` that ends by (x, z): found by place, as the chains' numbers move with the map's data. */
const laneEnding = (street: string, n: string, x: number, z: number): TrafficRoute =>
  TRAFFIC_LANES.find((r) => r.street === street && r.id.endsWith(`:${n}`) && Math.hypot(end(r).x - x, end(r).z - z) < 4)!;
const joinOf = (r: TrafficRoute) => junctionJoins(TRAFFIC_LANES).find((j) => TRAFFIC_LANES[j.from] === r);
/** The route a lane drives on. */
const routeOf = (id: string) => TRAFFIC_ROUTES.find((r) => r.id.split(">").includes(id));

describe("turns at junctions (ADR-0055)", () => {
  it.each([
    ["Ruska", "0", 1081, 448, "Lwowska:0", "right"],
    // A left turn into the left lane of one-way Cyrulicza: the right turn from Furmańska's other carriageway has the right one.
    ["Furmańska", "0", 634, 252, "Cyrulicza:1", "left"],
  ] as const)("a lane ending at a junction (G-006: %s) turns along an arc into another street's lane, on the road, out of the buildings", (street, n, x, z, into, way) => {
    const from = laneEnding(street, n, x, z);
    const join = joinOf(from);
    expect(join, from.id).toBeDefined();
    const to = TRAFFIC_LANES[join!.to]!;
    expect(`${to.street}:${to.id.split(":").pop()}`).toBe(into);
    expect(join!.way).toBe(way);
    const route = routeOf(from.id)!;
    expect(route.id).toContain(`${from.id}>${to.id}`);
    // Its end is no end of the traffic any more: the route drives on past it.
    const e = end(from);
    expect(TRAFFIC_ROUTES.some((r) => Math.hypot(end(r).x - e.x, end(r).z - e.z) < 1)).toBe(false);
    // The arc is one of the route's turns, near the old end, tangent to both lanes and on the carriageway.
    const turn = route.turns!.find(([a, b]) => [a, b].some((s) => Math.hypot(pointAt(route.points, s).x - e.x, pointAt(route.points, s).z - e.z) < JUNCTION_REACH));
    expect(turn).toBeDefined();
    const [a, b] = turn!;
    for (let s = a; s <= b; s += 0.25) {
      const p = pointAt(route.points, s);
      expect(surfacesAt(p.x, p.z), `${from.id} at ${s}`).toContain("road");
      expect(inBuilding(p.x, p.z), `${from.id} at ${s}`).toBe(false);
    }
    const heading = (s: number) => pointAt(route.points, s);
    const kink = (s: number) => heading(s - 0.3).tx * heading(s + 0.3).tx + heading(s - 0.3).tz * heading(s + 0.3).tz;
    expect(kink(a)).toBeGreaterThan(0.98);
    expect(kink(b)).toBeGreaterThan(0.98);
    expect(TURN_SPEED).toBeLessThan(route.speed);
  });

  it("turns side by side do not cross, and an end left without a way on stops short of the junction's arcs", () => {
    const joins = junctionJoins(TRAFFIC_LANES);
    // Furmańska's two carriageways turn into one-way Cyrulicza, one left and one right.
    const into = joins.filter((j) => TRAFFIC_LANES[j.from]!.street === "Furmańska" && TRAFFIC_LANES[j.to]!.street === "Cyrulicza");
    expect(into.map((j) => j.way).sort()).toEqual(["left", "right"]);
    const [left, right] = [into.find((j) => j.way === "left")!.arc, into.find((j) => j.way === "right")!.arc];
    // Nowhere closer than a lane's width apart, from their ends on.
    for (const p of left.slice(2, -2)) expect(Math.min(...right.map((q) => Math.hypot(q[0] - p[0], q[1] - p[1]))), `${p}`).toBeGreaterThan(1);
    // The first one's other lane lost both lanes of Cyrulicza to them: it stops 5 m short of every arc.
    const lost = laneEnding("Furmańska", "1", 631, 252);
    expect(joinOf(lost)).toBeUndefined();
    const stuck = TRAFFIC_ROUTES.find((r) => r.id === lost.id)!;
    expect(stuck.length).toBeLessThan(lost.length);
    const e = end(stuck);
    for (const j of joins) for (const [x, z] of j.arc) expect(Math.hypot(x - e.x, z - e.z)).toBeGreaterThanOrEqual(5);
  });

  it("the one-way ends of G-024 have no other car street in the junction's reach: only delivery streets meet them", () => {
    const ends = [
      ["Lubartowska", 462, 56],
      ["Lubartowska", 459, 57],
      ["Kowalska", 567, 159],
      ["Kowalska", 568, 161],
      ["Świętoduska", 349, -47],
      ["Świętoduska", 353, -48],
    ] as const;
    for (const [street, x, z] of ends) {
      const r = TRAFFIC_LANES.find((o) => o.street === street && o.use === "cars" && Math.hypot(end(o).x - x, end(o).z - z) < 2)!;
      expect(r, `${street} ${x},${z}`).toBeDefined();
      const e = end(r);
      const nearest = Math.min(...TRAFFIC_LANES.filter((o) => o.use === r.use && o.street !== r.street).map((o) => Math.hypot(pointAt(o.points, 0).x - e.x, pointAt(o.points, 0).z - e.z)));
      // Measured: 100 m on Lubartowska, 56 m on Kowalska, 48 m on Świętoduska.
      expect(nearest, r.id).toBeGreaterThan(JUNCTION_REACH * 2.5);
      expect(joinOf(r)).toBeUndefined();
    }
  });

  it("takes every lane's start and end once at most, and every lane drives on one route", () => {
    const joins = junctionJoins(TRAFFIC_LANES);
    expect(joins.length).toBeGreaterThan(30);
    expect(new Set(joins.map((j) => j.to)).size).toBe(joins.length);
    expect(new Set(joins.map((j) => j.from)).size).toBe(joins.length);
    const driven = TRAFFIC_ROUTES.flatMap((r) => r.id.split(">"));
    expect([...driven].sort()).toEqual(TRAFFIC_LANES.map((r) => r.id).sort());
    // The city keeps its traffic: within 2% of its lanes' vehicles, and no route over its ids.
    const all = TRAFFIC_LANES.reduce((s, r) => s + r.vehicles, 0);
    expect(Math.abs(TRAFFIC_ROUTES.reduce((s, r) => s + r.vehicles, 0) - all)).toBeLessThanOrEqual(all * 0.02);
    expect(Math.max(...TRAFFIC_ROUTES.map((r) => r.vehicles))).toBeLessThanOrEqual(VEHICLE_IDS_PER_ROUTE);
    // Every join's arc, straight on too, is one of its route's arcs (the scan's `turn-off-road` reads them).
    expect(TRAFFIC_ROUTES.reduce((s, r) => s + (r.arcs?.length ?? 0), 0)).toBe(joins.length);
    for (const j of joins) {
      expect(j.d).toBeLessThan(JUNCTION_REACH);
      expect(TRAFFIC_LANES[j.to]!.use).toBe(TRAFFIC_LANES[j.from]!.use);
    }
  });

  it("is a pure function of the lanes: the same routes every time, in the same order", () => {
    const again = joinAtJunctions(TRAFFIC_LANES);
    expect(again).toEqual(TRAFFIC_ROUTES);
    expect(junctionJoins(TRAFFIC_LANES)).toEqual(junctionJoins(TRAFFIC_LANES));
  });
});
