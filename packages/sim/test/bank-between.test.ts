import { describe, expect, it, vi } from "vitest";
import type { Vec3 } from "@seki/core";
import { Simulation, WORLD_CHUNKS, WORLD_METRO } from "../src";
import type { Rect } from "../src/content/builders";
import { bankBetween } from "../src/systems/ai/straight-walk";
import { STEP_HEIGHT } from "../src/systems/movement-system";
import { NAV_CELL } from "../src/systems/ai/nav-raster";
import { GroundField } from "../src/world/ground";

/**
 * G-886: a guard after the player 200 m off asked every step whether the way to her crosses a
 * bank, sampling the slope every half cell of it: 400 slopes a step on the level street of the
 * docks. The blocks of terrain too gentle for a bank anywhere (`GentleBlocks`) answer the same
 * without a slope sampled in them.
 */

const ground = Simulation.create({ seed: 1 }).streamer.ground;

/** The old test: the slope at every sample of the way (with the flights' rule of `bankBetween`). */
const everySample = (g: GroundField, a: Vec3, b: Vec3, reach: number): boolean => {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / NAV_CELL);
  const flights = g.nearFlight(Math.min(a.x, b.x), Math.min(a.z, b.z), 0, Math.max(a.x, b.x), Math.max(a.z, b.z));
  let last = flights ? g.heightAt(a.x, a.z, reach) : 0;
  for (let i = 1; i <= n; i++) {
    const [x, z] = [a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n];
    if (g.steepAt(x, z, reach)) return true;
    if (!flights) continue;
    const h = g.heightAt(x, z, reach);
    if (h - last > STEP_HEIGHT && g.onFlight(x, z)) return true;
    last = h;
  }
  return false;
};

/** A fixed sequence in [0, 1): the same fan every run. */
const sequence = (seed: number) => {
  let s = seed >>> 0;
  return (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
};

const at = (x: number, z: number): Vec3 => ({ x, y: ground.heightAt(x, z), z });

/** The boxes where the ground is not the terrain alone: bridges' decks, flights, shafts, vaults. */
const special: Rect[] = [
  ...WORLD_CHUNKS.flatMap((c) => [...(c.decks ?? []).map((d) => d.box), ...(c.cuts ?? []).map((k) => k.bounds), ...(c.vaults ?? []).map((v) => v.bounds)]),
  ...WORLD_METRO.flatMap((s) => s.entrances.flatMap((e) => [e.cut.bounds, ...(e.platform?.vaults ?? []).map((v) => v.bounds)])),
];

/** Ways all over the city, short and long, and across each special box, its corners and edges. */
const fan = (): [Vec3, Vec3][] => {
  const rnd = sequence(886);
  const out: [Vec3, Vec3][] = [];
  for (const c of WORLD_CHUNKS.filter((k) => k.terrain)) {
    const b = c.bounds;
    for (let i = 0; i < 60; i++) {
      const [x, z] = [b.minX + rnd() * (b.maxX - b.minX), b.minZ + rnd() * (b.maxZ - b.minZ)];
      const [r, a] = [[3, 12, 40, 120, 250][i % 5]!, rnd() * 2 * Math.PI];
      out.push([at(x, z), at(x + Math.cos(a) * r, z + Math.sin(a) * r)]);
    }
  }
  for (const b of special) {
    const m = 6;
    out.push([at(b.minX - m, b.minZ - m), at(b.maxX + m, b.maxZ + m)], [at(b.maxX + m, b.minZ - m), at(b.minX - m, b.maxZ + m)]);
    out.push([at(b.minX - m, (b.minZ + b.maxZ) / 2), at(b.maxX + m, (b.minZ + b.maxZ) / 2)], [at((b.minX + b.maxX) / 2, b.minZ - m), at((b.minX + b.maxX) / 2, b.maxZ + m)]);
    for (let i = 0; i < 8; i++) {
      const [x, z] = [b.minX - m + rnd() * (b.maxX - b.minX + 2 * m), b.minZ - m + rnd() * (b.maxZ - b.minZ + 2 * m)];
      const a = rnd() * 2 * Math.PI;
      out.push([at(x, z), at(x + Math.cos(a) * 30, z + Math.sin(a) * 30)]);
    }
  }
  return out;
};

describe("the walk's test for a bank between two points (G-886)", () => {
  it("gives what the slope at every sample gives, over the city, its bridges, flights, shafts and vaults", () => {
    const results = { bank: 0, free: 0 };
    for (const [a, b] of fan()) {
      for (const reach of [Infinity, -Infinity]) {
        const want = everySample(ground, a, b, reach);
        expect(bankBetween(ground, a, b, reach), `${a.x}, ${a.z} to ${b.x}, ${b.z}, reach ${reach}`).toBe(want);
        results[want ? "bank" : "free"]++;
      }
    }
    expect(Math.min(results.bank, results.free)).toBeGreaterThan(200);
  });

  it("finds no point of a gentle block steep, for any reach", () => {
    const rnd = sequence(7);
    const box = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
    let gentle = 0;
    const points: [number, number][] = [];
    for (const c of WORLD_CHUNKS.filter((k) => k.terrain)) {
      const b = c.bounds;
      for (let i = 0; i < 1500; i++) points.push([b.minX - 1 + rnd() * (b.maxX - b.minX + 2), b.minZ - 1 + rnd() * (b.maxZ - b.minZ + 2)]);
    }
    for (const b of special) for (let i = 0; i < 200; i++) points.push([b.minX - 3 + rnd() * (b.maxX - b.minX + 6), b.minZ - 3 + rnd() * (b.maxZ - b.minZ + 6)]);
    for (const [x, z] of points) {
      if (!ground.gentle.at(x, z, box)) continue;
      gentle++;
      expect(x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ).toBe(true);
      const h = ground.heightAt(x, z);
      for (const reach of [Infinity, -Infinity, h + STEP_HEIGHT, h - 3]) expect(ground.steepAt(x, z, reach), `${x}, ${z}, reach ${reach}`).toBe(false);
    }
    expect(gentle).toBeGreaterThan(points.length / 4);
  });

  it("samples a slope on a tenth of the samples at most on the guard's 200 m chase across the docks", () => {
    const steep = vi.spyOn(GroundField.prototype, "steepAt");
    let samples = 0;
    // From the guards' yard to the player in the east of the docks (pinned-far-sleep, calmWest).
    for (const from of [at(2510, 450), at(2530, 390), at(2470, 360)]) {
      const to = at(2670, 300);
      samples += Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / NAV_CELL);
      expect(bankBetween(ground, from, to, Infinity)).toBe(false);
    }
    const sampled = steep.mock.calls.length;
    steep.mockRestore();
    expect(samples).toBeGreaterThan(900);
    expect(sampled).toBeLessThan(samples / 10);
  });
});
