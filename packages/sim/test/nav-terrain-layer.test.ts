import { describe, expect, it, vi } from "vitest";
import { GroundField, Simulation, groundOf, groundY } from "../src";
import { NEAR_WINDOW, windowAt } from "../src/systems/ai/nav-field";
import { type Raster, type Slices, rasterise } from "../src/systems/ai/nav-raster";
import { collidersOf } from "../src/world/solids";
import { teleportPlayer } from "./helpers";

/**
 * The terrain pass of a raster made once for every floor of a window (`terrainLayer`): a ganger
 * going down the stairs of Alchemia's car park made a raster at each quarter metre of a floor, the
 * terrain under the window half of each. A pure cache: the same rasters and the same slices.
 */

const made = (steps: Slices<Raster>): { raster: Raster; yields: number[] } => {
  const yields: number[] = [];
  for (;;) {
    const s = steps.next();
    if (s.done) return { raster: s.value, yields };
    yields.push(s.value);
  }
};

describe("the terrain of a raster's window, made once a ground (ADR-0025)", () => {
  it("rasterises the floors of the car park's stairs on the terrain made for the first, as on a ground of their own", () => {
    const sim = Simulation.create({ seed: 3 });
    teleportPlayer(sim, { x: 420, y: groundY(420, 40), z: 40 });
    sim.step();
    const ground = groundOf(sim.world);
    const at = windowAt(sim.world, NEAR_WINDOW, { x: 408, y: 0, z: 32 });
    const colliders = collidersOf(at.solids);
    const raster = (floor: number, on: GroundField) => made(rasterise(colliders, floor, -Infinity, at.x0, at.z0, on, NEAR_WINDOW.cells));
    const first = raster(-5.75, ground);
    const heights = vi.spyOn(ground, "heightAt");
    const second = raster(-6, ground);
    expect(heights).not.toHaveBeenCalled();
    heights.mockRestore();
    // Grounds of the same content, each its own: nothing kept for them.
    for (const [floor, kept] of [[-5.75, first], [-6, second]] as const) {
      const fresh = new GroundField(ground.made.chunks, ground.made.cuts, ground.made.vaults);
      const alone = raster(floor, fresh);
      expect(kept.yields).toEqual(alone.yields);
      expect(kept.raster.open).toEqual(alone.raster.open);
      expect(kept.raster.base).toEqual(alone.raster.base);
    }
    expect(first.raster.open).not.toEqual(second.raster.open);
  });
});
