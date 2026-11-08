import { describe, expect, it } from "vitest";
import type { PlanGroup } from "./lamp-band";
import { lampsBesideDeck } from "./lamp-deck";

describe("lamp-beside-deck (G-503)", () => {
  // A deck 6.5 m wide along z = 0 from x = -20 to 20, 5 m over the valley; the plan's lamps along its axis.
  const deck = (x: number, z: number) => (Math.abs(x) <= 20 && Math.abs(z) <= 3.25 ? 5 : null);
  const plan: PlanGroup[] = [
    { id: "lamps.wiadukt", kind: "lamp-pastoral", spacing: 20, line: [-50, 0, 50, 0] },
    { id: "lamps.osm", kind: "lamp-pastoral", points: [[-5, 4]] },
  ];
  const lamp = (x: number, y: number, z: number, prop = "lamp-pastoral") => ({ prop, x, y, z });

  it("finds a lamp of the line on the valley's ground beside the deck or under it, not one on the deck nor one past the reach", () => {
    const found = lampsBesideDeck([lamp(0, 0, 5), lamp(10, 1, -3), lamp(-10, 5, 2.95), lamp(5, 0, 6), lamp(15, 3.15, 3.6)], plan, deck);
    expect(found).toEqual([
      { at: "0.0,5.0", what: "lamp-pastoral of lamps.wiadukt 5.00 m under the deck beside it" },
      { at: "10.0,-3.0", what: "lamp-pastoral of lamps.wiadukt 4.00 m under the deck beside it" },
      // Zamkowa's abutment (G-507): 1.85 m under the deck, its lantern among the walkers.
      { at: "15.0,3.6", what: "lamp-pastoral of lamps.wiadukt 1.85 m under the deck beside it" },
    ]);
  });

  it("leaves out a lamp on an abutment's bank, off the deck's stretch of the line, at a node of the plan and of other kinds", () => {
    expect(lampsBesideDeck([lamp(0, 3.6, 4)], plan, deck)).toEqual([]);
    expect(lampsBesideDeck([lamp(21.5, 0, 4)], plan, deck)).toEqual([]);
    expect(lampsBesideDeck([lamp(-5, 0, 4)], plan, deck)).toEqual([]);
    expect(lampsBesideDeck([lamp(0, 0, 5, "lamp-road")], plan, deck)).toEqual([]);
  });
});
