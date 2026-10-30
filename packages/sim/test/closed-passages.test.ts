import { describe, expect, it } from "vitest";
import { TRAFFIC_ROUTES, projectOn } from "../src/content/traffic";
import { LUBLIN_CHUNKS } from "../src/content/lublin";

/** The passages under buildings OSM closes to motor vehicles, as polylines. */
const passages = LUBLIN_CHUNKS.flatMap((c) =>
  c.streets
    .filter((s) => s.noVehicles)
    .map((s) => ({ name: s.name, points: Array.from({ length: s.line.length / 2 }, (_, i) => [s.line[2 * i]!, s.line[2 * i + 1]!] as const) })),
);

describe("passages closed to motor vehicles (G-002)", () => {
  it("are known from the map: the Ku Farze gate among them", () => {
    expect(passages.some((p) => p.name === "Ku Farze")).toBe(true);
  });

  it("carry no lane, not even a delivery van's", () => {
    const through = TRAFFIC_ROUTES.flatMap((r) =>
      passages.filter((p) => r.points.some(([x, z]) => projectOn(p.points, x, z).d < 1)).map((p) => `${r.id} through ${p.name}`),
    );
    expect(through).toEqual([]);
  });
});
