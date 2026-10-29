import { describe, expect, it } from "vitest";
import { World } from "miniplex";
import {
  type Entity,
  FLAT_GROUND,
  GroundField,
  MAX_WALK_SLOPE,
  bindGround,
  clearSpot,
  groundOf,
  heightApart,
  makePrism,
  terrainSeamGap,
} from "../src";
import { propEntity } from "../src/world/factory";
import { NAV_CELL, followDetour, planDetour, straightWalk } from "../src/systems/ai/steering";
import { BOUNDS, gridOf, hill, testChunks } from "./terrain-world";

const field = new GroundField(testChunks());

describe("the ground of chunks (ADR-0043)", () => {
  it("is the flat street without terrain, everywhere and for every ray", () => {
    expect(FLAT_GROUND.hasTerrain).toBe(false);
    expect(FLAT_GROUND.heightAt(12, -40)).toBe(0);
    expect(FLAT_GROUND.steepAt(0, 0)).toBe(false);
    expect(FLAT_GROUND.rayHit({ x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }, 10)).toBeNull();
    expect(groundOf(new World<Entity>())).toBe(FLAT_GROUND);
    const flat = new GroundField([{ bounds: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 } }]);
    expect(flat.heightAt(5, 5)).toBe(0);
    expect(flat.gridAt(5, 5)).toBeNull();
  });

  it("samples the chunk's terrain, and the nearest chunk's outside every chunk", () => {
    expect(field.heightAt(-60, 100)).toBeCloseTo(hill(-60, 100), 6);
    expect(field.heightAt(100, 150)).toBeCloseTo(hill(100, 150), 6);
    // Beyond the north edge: the grid's edge, clamped.
    expect(field.heightAt(-60, 400)).toBeCloseTo(hill(-60, 250), 6);
    expect(field.heightAt(-400, 100)).toBeCloseTo(hill(-150, 100), 6);
  });

  it("agrees with itself across the seam of two chunks", () => {
    const [west, east] = testChunks();
    if (!west || !east) throw new Error("no chunks");
    expect(terrainSeamGap(west, east)).toBeLessThan(1e-9);
    expect(terrainSeamGap(west, { ...east, terrain: gridOf(0, -50, 2, 76, 151, (x, z) => hill(x, z) + 0.5) })).toBeCloseTo(0.5);
    expect(terrainSeamGap(west, { bounds: east.bounds })).toBe(0);
    expect(terrainSeamGap(west, { ...east, bounds: { ...BOUNDS, minX: 10 } })).toBe(0);
    for (let z = -50; z <= 250; z += 3.7) expect(field.heightAt(-1e-9, z)).toBeCloseTo(field.heightAt(1e-9, z), 6);
  });

  it("measures the slope over half a metre: the hill is walkable, the bank and the ridge are not", () => {
    expect(field.slopeAt(-60, 100)).toBeCloseTo(0.1, 6);
    expect(field.steepAt(-60, 100)).toBe(false);
    expect(field.steepAt(82, 100)).toBe(true);
    expect(field.steepAt(-60, -21)).toBe(true);
    expect(MAX_WALK_SLOPE).toBeCloseTo(Math.tan((35 * Math.PI) / 180));
    // A bump of 5 cm on a 1 m lidar grid does not make the ground steep.
    const bumpy = new GroundField([{ bounds: { minX: 0, maxX: 20, minZ: 0, maxZ: 20 }, terrain: gridOf(0, 0, 1, 21, 21, (x, z) => ((x + z) % 2) * 0.05) }]);
    for (let x = 1; x < 19; x += 0.37) expect(bumpy.steepAt(x, 7.3)).toBe(false);
  });

  it("stops rays on the terrain, even on a ridge one grid point wide (DDA, no stepping over)", () => {
    // A spike 2 m high on one row of a 2 m grid: a level ray at 1.98 m crosses only 2 cm of it.
    const spike = new GroundField([{ bounds: { minX: 0, maxX: 40, minZ: 0, maxZ: 40 }, terrain: gridOf(0, 0, 2, 21, 21, (_x, z) => (z === 20 ? 2 : 0)) }]);
    for (const x0 of [3, 3.3, 7.77]) {
      const t = spike.rayHit({ x: x0, y: 1.98, z: 1 }, { x: 0.05, y: 0, z: Math.sqrt(1 - 0.0025) }, 100);
      expect(t).not.toBeNull();
      expect(t ?? 0).toBeGreaterThan(18.5);
      expect(t ?? 0).toBeLessThan(19.1);
    }
    expect(spike.rayHit({ x: 3, y: 2.01, z: 1 }, { x: 0, y: 0, z: 1 }, 100)).toBeNull();
    // Downwards onto the plain, straight down, and from below the ground.
    expect(spike.rayHit({ x: 5, y: 10, z: 5 }, { x: 0, y: -1, z: 0 }, 100)).toBeCloseTo(10, 6);
    const down = { x: Math.SQRT1_2, y: -Math.SQRT1_2, z: 0 };
    expect(spike.rayHit({ x: 1, y: 5, z: 5 }, down, 100)).toBeCloseTo(5 * Math.SQRT2, 6);
    expect(spike.rayHit({ x: 1, y: -1, z: 5 }, { x: 1, y: 0, z: 0 }, 10)).toBe(0);
    // Out of the chunk and back over the street: nothing to hit there.
    expect(spike.rayHit({ x: 39, y: 0.5, z: 5 }, { x: 1, y: 0, z: 0 }, 30)).toBeNull();
    expect(spike.rayHit({ x: 60, y: 0.5, z: 5 }, { x: 1, y: 0, z: 0 }, 30)).toBeNull();
    // Rays across the seam: the ridge of the west chunk, from the east one.
    expect(field.rayHit({ x: 10, y: 1.5, z: -20 }, { x: -1, y: 0, z: 0 }, 100)).toBeCloseTo(51, 4);
    expect(field.rayHit({ x: -60, y: 1.5, z: -40 }, { x: 0, y: 0, z: 1 }, 100)).toBeCloseTo(18, 4);
  });

  it("tells floors apart from the ground under them", () => {
    const world = new World<Entity>();
    expect(heightApart(world, { x: -60, y: 0, z: 0 }, { x: -60, y: 15, z: 150 })).toBe(15);
    bindGround(world, field);
    expect(heightApart(world, { x: -60, y: hill(-60, 0), z: 0 }, { x: -60, y: hill(-60, 150), z: 150 })).toBeCloseTo(0, 6);
  });

  it("puts a spawn out of a prism's walls and onto the terrain; leaves boxes and the flat street alone", () => {
    const world = new World<Entity>();
    const [, east] = testChunks();
    const building = east?.props[0];
    if (!building) throw new Error("no building");
    world.add(propEntity(9000, building, "test-east"));
    const at = { x: 30, y: 0, z: 60 };
    const placed = clearSpot(world, field, at, 0.38);
    const prism = world.with("prisms").first?.prisms[0];
    if (!prism) throw new Error("no prism");
    expect(placed.y).toBeCloseTo(field.heightAt(placed.x, placed.z), 6);
    expect(Math.hypot(placed.x - 30, placed.z - 60)).toBeGreaterThan(2.5);
    const clear = { x: -60, y: hill(-60, 10), z: 10 };
    expect(clearSpot(world, field, clear, 0.38)).toBe(clear);
    expect(clearSpot(world, FLAT_GROUND, { x: 0, y: -1, z: 0 }, 0.38).y).toBe(-1);
    expect(() => propEntity(9001, { center: { x: 0, y: 0, z: 0 }, view: { kind: "building", outline: [{ x: 0, z: 0 }, { x: 4, z: 0 }, { x: 4, z: 4 }, { x: 2, z: 1 }, { x: 0, z: 4 }], height: 3, levels: 1, use: "other", look: 0 }, solid: true }, "c")).toThrow(/concave/);
    expect(makePrism(prism.points, 0, 1).points).toHaveLength(4);
  });
});

describe("the AI's raster on terrain and prisms (ADR-0043, ADR-0025)", () => {
  const world = (): World<Entity> => {
    const w = new World<Entity>();
    bindGround(w, field);
    let id = 9100;
    for (const c of testChunks()) for (const p of c.props) w.add(propEntity(id++, p, c.id));
    return w;
  };

  it("walks straight across the hill, but not up the bank or through the L", () => {
    const w = world();
    const on = (x: number, z: number) => ({ x, y: hill(x, z), z });
    expect(straightWalk(w, on(-60, 10), on(-60, 90))).toBe(true);
    expect(straightWalk(w, on(70, 40), on(95, 40))).toBe(false);
    expect(straightWalk(w, on(-20, 94), on(-20, 112))).toBe(false);
  });

  it("plans round the L-shaped building and keeps off its walls", () => {
    const w = world();
    const from = { x: -20, y: hill(-20, 112), z: 112 };
    const goal = { x: -20, y: hill(-20, 94), z: 94 };
    const plan = planDetour(w, from, goal);
    expect(plan).not.toBeNull();
    if (!plan) return;
    // Follow the field: every waypoint is open ground, and the walk gets there.
    let at = from;
    const parts = w.with("prisms").entities.flatMap((e) => e.prisms);
    for (let i = 0; i < 200 && Math.hypot(at.x - goal.x, at.z - goal.z) > 1; i++) {
      const next = followDetour(plan, at);
      expect(next).not.toBeNull();
      if (!next) break;
      const d = Math.hypot(next.x - at.x, next.z - at.z);
      const step = Math.min(1, d);
      at = { x: at.x + ((next.x - at.x) / d) * step, y: at.y, z: at.z + ((next.z - at.z) / d) * step };
      for (const p of parts) expect(p.box.min.x - 0.3 > at.x || p.box.max.x + 0.3 < at.x || p.box.min.z - 0.3 > at.z || p.box.max.z + 0.3 < at.z).toBe(true);
    }
    expect(Math.hypot(at.x - goal.x, at.z - goal.z)).toBeLessThanOrEqual(1);
  });

  it("closes the cells of the bank: the way to the plateau stays off it", () => {
    const w = world();
    const from = { x: 70, y: hill(70, 40), z: 40 };
    const goal = { x: 95, y: hill(95, 40), z: 40 };
    // The plateau is 8 m up: another floor by height, but on the same ground.
    expect(heightApart(w, from, goal)).toBeCloseTo(0, 6);
    const plan = planDetour(w, from, goal);
    // No way up the bank inside the window: the field does not reach the walker.
    expect(plan).not.toBeNull();
    expect(plan ? followDetour(plan, from) : 'no plan').toBeNull();
    // Along the foot of the bank the field does lead.
    const along = planDetour(w, from, { x: 70, y: hill(70, 70), z: 70 });
    expect(along ? followDetour(along, from) : null).not.toBeNull();
    expect(NAV_CELL).toBe(0.5);
  });
});
