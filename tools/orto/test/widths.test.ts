import { describe, expect, it } from "vitest";
import { COVER } from "../src/classify.ts";
import { type Look, type Probe, measureWay, rayKerb, sideOf } from "../src/widths.ts";
import { type Candidate, measureCity, tableRows, tableText } from "../src/widths-city.ts";

/**
 * A synthetic street along +x from x 0 to 100 (its left is +z): asphalt (L 125) from z -3 to z 4,
 * a pavement (L 185) past it on both sides, a white centre line at z 0, a light car (L 230, 1.8 m)
 * parked at the north kerb from x 30 to 45, and a building's shade over the south pavement and
 * the kerb from x 60 to 75. The image ends at x 100.
 */
const street: Probe = (x, z): Look | null => {
  if (x < 0 || x > 100) return null;
  if (x >= 60 && x <= 75 && z < -2.5) return { cls: COVER.shadow, l: 35, s: 0.1 };
  if (x >= 30 && x <= 45 && z >= 2.2 && z < 4) return { cls: COVER.paving, l: 230, s: 0.05 };
  if (Math.abs(z) < 0.08) return { cls: COVER.paving, l: 235, s: 0.02 };
  if (z >= -3 && z < 4) return { cls: COVER.paving, l: 125, s: 0.04 };
  return { cls: COVER.paving, l: 185, s: 0.07 };
};
const axis = [
  { x: 0, z: 0 },
  { x: 100, z: 0 },
];

describe("carriageway widths on the orthophoto (ADR-0080 PR 10)", () => {
  it("finds the kerb across a marking, and not at a parked car or in shade", () => {
    const ref = { l: 125, s: 0.04 };
    const [left, right] = [
      { x: 0, z: 1 },
      { x: 0, z: -1 },
    ];
    // Halfway between the samples either side of the kerb: z 3.9 and 4 on the left, -3 and -3.1 on the right.
    expect(rayKerb(street, ref, { x: 10, z: 0 }, left, 9)).toBe(3.95);
    expect(rayKerb(street, ref, { x: 10, z: 0 }, right, 9)).toBe(3.05);
    // The car at the kerb is taken for the pavement (under `CONFIRM` of it, then the pavement): one sample short.
    expect(rayKerb(street, ref, { x: 40, z: 0 }, left, 9)).toBe(2.15);
    // The shade over the kerb hides it: no sample.
    expect(rayKerb(street, ref, { x: 70, z: 0 }, right, 9)).toBe("uncertain");
    // Asphalt as far as the ray looks: no kerb.
    expect(rayKerb(() => ({ cls: COVER.asphalt, l: 125, s: 0.04 }), ref, { x: 10, z: 0 }, right, 9)).toBe("no-kerb");
  });

  it("measures the street by its stations' consensus: the car and the shade outvoted", () => {
    const m = measureWay(street, axis, 6.5, []);
    expect(m.reason).toBe("ok");
    expect(m.left.median).toBe(3.95);
    expect(m.right.median).toBe(3.05);
    expect(m.width).toBe(7);
    expect(m.left.kept).toBe(m.left.stations);
    expect(m.right.uncertain).toBeGreaterThan(0);
  });

  it("leaves the stations near a junction and off the image out, and a side without a kerb at half the estimate", () => {
    const m = measureWay(street, [axis[0]!, { x: 140, z: 0 }], 6.5, [{ x: 50, z: 0 }]);
    // Every 5 m from 7.5 to 97.5 m (3 m from the ends, the image to x 100), less the four within 10 m of the junction.
    expect(m.left.stations).toBe(15);
    const open: Probe = (x, z) => (z < 0 ? { cls: COVER.paving, l: 125, s: 0.04 } : street(x, z));
    const one = measureWay(open, axis, 6.5, []);
    expect(one.reason).toBe("one-side");
    expect(one.right.median).toBeNull();
    expect(one.width).toBe(7.2);
  });

  it("drops a side its samples scatter over, and a width off the estimate", () => {
    expect(sideOf([1, 2.5, 4, 5.5, 7, "uncertain"]).median).toBeNull();
    expect(sideOf([3, 3.1, 3.2, 6, "no-kerb"]).median).toBe(3.1);
    expect(measureWay(street, axis, 20, []).reason).toBe("off-estimate");
    expect(measureWay(street, [axis[0]!, { x: 12, z: 0 }], 6.5, []).reason).toBe("few-stations");
  });

  it("gives the same table twice", () => {
    const ways: Candidate[] = [
      { id: "w2", name: "B", axis, estimate: 6.5, junctions: [] },
      { id: "w1", name: "A", axis: [axis[1]!, axis[0]!], estimate: 8, junctions: [{ x: 50, z: 0 }] },
    ];
    const [a, b] = [measureCity(ways, street), measureCity(ways, street)];
    expect(tableText(a)).toBe(tableText(b));
    expect(tableRows(a)).toEqual([
      ["w2", 7, 3.95, 3.05, "lr", ""],
      ["w1", 7, 3.05, 3.95, "lr", ""],
    ]);
  });
});
