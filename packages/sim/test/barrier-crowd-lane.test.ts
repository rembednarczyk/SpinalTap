import { describe, expect, it } from "vitest";
import { WORLD_BARRIERS } from "../src";
import { CROWD_LANES } from "../src/content/crowd";
import { barrierPrism, distanceToBarrier } from "../src/content/lublin/barriers";
import { BODY } from "../src/world/factory";
import { LANE_HALF_GAP } from "../src/world/crowd";
import { laneGeom, lanePoint } from "../src/world/crowd-lanes";

/**
 * A resident walking a route keeps `LANE_HALF_GAP` to its own side of the line and is a body of
 * `BODY.radius` round (G-626): the map's barriers along a route must leave that room, as the
 * walkers pass through solids without a collision.
 */

const solids = Object.values(WORLD_BARRIERS)
  .flat()
  .filter((i) => barrierPrism(i) !== null);
const cells = new Map<string, (typeof solids)[number][]>();
for (const i of solids) {
  const k = `${Math.floor(i.x / 8)}:${Math.floor(i.z / 8)}`;
  cells.set(k, [...(cells.get(k) ?? []), i]);
}
/** The deepest a walker's body gets into a piece's footprint, over every route and both ways round (m), with the place it is at. */
const deepest = (inside?: { x: number; z: number; r: number }) => {
  let worst = { depth: 0, x: 0, z: 0 };
  for (const lane of CROWD_LANES) {
    const g = laneGeom(lane);
    for (let s = 0; s < g.length; s += 0.2) {
      const p = lanePoint(g, s);
      for (const side of [1, -1]) {
        const x = p.x - p.tz * LANE_HALF_GAP * side;
        const z = p.z + p.tx * LANE_HALF_GAP * side;
        if (inside && Math.hypot(x - inside.x, z - inside.z) > inside.r) continue;
        const [ci, cj] = [Math.floor(x / 8), Math.floor(z / 8)];
        for (let i = ci - 1; i <= ci + 1; i++) {
          for (let j = cj - 1; j <= cj + 1; j++) {
            for (const it of cells.get(`${i}:${j}`) ?? []) {
              const depth = BODY.radius - distanceToBarrier(it, x, z);
              if (depth > worst.depth) worst = { depth, x, z };
            }
          }
        }
      }
    }
  }
  return worst;
};

describe("the crowd's walkers by the map's barriers (G-626)", () => {
  it("does not walk into the fence at 729.5, 93.0", () => {
    const w = deepest({ x: 729.5, z: 93, r: 6 });
    expect(w.depth, `a walker at ${w.x.toFixed(1)}, ${w.z.toFixed(1)} is ${w.depth.toFixed(2)} m into a barrier`).toBeLessThan(0.05);
  });

  it("does not walk into any barrier along a route, beyond the cut's rounding", () => {
    const w = deepest();
    expect(w.depth, `a walker at ${w.x.toFixed(1)}, ${w.z.toFixed(1)} is ${w.depth.toFixed(2)} m into a barrier`).toBeLessThan(0.05);
  });
});
