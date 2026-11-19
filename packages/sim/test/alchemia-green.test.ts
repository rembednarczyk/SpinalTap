import { describe, expect, it } from "vitest";
import { ALCHEMIA_TIER_PIECES, FRONT_SIGN, GREEN_SLOPE, L3, L3_TOP, frontGreenPieces, frontPieces } from "../src";

/** The board's green on Alchemia (C2 of the board 1:1, 19.11): drawn only, by rule along the storeys. */
describe("Alchemia's green (C2)", () => {
  const green = frontGreenPieces();
  const curtains = green.filter((p) => p.outline);
  const slabs = ALCHEMIA_TIER_PIECES.filter((p) => p.kind === "roof" && p.outline && p.box.y1 - p.box.y0 <= 0.31);

  it("hangs curtains of green over the storeys' open edges, all round the complex, none solid", () => {
    expect(curtains.length).toBeGreaterThan(60);
    for (const p of green) expect(p.solid, `${p.box.x0},${p.box.z0}`).toBe(false);
    // On every side: south, north, east and west of the complex's middle.
    const [mx, mz] = [416, 20];
    expect(curtains.some((p) => p.box.z1 < mz - 15)).toBe(true);
    expect(curtains.some((p) => p.box.z0 > mz + 25)).toBe(true);
    expect(curtains.some((p) => p.box.x0 > mx + 15)).toBe(true);
    expect(curtains.some((p) => p.box.x1 < mx - 15)).toBe(true);
  });

  it("keeps the curtains outside the slabs they hang from and off the sign and the screens", () => {
    const keepOff = [...frontPieces().filter((p) => p.kind === "screen" || p.kind === "sign").map((p) => p.box), FRONT_SIGN];
    for (const c of curtains) {
      const [x, z] = [(c.box.x0 + c.box.x1) / 2, (c.box.z0 + c.box.z1) / 2];
      for (const b of keepOff) {
        const near = x > b.x0 - 0.3 && x < b.x1 + 0.3 && z > b.z0 - 0.3 && z < b.z1 + 0.3 && c.box.y1 > b.y0 && c.box.y0 < b.y1;
        expect(near, `${x},${z}`).toBe(false);
      }
      // Its middle outside every slab's outline at the slab's height (it hangs past the edge).
      const y = c.box.y1 - 0.2;
      const inSlab = slabs.some((s) => y > s.box.y0 && y < s.box.y1 && s.outline!.every((p, i) => {
        const q = s.outline![(i + 1) % s.outline!.length]!;
        return (q.x - p.x) * (z - p.z) - (q.z - p.z) * (x - p.x) >= 0;
      }));
      expect(inSlab, `${x},${z}`).toBe(false);
    }
  });

  it("plants shrubs and trees on the front's roofs only, none on the walked terraces of A and B, a tree on L3's roof", () => {
    const shrubs = green.filter((p) => !p.outline && p.kind === "green");
    expect(shrubs.length).toBeGreaterThan(30);
    for (const s of shrubs) expect(s.box.z0, `${s.box.x0},${s.box.z0}`).toBeLessThan(39);
    expect(green.some((p) => p.kind === "frame" && p.box.y0 >= L3_TOP && p.box.x0 > L3.minX && p.box.x1 < L3.maxX)).toBe(true);
  });

  it("draws the green steps as one slope from L1's roof down to the lowest step", () => {
    expect(GREEN_SLOPE.top - GREEN_SLOPE.foot).toBeGreaterThan(3);
    expect(GREEN_SLOPE.x1 - GREEN_SLOPE.x0).toBeGreaterThan(7);
  });
});
