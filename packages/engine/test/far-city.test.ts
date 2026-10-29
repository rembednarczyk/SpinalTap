import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { WORLD_CHUNKS } from "@seki/sim";
import { describe, expect, it } from "vitest";
import { Scene } from "../src/babylon";
import { NIGHT_RIG } from "../src/npr/lighting";
import { FAR_CHUNK_SLOTS, FarCity, planFarCity, unionBounds } from "../src/renderer/far-city";

describe("far city (ADR-0027)", () => {
  const plan = planFarCity(WORLD_CHUNKS);
  const B = unionBounds(WORLD_CHUNKS);

  it("has a stand-in for every chunk, in its slot", () => {
    expect(plan.chunks).toEqual(WORLD_CHUNKS.map((c) => c.id).slice(0, FAR_CHUNK_SLOTS));
    const slots = new Set<number>();
    for (let i = 0; i < plan.world.vertexCount; i++) slots.add(plan.world.uvs2[i * 2 + 1]!);
    // Lublin has more chunks than slots, and the map's buildings are no blocks: a stand-in for
    // every slotted chunk with blocks of the game's own (ADR-0045; the game draws the map city, far city off).
    WORLD_CHUNKS.slice(0, FAR_CHUNK_SLOTS).forEach((c, k) => {
      const bulk = c.props.some((p) => p.solid && p.view.kind === "block" && !p.view.rungs && !p.view.slope && p.view.size.y >= 2.5 && Math.min(p.view.size.x, p.view.size.z) >= 0.3);
      expect(slots.has(k + 1), c.id).toBe(bulk);
    });
    expect(slots.has(0)).toBe(true);
  });

  it("keeps rings and fillers off every chunk's ground (C2: no towers inside the districts)", () => {
    for (let i = 0; i < plan.world.vertexCount; i++) {
      if (plan.world.uvs2[i * 2 + 1] !== 0) continue;
      const x = plan.world.positions[i * 3]!;
      const z = plan.world.positions[i * 3 + 2]!;
      for (const c of WORLD_CHUNKS) {
        const inside = x > c.bounds.minX + 0.5 && x < c.bounds.maxX - 0.5 && z > c.bounds.minZ + 0.5 && z < c.bounds.maxZ - 0.5;
        expect(inside, `${x}, ${z} in ${c.id}`).toBe(false);
      }
    }
    // The rings reach well beyond the map.
    let far = 0;
    for (let i = 0; i < plan.world.vertexCount; i++) {
      const x = plan.world.positions[i * 3]!;
      const z = plan.world.positions[i * 3 + 2]!;
      if (x < B.minX - 90 || x > B.maxX + 90 || z < B.minZ - 90 || z > B.maxZ + 90) far++;
    }
    expect(far).toBeGreaterThan(100);
  });

  it("puts megabuildings on the horizon within the camera's reach, with ads and beacons", () => {
    let maxH = 0;
    for (let i = 0; i < plan.horizon.vertexCount; i++) {
      const d = Math.hypot(plan.horizon.positions[i * 3]!, plan.horizon.positions[i * 3 + 2]!);
      expect(d).toBeLessThan(320);
      expect(d).toBeGreaterThan(150);
      maxH = Math.max(maxH, plan.horizon.positions[i * 3 + 1]!);
    }
    expect(maxH).toBeGreaterThan(180);
    const kinds = new Set<number>();
    for (let i = 0; i < plan.horizonLights.vertexCount; i++) kinds.add(plan.horizonLights.uvs2[i * 2 + 1]!);
    expect(kinds.has(0)).toBe(true);
    expect(kinds.has(2)).toBe(true);
  });

  it("is deterministic", () => {
    expect(planFarCity(WORLD_CHUNKS).world.positions).toEqual(plan.world.positions);
  });

  it("draws four meshes, hides stand-ins of resident chunks and follows the camera with the horizon", () => {
    const scene = new Scene(new NullEngine());
    const far = new FarCity(scene, NIGHT_RIG);
    expect(far.meshes.map((m) => m.name).sort()).toEqual(["far-horizon", "far-horizon-lights", "far-world", "far-world-lights"]);
    far.setResident(new Set(["shinsekai-7"]));
    far.setDaylight(NIGHT_RIG, 0.5);
    far.update(0.1, { x: 40, y: 2, z: 90 }, false);
    const horizon = scene.getMeshByName("far-horizon")!;
    expect(horizon.position.x).toBe(40);
    expect(horizon.position.z).toBe(90);
    expect(scene.getMeshByName("far-world")!.position.x).toBe(0);
  });
});
