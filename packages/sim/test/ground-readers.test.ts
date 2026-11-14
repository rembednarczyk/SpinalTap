import { describe, expect, it } from "vitest";
import { pointInPairRingEvenOdd } from "@seki/core";
import { MAP_CHUNKS } from "../src/content/lublin/sites";
import { onRoad, surfacesAt } from "../src/content/lublin/roads";
import { PARKED_CARS } from "../src/content/parked-cars";
import { TRAFFIC_LANES } from "../src/content/traffic";

/**
 * What the simulation reads off the map's ground pieces, pinned before the ground becomes a
 * partition of the plane (ADR-0078 step 3, ADR-0080 PR 6: one piece under each point, a zebra a
 * piece of the carriageway of its own, no asphalt left under a sidewalk's lap). Each holds on the
 * ground laid in layers and is to hold on the partition.
 */

/** Points of the car lanes off the carriageway on the ground laid in layers (glitches of their own, not the partition's). */
const KNOWN_OFF_ROAD = new Set(["Radziwiłłowska#29:f -18.6,115.8", "Ciasna#103:b 583.1,575.5", "Mełgiewska#114:0 2448.8,249.6", "Mełgiewska#114:t 2448.8,249.6", "Mełgiewska#115:0 2459.2,304.2", "Mełgiewska#115:t 2459.2,304.2"]);
/** Parked cars on a sidewalk's piece on the ground laid in layers. */
const KNOWN_ON_SIDEWALK = new Set(["taxi 733,298"]);

const ringOf = (flat: readonly number[]) => Array.from({ length: flat.length / 2 }, (_, i): [number, number] => [flat[2 * i]!, flat[2 * i + 1]!]);
const ZEBRAS = MAP_CHUNKS.flatMap((c) => c.ground.filter((g) => g.surface === "crossing" && !g.bridge).map((g) => ringOf(g.outline)));

describe("the simulation's readers of the ground (ADR-0078 step 3)", () => {
  it("takes a zebra for the carriageway, the asphalt under it or not", () => {
    // Every quarter metre inside the zebras; the ones off the asphalt laid under them are the zebras' ends on a footway or a square.
    let off = 0;
    for (const ring of ZEBRAS) {
      const xs = ring.map((p) => p[0]);
      const zs = ring.map((p) => p[1]);
      for (let x = Math.min(...xs) + 0.125; x < Math.max(...xs); x += 0.25)
        for (let z = Math.min(...zs) + 0.125; z < Math.max(...zs); z += 0.25) {
          if (!pointInPairRingEvenOdd(x, z, ring)) continue;
          expect(onRoad(x, z), `${x},${z}`).toBe(true);
          if (!surfacesAt(x, z).includes("road")) off++;
        }
    }
    expect(ZEBRAS.length).toBeGreaterThan(100);
    expect(off).toBeGreaterThan(0);
  });

  it("keeps the car lanes on the carriageway, a zebra and a cobbled street's setts included", () => {
    const lanes = TRAFFIC_LANES.filter((r) => r.use !== "deliveries");
    expect(lanes.length).toBeGreaterThan(100);
    const off: string[] = [];
    for (const r of lanes)
      for (let i = 0; i + 1 < r.points.length; i++) {
        const [a, b] = [r.points[i]!, r.points[i + 1]!];
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (let s = 0; s < len; s += 3) {
          const [x, z] = [a[0] + ((b[0] - a[0]) * s) / len, a[1] + ((b[1] - a[1]) * s) / len];
          if (!MAP_CHUNKS.some(({ bounds: q }) => x > q.minX + 1 && x < q.maxX - 1 && z > q.minZ + 1 && z < q.maxZ - 1)) continue;
          if (!onRoad(x, z) && !surfacesAt(x, z).includes("cobble")) off.push(`${r.id} ${x.toFixed(1)},${z.toFixed(1)}`);
        }
      }
    // Known before the partition (`KNOWN_OFF_ROAD`): four points at the asphalt's edge or just past it.
    expect(off.filter((o) => !KNOWN_OFF_ROAD.has(o)).slice(0, 20)).toEqual([]);
  });

  it("parks every car on a carriageway, a cobbled way or a square, never on a sidewalk or a zebra", () => {
    expect(PARKED_CARS.length).toBeGreaterThan(60);
    const on: string[] = [];
    for (const c of PARKED_CARS) {
      const under = surfacesAt(c.x, c.z);
      expect(under.some((s) => s === "road" || s === "cobble" || s === "square"), `${c.model} ${c.x},${c.z}: ${under.join(",")}`).toBe(true);
      if (under.includes("sidewalk") || under.includes("crossing")) on.push(`${c.model} ${c.x},${c.z}`);
    }
    // Known before the partition: a taxi on setts under a sidewalk's lap.
    expect(on.filter((o) => !KNOWN_ON_SIDEWALK.has(o))).toEqual([]);
  });
});
