import { describe, expect, it } from "vitest";
import { smallAlone } from "../src/building-alone.ts";
import { massing } from "../src/building-tags.ts";
import { type Area } from "../src/features.ts";

const box = (id: string, x: number, z: number, w: number, d: number): Area =>
  ({ id, tags: { building: "yes" }, ring: [{ x, z }, { x: x + w, z }, { x: x + w, z: z + d }, { x, z: z + d }], holes: 0 }) as unknown as Area;

describe("small buildings on their own (G-127)", () => {
  it("finds a small pavilion on a square, not a narrow house in a row nor a big one alone", () => {
    const pavilion = box("w1", 100, 100, 6, 6);
    const rowA = box("w2", 0, 0, 5, 9);
    const rowB = box("w3", 5.2, 0, 5, 9);
    const hall = box("w4", 200, 200, 20, 20);
    expect([...smallAlone([pavilion, rowA, rowB, hall])]).toEqual(["w1"]);
  });

  it("gives such a building one storey when the map gives no height, as Bar Centralny by Pedet", () => {
    const opts = { area: 33, shops: false, range: [3, 5] as const, look: 7 };
    expect(massing({ building: "yes" }, opts).levels).toBeGreaterThan(1);
    expect(massing({ building: "yes" }, { ...opts, alone: true }).levels).toBe(1);
    // The map's own levels still win.
    expect(massing({ building: "yes", "building:levels": "3" }, { ...opts, alone: true }).levels).toBe(3);
  });
});
