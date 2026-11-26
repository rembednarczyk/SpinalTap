import { describe, expect, it } from "vitest";
import { pointInPairRingEvenOdd } from "@seki/core";
import { type Pt, ROAD_CHAINS, polylineLength } from "../src/content/lublin/roads";
import { MAP_CHUNKS } from "../src/content/lublin/sites";
import { stripCut } from "../src/content/kerb-bays";
import { TRAFFIC_ROUTES } from "../src/content/traffic";
import { pointAt, projectOn } from "../src/content/traffic-lane";
import { reachAt } from "../src/content/traffic-reach";

const median = (xs: number[]): number => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;

/**
 * Peowiaków is one way, one lane (OSM tags no `lanes`, ADR-0105), and its parking strip
 * w471191535 (`parking=street_side`) lies inside the carriageway its width reads. A street's
 * cross-section is split into a parking lane and a moving lane, so its one lane runs in the middle
 * of what the strip leaves: as far from the strip's inner edge as from the far kerb. On the axis it
 * ran 1.5 m nearer the strip, and where the carriageway counts the strip whole (BDOT10k, ADR-0104)
 * the bays stood on the lane and stayed empty.
 */
describe("a one-lane street beside a parking strip inside its carriageway (ADR-0105)", () => {
  it("Peowiaków's lane runs mid the part of the carriageway its strip leaves", () => {
    const street = ROAD_CHAINS.find((c) => c.name === "Peowiaków" && c.use === "cars" && c.oneway)!;
    const park = MAP_CHUNKS.flatMap((c) => c.carParks ?? []).find((p) => p.id === "w471191535")!;
    const ring = Array.from({ length: park.outline.length / 2 }, (_, i): Pt => [park.outline[2 * i]!, park.outline[2 * i + 1]!]);
    const lanes = TRAFFIC_ROUTES.filter((r) => r.street === "Peowiaków" && r.use === "cars");
    expect(lanes.length).toBeGreaterThan(0);
    const toStrip: number[] = [];
    const toKerb: number[] = [];
    for (let s = 1; s < polylineLength(street.points); s += 2) {
      const p = pointAt(street.points, s);
      for (const side of [1, -1] as const) {
        const across = (d: number) => ({ x: p.x + p.tz * side * d, z: p.z - p.tx * side * d });
        const cut = stripCut(ring, across, 8);
        if (!cut || pointInPairRingEvenOdd(p.x, p.z, ring)) continue;
        // The lane's offset towards the strip: where across the street the nearest lane passes.
        let lane = Number.NaN;
        let best = Infinity;
        for (let d = -3; d <= 3; d += 0.05) {
          const q = across(d);
          const gap = Math.min(...lanes.map((r) => projectOn(r.points, q.x, q.z).d));
          if (gap < best) [best, lane] = [gap, d];
        }
        if (best > 0.1) continue;
        toStrip.push(cut.from - lane);
        toKerb.push(reachAt(street, s, side === 1 ? -1 : 1) + lane);
      }
    }
    expect(toStrip.length).toBeGreaterThan(5);
    expect(Math.abs(median(toStrip) - median(toKerb))).toBeLessThan(0.4);
  });
});
