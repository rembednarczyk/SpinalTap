import { describe, expect, it } from "vitest";
import { ALCHEMIA_PAVILION, PAVILION_CENTRE, PAVILION_TARP, REN_SPOT, TARG_ROOF_STASH } from "@seki/sim";
import type { PointLightDef } from "../src/npr/lighting";
import { PAVILION_LAMPS, PAVILION_LAMPS_NEAR, PavilionLamps } from "../src/renderer/alchemia/pavilion-lamps";
import { tarpPoint } from "../src/renderer/alchemia/pavilion-tarp";

/**
 * Ren's camp on the pavilion's roof as drawn (`docs/lokacje/alchemia-pawilon-dach.md`): the tarp sagging between its four
 * ties, over a standing head at his place and the bag's, lowest at its north-east corner where it drips; the camp's
 * lantern and the ladder's green lamp on only near the pavilion.
 */

const R = ALCHEMIA_PAVILION.roof;

/** The sheet's height over a point of the map: its sample nearest in plan. */
const tarpOver = (x: number, z: number): { readonly y: number; readonly off: number } => {
  let best = { y: 0, off: Infinity };
  for (let s = 0; s <= 1.0001; s += 0.01) {
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const p = tarpPoint(s, t);
      const off = Math.hypot(p.x - x, p.z - z);
      if (off < best.off) best = { y: p.y, off };
    }
  }
  return best;
};

describe("Ren's tarp", () => {
  it("hangs from its four ties, sagging between them, lowest at the pole where the water runs off", () => {
    const corners = [tarpPoint(0, 0), tarpPoint(1, 0), tarpPoint(1, 1), tarpPoint(0, 1)];
    corners.forEach((c, i) => {
      const tie = PAVILION_TARP[i]!;
      expect(Math.hypot(c.x - tie.x, c.y - tie.y, c.z - tie.z)).toBeLessThan(1e-9);
    });
    // Its south edge taut along the board, its middle under the corners' mean.
    expect(tarpPoint(0.5, 0).y).toBeCloseTo(PAVILION_TARP[0].y, 5);
    const mid = tarpPoint(0.5, 0.5);
    expect(mid.y).toBeLessThan(PAVILION_TARP.reduce((s, c) => s + c.y, 0) / 4 - 0.05);
    let low = Infinity;
    for (let s = 0; s <= 1.0001; s += 0.05) for (let t = 0; t <= 1.0001; t += 0.05) low = Math.min(low, tarpPoint(s, t).y);
    expect(low).toBeGreaterThan(R + 1.6);
    expect(low).toBeLessThanOrEqual(PAVILION_TARP[2].y + 1e-9);
  });

  it("is over a standing head at Ren's place and over the bag", () => {
    for (const p of [REN_SPOT, TARG_ROOF_STASH.at]) {
      const over = tarpOver(p.x, p.z);
      expect(over.off).toBeLessThan(0.05);
      expect(over.y - R, `${p.x},${p.z}`).toBeGreaterThan(1.8);
    }
  });
});

describe("the pavilion roof's lamps", () => {
  it("light the camp warm and the ladder green, each clipped to its side of the roof's slab", () => {
    const [camp, ladder] = PAVILION_LAMPS;
    expect(camp!.light.clip?.minY).toBeLessThan(R);
    expect(camp!.light.clip?.minY).toBeGreaterThan(R - 0.1);
    expect(ladder!.light.clip?.maxY).toBeLessThan(R + 0.5);
    expect(ladder!.light.color).toBe("#3dff86");
  });

  it("are on near the pavilion only, and off with the city or down under it", () => {
    const lights = new Map<string, PointLightDef>();
    const lamps = new PavilionLamps({ addLight: (k, l) => lights.set(k, l), removeLight: (k) => lights.delete(k) });
    const far = { x: PAVILION_CENTRE.x + PAVILION_LAMPS_NEAR + 20, y: 0, z: PAVILION_CENTRE.z };
    lamps.update(far, true);
    expect(lights.size).toBe(0);
    lamps.update(REN_SPOT, true);
    expect([...lights.keys()].sort()).toEqual(PAVILION_LAMPS.map((l) => l.key).sort());
    lamps.update(REN_SPOT, false);
    expect(lights.size).toBe(0);
    lamps.update(REN_SPOT, true);
    lamps.update(far, true);
    expect(lights.size).toBe(0);
    expect(lamps.lit).toBe(false);
  });
});
