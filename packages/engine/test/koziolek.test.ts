import { describe, expect, it } from "vitest";
import { KOZIOLEK_PLINTH } from "../src/renderer/mapcity/koziolek";
import { monument } from "../src/renderer/mapcity/prop-civic";
import { MONUMENT_SHAPE } from "../src/renderer/mapcity/prop-shapes";

/*
 * The Koziołek of Lublin (comic realism, the user's decision of 20.11): a goat rearing on its
 * hind legs with its head and horns up, facing +z (the passers-by, ADR-0094 stage 4), inside the
 * monument's solid for it (sim `furniture.ts`: 0.9 x 0.6 m, 1.2 m tall). The old one was an
 * ellipsoid on four sticks lying along x.
 */

const goat = monument(MONUMENT_SHAPE.koziolek);
const pts = Array.from({ length: goat.positions.length / 3 }, (_, i) => ({ x: goat.positions[i * 3]!, y: goat.positions[i * 3 + 1]!, z: goat.positions[i * 3 + 2]! }));
const bronze = pts.filter((p) => p.y > KOZIOLEK_PLINTH + 0.001);

describe("the Koziołek (comic realism)", () => {
  it("is a modelled goat, not a blob: a thousand and more triangles with smooth normals", () => {
    expect(goat.indices.length / 3).toBeGreaterThan(1000);
    expect(goat.indices.length / 3).toBeLessThan(4000);
  });

  it("stands inside its solid: 0.9 x 0.6 m, up to 1.2 m", () => {
    for (const p of pts) {
      expect(Math.abs(p.x)).toBeLessThanOrEqual(0.45);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(0.3);
      expect(p.y).toBeLessThanOrEqual(1.2);
    }
  });

  it("rears: taller than long, its head high and to the front (+z), the rump behind and low", () => {
    const top = Math.max(...bronze.map((p) => p.y));
    const length = Math.max(...bronze.map((p) => p.z)) - Math.min(...bronze.map((p) => p.z));
    expect(top - KOZIOLEK_PLINTH).toBeGreaterThan(1.4 * length);
    const muzzle = bronze.reduce((a, p) => (p.y > 1.0 && p.z > a.z ? p : a), { x: 0, y: 0, z: -1 });
    expect(muzzle.z).toBeGreaterThan(0.2);
    const rump = bronze.reduce((a, p) => (p.z < a.z ? p : a), { x: 0, y: 0, z: 1 });
    expect(rump.y).toBeLessThan(0.8);
  });

  it("stands on both hind hooves on the plinth", () => {
    const low = bronze.filter((p) => p.y < KOZIOLEK_PLINTH + 0.04);
    expect(low.some((p) => p.x > 0.03)).toBe(true);
    expect(low.some((p) => p.x < -0.03)).toBe(true);
  });
});
