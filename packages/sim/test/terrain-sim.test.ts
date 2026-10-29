import { describe, expect, it } from "vitest";
import { GroundField, circleTouchesPrism, gangerEntity, groundOf, hitscan, lineOfSight, stateHash } from "../src";
import { input, run } from "./helpers";
import { TURNED_AT, hill, terrainSim, testChunks } from "./terrain-world";

const player = (sim: ReturnType<typeof terrainSim>) => {
  const p = sim.player();
  if (!p) throw new Error("no player");
  return p;
};

describe("terrain and prisms in the simulation (ADR-0043)", () => {
  it("loads the test chunks and builds the prism solids", () => {
    const sim = terrainSim({ x: -10, z: 10 });
    expect(sim.streamer.loadedChunks).toEqual(["test-west", "test-east"]);
    const prismSolids = sim.world.with("solid", "prisms").entities;
    expect(prismSolids.map((e) => e.prisms.length).sort()).toEqual([1, 2]);
    expect(groundOf(sim.world).hasTerrain).toBe(true);
  });

  for (const cell of [2, 10]) {
    it(`walks up the 20 m slope on the ground, without a jump (grid of ${cell} m)`, () => {
      const sim = terrainSim({ x: -60, z: 5 }, 0, cell);
      let worst = 0;
      for (let i = 0; i < 60 * 30; i++) {
        sim.step(input({ moveZ: 1 }));
        const p = player(sim).position;
        worst = Math.max(worst, Math.abs(p.y - hill(p.x, p.z)));
        expect(player(sim).fall ?? 0).toBeLessThanOrEqual(0);
      }
      const p = player(sim).position;
      expect(p.z).toBeGreaterThan(100);
      expect(p.y).toBeCloseTo(hill(p.x, p.z), 2);
      expect(worst).toBeLessThan(0.02);
    });
  }

  it("crosses the seam between two chunks with a continuous height", () => {
    const sim = terrainSim({ x: -10, z: 40 }, Math.PI / 2);
    let last = player(sim).position.y;
    let jump = 0;
    for (let i = 0; i < 60 * 5; i++) {
      sim.step(input({ moveZ: 1 }));
      const y = player(sim).position.y;
      jump = Math.max(jump, Math.abs(y - last));
      last = y;
    }
    expect(player(sim).position.x).toBeGreaterThan(5);
    expect(jump).toBeLessThan(0.01);
  });

  it("stops at a bank steeper than 35° like at a wall, and slides along it", () => {
    const sim = terrainSim({ x: 70, z: 20 }, Math.PI / 2);
    run(sim, 60 * 6, input({ moveZ: 1 }));
    const p = player(sim).position;
    expect(p.x).toBeLessThan(81);
    expect(p.y).toBeLessThan(hill(80, p.z) + 1.5);
    // Heading north-east into the bank: it keeps going north along its foot.
    const slide = terrainSim({ x: 70, z: 20 }, Math.PI / 4);
    run(slide, 60 * 6, input({ moveZ: 1 }));
    const q = player(slide).position;
    expect(q.x).toBeLessThan(81);
    expect(q.z).toBeGreaterThan(35);
  });

  it("jumps and lands on the terrain", () => {
    const sim = terrainSim({ x: -60, z: 100 });
    const landed: number[] = [];
    sim.bus.on("Landed", (e) => landed.push(e.at.y));
    sim.step(input({ jump: true }));
    run(sim, 10);
    expect(player(sim).position.y).toBeGreaterThan(hill(-60, 100) + 0.5);
    run(sim, 60);
    expect(landed).toHaveLength(1);
    expect(landed[0]).toBeCloseTo(hill(-60, 100), 2);
  });

  it("slides along the wall of the building turned by 17° and gets past it", () => {
    // From the south, straight north into the slanted south wall, a little west of its middle.
    const sim = terrainSim({ x: TURNED_AT.x - 1, z: TURNED_AT.z - 12 });
    const building = sim.world.with("solid", "prisms").entities.find((e) => e.prisms.length === 1);
    const prism = building?.prisms[0];
    if (!prism) throw new Error("no prism");
    let touched = false;
    for (let i = 0; i < 60 * 15; i++) {
      sim.step(input({ moveZ: 1 }));
      const p = player(sim).position;
      expect(circleTouchesPrism(prism, p.x, p.z, 0.37)).toBe(false);
      if (circleTouchesPrism(prism, p.x, p.z, 0.4)) touched = true;
    }
    expect(touched).toBe(true);
    expect(player(sim).position.z).toBeGreaterThan(TURNED_AT.z + 6);
  });

  it("stands on the roof of a prism", () => {
    const sim = terrainSim({ x: -27, z: 120 });
    const roof = sim.world.with("solid", "prisms").entities.find((e) => e.prisms.length === 2)?.solid.max.y ?? 0;
    const p = player(sim);
    p.position = { x: -27, y: roof + 2, z: 120 };
    run(sim, 60);
    expect(player(sim).position.y).toBeCloseTo(roof, 5);
  });

  it("a ganger chases the player round the L-shaped building", () => {
    const sim = terrainSim({ x: -20, z: 94 });
    const at = { x: -20, y: hill(-20, 112), z: 112 };
    const g = gangerEntity(5000, { key: "chaser", position: at, yaw: Math.PI }, null, 200, "test-west", undefined, "hebi_brawler");
    if (!g.ai) throw new Error("no ai");
    g.ai.alerted = true;
    sim.world.add(g);
    const pz = player(sim).position;
    expect(lineOfSight(sim.world, { ...at, y: at.y + 1.6 }, { ...pz, y: pz.y + 1.25 })).toBe(false);
    const parts = sim.world.with("prisms").entities.flatMap((e) => e.prisms);
    let reached = -1;
    for (let i = 0; i < 60 * 20 && reached < 0; i++) {
      sim.step();
      const p = player(sim).position;
      for (const part of parts) expect(circleTouchesPrism(part, g.position.x, g.position.z, 0.37)).toBe(false);
      if (Math.hypot(g.position.x - p.x, g.position.z - p.z) < 2.5) reached = i;
    }
    expect(reached).toBeGreaterThan(0);
    // Around the end of the bar, not through it: the bar is 18 m from the start, the way round over 30 m.
    expect(reached / 60).toBeGreaterThan(30 / 8);
  });

  it("a shot stops on the prism's wall and on the crest of the ridge", () => {
    const sim = terrainSim({ x: -20, z: 90 });
    const y = hill(-20, 90) + 1.5;
    const wall = hitscan(sim.world, { x: -20, y, z: 90 }, { x: 0, y: 0, z: 1 }, 100, player(sim).id);
    expect(wall.entity).toBeNull();
    expect(wall.distance).toBeCloseTo(10, 5);
    // The ridge: 3 m high at z = -20; a level shot 1.5 m above the ground on its south side.
    const from = { x: -60, y: hill(-60, -40) + 1.5, z: -40 };
    const crest = hitscan(sim.world, from, { x: 0, y: 0, z: 1 }, 100, player(sim).id);
    // 1.5 m up the ridge's side, 2 m before its crest.
    expect(crest.distance).toBeCloseTo(18, 3);
    expect(crest.point.y).toBeCloseTo(hill(crest.point.x, crest.point.z), 3);
    expect(lineOfSight(sim.world, from, { x: -60, y: from.y, z: 0 })).toBe(false);
    // Over the ridge, the line is free.
    expect(lineOfSight(sim.world, { ...from, y: 4 }, { x: -60, y: 4, z: 0 })).toBe(true);
  });

  it("puts content spawned under the terrain or inside a prism where it can stand", () => {
    const sim = terrainSim({ x: -60, z: 10 });
    const g = gangerEntity(5001, { key: "buried", position: { x: 30, y: 0, z: 60 }, yaw: 0 }, null, 80, "test-east");
    const ground = new GroundField(testChunks());
    const before = g.position;
    sim.world.add(g);
    run(sim, 2);
    expect(g.position).not.toBe(before);
    expect(g.position.y).toBeGreaterThanOrEqual(ground.heightAt(g.position.x, g.position.z) - 1e-6);
  });

  it("is deterministic: two runs, one hash", () => {
    const once = () => {
      const sim = terrainSim({ x: -20, z: 94 }, 0, 2, 9);
      const g = gangerEntity(5000, { key: "chaser", position: { x: -20, y: hill(-20, 112), z: 112 }, yaw: Math.PI }, null, 200, "test-west", undefined, "hebi_brawler");
      if (g.ai) g.ai.alerted = true;
      sim.world.add(g);
      for (let i = 0; i < 600; i++) sim.step(input({ moveZ: i % 200 < 100 ? 1 : 0, moveX: i % 150 < 75 ? 1 : -1, fire: i % 90 < 10, jump: i % 120 === 0 }));
      return stateHash(sim.snapshot(null, "t", ""));
    };
    expect(once()).toBe(once());
  });
});
