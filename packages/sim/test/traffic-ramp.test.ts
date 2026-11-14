import { describe, expect, it } from "vitest";
import { CITY_ROUTES, TRAFFIC_LANES, TRAFFIC_ROUTES, TURN_SPEED, pointAt, projectOn } from "../src/content/traffic";
import { RAMP_DOWN_X, RAMP_UP_X, alchemiaRampLanes, alchemiaRampRoutes, ownWayRoom, streetSegments } from "../src/content/traffic-ramp";
import { P1, P1_CABINS, P1_RAMP, p1DriveFloor, p1RampY } from "../src/content/alchemia/parking";
import { onRoad, surfacesAt } from "../src/content/lublin/roads";
import { vehiclePlan } from "../src/world/traffic";

/** Alchemia's P-1 in the street's traffic (ADR-0074 §4, G-491, G-510). */

const [IN, OUT] = TRAFFIC_ROUTES.slice(CITY_ROUTES.length);
const inside = (c: (typeof P1_CABINS)[number], p: { x: number; z: number }) => p.x > c.minX && p.x < c.maxX && p.z > c.minZ && p.z < c.maxZ;
const ofStreet = (id: string) => TRAFFIC_LANES.find((l) => l.id === id)!;
/** Bajkowskiego's left lane eastwards (the north one) and Lubartowska's left lane northwards by Olejna. */
const bajkowskiegoLeft = TRAFFIC_LANES.find((l) => l.street === "Wacława Bajkowskiego" && projectOn(l.points, 414, -14.8).d < 0.5)!;
const OLEJNA = { x: 454.9, z: 42.8 };

describe("the cars in and out of Alchemia's P-1 (ADR-0074 §4)", () => {
  it("drive two routes after the city's, the same every time", () => {
    expect(TRAFFIC_ROUTES).toHaveLength(CITY_ROUTES.length + 2);
    expect([IN!.id, OUT!.id]).toEqual(["alchemia-p1:in", "alchemia-p1:out"]);
    expect(alchemiaRampRoutes(CITY_ROUTES)).toEqual([IN, OUT]);
    expect(ofStreet(bajkowskiegoLeft.id).street).toBe("Wacława Bajkowskiego");
  });

  it("comes in along Bajkowskiego's left lane, turns left onto the driveway, down the ramp's east lane into the south cabin", () => {
    const r = IN!;
    const start = pointAt(r.points, 0);
    expect(projectOn(bajkowskiegoLeft.points, start.x, start.z).d).toBeLessThan(0.05);
    const own = r.ownWay![0]!;
    // Up to where it turns off, on the lane; then a left turn, from east to north.
    for (let s = 0; s < own[0]; s += 1) expect(projectOn(bajkowskiegoLeft.points, pointAt(r.points, s).x, pointAt(r.points, s).z).d, `${s}`).toBeLessThan(0.05);
    expect(pointAt(r.points, own[0] - 0.5).tx).toBeGreaterThan(0.95);
    const top = pointAt(r.points, own[0] + 12);
    expect(top.x).toBeCloseTo(RAMP_DOWN_X, 6);
    expect(top.tz).toBeCloseTo(1, 6);
    for (let z = P1_RAMP.top; z < P1_RAMP.foot - 3; z += 1) expect(projectOn(r.points, RAMP_DOWN_X, z).d, `${z}`).toBeLessThan(0.01);
    expect(inside(P1_CABINS[0]!, pointAt(r.points, r.length))).toBe(true);
    expect(r.ownWay).toEqual([[own[0], r.length]]);
  });

  it("goes out of the north cabin up the ramp's west lane, left onto Bajkowskiego's left lane and left again up Lubartowska past Olejna", () => {
    const r = OUT!;
    expect(inside(P1_CABINS[1]!, pointAt(r.points, 0))).toBe(true);
    for (let z = P1_RAMP.top; z < P1_RAMP.foot - 3; z += 1) expect(projectOn(r.points, RAMP_UP_X, z).d, `${z}`).toBeLessThan(0.01);
    const own = r.ownWay![0]!;
    expect(own[0]).toBe(0);
    const on = pointAt(r.points, own[1] + 0.5);
    expect(on.tx).toBeGreaterThan(0.95);
    expect(projectOn(bajkowskiegoLeft.points, on.x, on.z).d).toBeLessThan(0.05);
    // Left up Lubartowska (one way north) by the junction with Olejna, and on to where the city's route ends.
    const by = projectOn(r.points, OLEJNA.x, OLEJNA.z);
    expect(by.d).toBeLessThan(2);
    expect(pointAt(r.points, by.s).tz).toBeGreaterThan(0.9);
    const city = CITY_ROUTES.find((c) => c.id.startsWith(`${bajkowskiegoLeft.id}>`))!;
    expect(pointAt(r.points, r.length)).toEqual(pointAt(city.points, city.length));
  });

  it("keeps to the street's lanes, the ramp's lanes 1.6 m off its carriageway's axis, and its turns on the driveway", () => {
    const lanes = [...TRAFFIC_LANES.map((l) => l.points), ...alchemiaRampLanes(CITY_ROUTES)];
    expect(RAMP_DOWN_X - RAMP_UP_X).toBeCloseTo(3.2, 6);
    expect(RAMP_UP_X - 1).toBeGreaterThan(P1_RAMP.minX);
    expect(RAMP_DOWN_X + 1).toBeLessThan(P1_RAMP.walk);
    for (const r of [IN!, OUT!]) {
      let s = 0;
      r.points.forEach(([x, z], i) => {
        if (i > 0) s += Math.hypot(x - r.points[i - 1]![0], z - r.points[i - 1]![1]);
        if (r.arcs!.some(([a, b]) => s >= a - 1e-6 && s <= b + 1e-6)) return;
        expect(Math.min(...lanes.map((l) => projectOn(l, x, z).d)), `${r.id} ${x},${z}`).toBeLessThan(0.5);
      });
      // Off its own way it drives on the carriageway; on it the driveway, the ramp or P-1's floor.
      for (let t = 0; t < r.length; t += 0.5) {
        const p = pointAt(r.points, t);
        const own = r.ownWay!.some(([a, b]) => t >= a && t <= b);
        // A zebra is a piece of the carriageway of its own (the ground a partition, ADR-0078 step 3): `onRoad`.
        if (!own) expect(onRoad(p.x, p.z), `${r.id} ${t}: ${surfacesAt(p.x, p.z).join(",")}`).toBe(true);
        else if (p.z > P1_RAMP.top) expect(p1DriveFloor(p.x, p.z), `${r.id} ${t}`).not.toBeNull();
      }
      expect(r.turns).toEqual(expect.arrayContaining(r.ownWay!.map((w) => [...w])));
      expect(r.speed).toBeGreaterThan(TURN_SPEED);
      expect(r.speed).toBeLessThan(CITY_ROUTES.find((c) => c.id.startsWith(`${bajkowskiegoLeft.id}>`))!.speed);
    }
  });

  it("drives the ramp's surface down to P-1's floor", () => {
    expect(p1DriveFloor(RAMP_DOWN_X, P1_RAMP.top + 10)).toBeCloseTo(p1RampY(P1_RAMP.top + 10), 6);
    expect(p1DriveFloor(400.8, 26.6)).toBe(P1.floor);
    expect(p1DriveFloor(RAMP_DOWN_X, P1_RAMP.top - 1)).toBeNull();
    // No other route goes under the car park.
    for (const r of CITY_ROUTES) for (let t = 0; t < r.length; t += 1) expect(p1DriveFloor(pointAt(r.points, t).x, pointAt(r.points, t).z), r.id).toBeNull();
  });

  it("leaves the crowd the car park over P-1: only the street's level counts for its carriageways", () => {
    for (const [a, b] of streetSegments(IN!)) expect(p1DriveFloor((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)).toBeNull();
    const kept = streetSegments(OUT!).reduce((s, [a, b]) => s + Math.hypot(b[0] - a[0], b[1] - a[1]), 0);
    expect(kept).toBeGreaterThan(OUT!.length - (P1_RAMP.foot - P1_RAMP.top) - 20);
    expect(kept).toBeLessThan(OUT!.length - (P1_RAMP.foot - P1_RAMP.top));
  });

  it("takes into the hand-over cabins only the cars that fit them: no van, no delivery van", () => {
    for (const r of [IN!, OUT!]) {
      expect(r.models?.map(([m]) => m)).toEqual(["sedan", "hatchback", "taxi"]);
      for (let i = 0; i < 40; i++) expect(["sedan", "hatchback", "taxi"]).toContain(vehiclePlan(77 + i, TRAFFIC_ROUTES.indexOf(r), 0).model);
    }
  });

  it("leaves a car going round someone the room between the ramp's walls, none on the apron and in the cabins, the street's own rule off them", () => {
    const at = (r: typeof IN, x: number, z: number) => projectOn(r!.points, x, z).s;
    const w = 0.91;
    // Up the west lane (heading south, its right is west): 0.49 m west to the wall's room, over 5 m east.
    const up = ownWayRoom(OUT!, at(OUT, RAMP_UP_X, 4.5), w, 0)!;
    expect(up[1]).toBeCloseTo(RAMP_UP_X - (P1_RAMP.minX + w + 0.25), 6);
    expect(up[0]).toBeCloseTo(RAMP_UP_X - (P1_RAMP.maxX - w - 0.25), 6);
    // Down the east lane (heading north, its right is east).
    const down = ownWayRoom(IN!, at(IN, RAMP_DOWN_X, 4.5), w, 0)!;
    expect(down[1]).toBeCloseTo(P1_RAMP.maxX - w - 0.25 - RAMP_DOWN_X, 6);
    // By the ramp's foot the room ahead is the apron's: none.
    expect(ownWayRoom(IN!, at(IN, RAMP_DOWN_X, P1_RAMP.foot - 6), w)).toEqual([0, 0]);
    expect(ownWayRoom(OUT!, 1, w)).toEqual([0, 0]);
    expect(ownWayRoom(IN!, 1, w)).toBeNull();
    expect(ownWayRoom(CITY_ROUTES[0]!, 1, w)).toBeNull();
  });
});
