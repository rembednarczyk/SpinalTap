import { describe, expect, it } from "vitest";
import { TRAFFIC_ROUTES } from "../src/content/traffic";
import { taperLength } from "../src/content/traffic-drops";
import { deepInMap, tightest } from "../src/content/traffic-junctions";
import { pointAt, projectOn, slice } from "../src/content/traffic-lane";

const cars = TRAFFIC_ROUTES.filter((r) => r.use === "cars");

/** Car routes ending inside the map with no lane starting by the end, while a lane of their street beside goes on (G-989). */
const dropsLeft = (): string[] => {
  const starts = cars.map((r) => pointAt(r.points, 0));
  return cars.flatMap((r) => {
    if (r.ring || r.ownWay) return [];
    const e = pointAt(r.points, r.length);
    if (!deepInMap(e.x, e.z) || starts.some((p, i) => cars[i] !== r && Math.hypot(p.x - e.x, p.z - e.z) < 3 && p.tx * e.tx + p.tz * e.tz > 0.5)) return [];
    const last = r.id.split("+").pop()!.split(">").pop()!.split("~").pop()!;
    const lane = last.slice(0, last.lastIndexOf(":") + 1);
    return cars.some((o) => {
      if (o === r || !o.id.includes(lane)) return false;
      const q = projectOn(o.points, e.x, e.z);
      const p = pointAt(o.points, q.s);
      return q.d > 2.2 && q.d < 4.4 && p.tx * e.tx + p.tz * e.tz > 0.95 && o.length - q.s > 20;
    })
      ? [`${r.id} (${e.x.toFixed(0)}; ${e.z.toFixed(0)})`]
      : [];
  });
};

describe("lane drops (G-989)", () => {
  it("no lane ends at a junction while its street's lane beside goes on", () => {
    expect(dropsLeft()).toEqual([]);
  });

  it("Ruska at Lwowska, Lubartowska at Ruska and Podzamcze south change onto the lane beside, no tighter than 8 m", () => {
    const changed = cars.filter((r) => r.id.includes("~") && !r.id.includes("Bajkowskiego#"));
    expect(changed.map((r) => r.id.split("~")[0]!.split("+").pop()!.split(">").pop())).toEqual(expect.arrayContaining(["Ruska#113:1", "Lubartowska#41:1", "Podzamcze#110:1"]));
    for (const r of changed) {
      // The change: an arc between headings side by side, one lane across.
      const arc = r.arcs!.find(([a, b]) => {
        const [p, q] = [pointAt(r.points, a), pointAt(r.points, b)];
        const across = Math.abs((q.x - p.x) * p.tz - (q.z - p.z) * p.tx);
        return p.tx * q.tx + p.tz * q.tz > 0.95 && across > 2.2 && across < 4.4;
      });
      expect(arc, r.id).toBeDefined();
      expect(tightest(slice(r.points, arc![0], arc![1]))).toBeGreaterThanOrEqual(8);
    }
  });

  it("tapers as the road code's L = W·S²/155", () => {
    expect(taperLength(3.2, 8)).toBeCloseTo(17.1, 1);
    expect(taperLength(3.2, 13.5)).toBeCloseTo(48.8, 1);
  });
});
