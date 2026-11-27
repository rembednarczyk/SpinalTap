import { describe, expect, it } from "vitest";
import type { VehicleModel } from "@seki/core";
import { TRAFFIC_ROUTES } from "../src/content/traffic";
import { bodiesMeet, cannotStop, goesFirst } from "../src/systems/traffic-bodies";
import { halfSize, lanePose } from "../src/world/traffic";
import type { Entity, VehicleState } from "../src/world/components";

/**
 * Bodies of two lanes going opposite ways (G-744). Cicha bends by 90 degrees just before its north
 * end, its two lanes 3 m apart: a van just past its bend northwards swings its tail across the lane
 * coming the other way, which lanes alone never show.
 */

type V = Entity & { vehicle: VehicleState };

const routeOf = (id: string): number => TRAFFIC_ROUTES.findIndex((r) => r.id === id);

const at = (id: number, route: number, s: number, v: number, model: VehicleModel = "delivery"): V => {
  const p = lanePose(TRAFFIC_ROUTES[route]!, s);
  return {
    id,
    position: { x: p.x, y: 0, z: p.z },
    yaw: p.yaw,
    vehicle: { route, index: 0, half: halfSize(model), s, v, aside: 0, blocked: 0, horn: 0, panic: null },
  } as V;
};

describe("bodies along their lanes (G-744)", () => {
  const north = routeOf("Cicha#32:f");
  const south = routeOf("Cicha#32:b");
  // Where the northbound lane bends: its first point turned over 20 degrees off its heading 10 m in (past
  // a ramp of its line onto the carriageway's middle, ADR-0104 pkt 4), not its second point.
  const bend = ((): number => {
    const pts = TRAFFIC_ROUTES[north]?.points ?? [];
    const seg = (i: number) => Math.atan2(pts[i + 1]![1] - pts[i]![1], pts[i + 1]![0] - pts[i]![0]);
    let [s, at, head] = [0, 0, Number.NaN];
    for (let i = 0; i + 1 < pts.length; i++) {
      if (Number.isNaN(head) && s + Math.hypot(pts[i + 1]![0] - pts[i]![0], pts[i + 1]![1] - pts[i]![1]) >= 10) head = seg(i);
      const off = Math.abs(((seg(i) - head + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
      if (!Number.isNaN(head) && off > Math.PI / 9) return at;
      s += Math.hypot(pts[i + 1]![0] - pts[i]![0], pts[i + 1]![1] - pts[i]![1]);
      at = s;
    }
    return 0;
  })();

  it("finds Cicha's lanes, the northbound one bending", () => {
    expect(north).toBeGreaterThanOrEqual(0);
    expect(south).toBeGreaterThanOrEqual(0);
    expect(bend).toBeGreaterThan(70);
  });

  it("finds where a van turning out of the bend meets one past it the other way, not where their lanes meet", () => {
    // The van coming north stands 2 m before its bend, the one coming south 2 m past its own.
    const a = at(1, north, bend - 2, 7.5);
    const b = at(2, south, 11, 7.5);
    const met = bodiesMeet(a, 12, b, 12);
    expect(met).not.toBeNull();
    expect(met!.a).toBeGreaterThan(1.9);
    expect(met!.a).toBeLessThan(2.1);
  });

  it("finds nothing for two vans on the straight, passing each other", () => {
    expect(bodiesMeet(at(1, north, 30, 8), 12, at(2, south, 55, 8), 12)).toBeNull();
  });

  it("lets the one that can no longer stop go on, else the nearer, else the lower id", () => {
    const [a, b] = [at(1, north, 0, 8), at(2, south, 0, 8)];
    expect(cannotStop(a, 3)).toBe(true);
    expect(cannotStop(a, 10)).toBe(false);
    expect(goesFirst(a, 3, b, 1)).toBe(true);
    expect(goesFirst(b, 10, a, 3)).toBe(false);
    expect(goesFirst(a, 10, b, 15)).toBe(true);
    expect(goesFirst(b, 15, a, 10)).toBe(false);
    expect(goesFirst(a, 11, b, 10)).toBe(true);
    expect(goesFirst(b, 10, a, 11)).toBe(false);
  });
});
