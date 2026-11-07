import { describe, expect, it } from "vitest";
import { type PlanGroup, lampsOffBand, pavedAt } from "./lamp-band";

describe("lamp-off-band (G-477)", () => {
  // A causeway 6.5 m wide along z = 0, the plan's lamps along its axis.
  const paved = pavedAt([[{ x: -50, z: -3.25 }, { x: 50, z: -3.25 }, { x: 50, z: 3.25 }, { x: -50, z: 3.25 }]]);
  const plan: PlanGroup[] = [
    { id: "lamps.grobla", kind: "lamp-pastoral", spacing: 20, line: [-50, 0, 50, 0] },
    { id: "lamps.osm", kind: "street-lamp", points: [[10, 6]] },
  ];

  it("finds a lamp of the plan's line on the lawn past the slack, not one at the paving's edge", () => {
    const found = lampsOffBand([{ prop: "lamp-pastoral", x: 0, z: 5 }, { prop: "lamp-pastoral", x: 20, z: 3.55 }, { prop: "lamp-pastoral", x: -20, z: -1 }], plan, paved);
    expect(found).toEqual([{ at: "0.0,5.0", what: "lamp-pastoral of lamps.grobla 5.0 m from its line, off the paving" }]);
  });

  it("leaves out the map's own lamps, other kinds and lamps far from the plan's lines", () => {
    expect(lampsOffBand([{ prop: "lamp-pastoral", x: 10, z: 6 }], plan, paved)).toEqual([]);
    expect(lampsOffBand([{ prop: "lamp-road", x: 0, z: 5 }], plan, paved)).toEqual([]);
    expect(lampsOffBand([{ prop: "lamp-pastoral", x: 0, z: 9 }], plan, paved)).toEqual([]);
  });
});
