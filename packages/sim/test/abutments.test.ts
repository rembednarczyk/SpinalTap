import { describe, expect, it } from "vitest";
import { abutmentRamps } from "../src/content/lublin/abutments";
import { MAP_CHUNKS } from "../src/content/lublin/sites";
import { groundY } from "../src/content/lublin/terrain";
import { type Ramp, shapeHeight } from "../src/content/lublin/shape";

/** The terrain levelled at the bridges' abutments (G-349). */

describe("the bridges' abutments (G-349)", () => {
  it("level the terrain on a square-ended ramp: not half its width past its ends, as a round end would", () => {
    const ramp: Ramp = { a: { x: 0, z: 0 }, b: { x: 10, z: 0 }, ya: 1, yb: 1, width: 10, blend: 0, square: true };
    expect(shapeHeight(5, 4.9, 0, [], [ramp])).toBe(1);
    expect(shapeHeight(-1, 0, 0, [], [ramp])).toBe(0);
    expect(shapeHeight(5, 5.5, 0, [], [ramp])).toBe(0);
    expect(shapeHeight(-1, 0, 0, [], [{ ...ramp, square: false }])).toBe(1);
  });

  it("are at the free ends of Mełgiewska's bridges, not on the viaduct of Zamkowa with its flight, nor at a footbridge", () => {
    const ramps = abutmentRamps(MAP_CHUNKS);
    const near = (x: number, z: number, d: number) => ramps.filter((r) => Math.hypot(r.a.x - x, r.a.z - z) < d);
    // Mełgiewska's south bridge (w50733068) at Andersa and at its east end, its north bridge at both.
    for (const [x, z] of [[2416, 317.5], [2455.3, 303.8], [2410, 275.7], [2446.5, 252.9]] as const) expect(near(x, z, 1), `${x}, ${z}`).not.toEqual([]);
    // The viaduct, the steps hung off its west end (G-255), and the footbridge of podzamcze-2-0, 8 m long.
    expect(near(731, 155, 6)).toEqual([]);
    expect(near(758.5, 183, 6)).toEqual([]);
    expect(near(1078, 161, 6)).toEqual([]);
    // Lowest first: where two meet, the higher holds.
    expect(ramps.map((r) => r.ya)).toEqual([...ramps.map((r) => r.ya)].sort((p, q) => p - q));
  });

  it("take the steps w294098693 onto the viaduct of Zamkowa within a kerb across their whole band (G-686)", () => {
    // Their top run from the bend (734.2, 148.5) up to their top on the deck (730.8, 155): on main
    // the ground stepped 0.51-0.54 m where the band got onto the deck's corner.
    const [a, b] = [{ x: 734.2, z: 148.5 }, { x: 730.8, z: 155 }];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const u = { x: (b.x - a.x) / len, z: (b.z - a.z) / len };
    const steps: string[] = [];
    for (const s of [-1.4, -1, -0.5, 0, 0.5, 1, 1.4]) {
      let [last, most] = [groundY(a.x - u.z * s, a.z + u.x * s), 0];
      for (let t = 0.1; t <= len + 1; t += 0.1) {
        const y = groundY(a.x + u.x * t - u.z * s, a.z + u.z * t + u.x * s);
        most = Math.max(most, Math.abs(y - last));
        last = y;
      }
      if (most >= 0.15) steps.push(`${s} m off the axis: ${most.toFixed(2)} m`);
    }
    expect(steps).toEqual([]);
  });
});
