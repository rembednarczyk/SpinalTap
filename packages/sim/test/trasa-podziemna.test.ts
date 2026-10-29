import { describe, expect, it } from "vitest";
import { EMPTY_INPUT, type GroundPoint } from "@seki/core";
import { LOCH_SPOT, MAP_CHUNKS, Simulation, TRASA_PODZIEMNA, TRASA_PODZIEMNA_STASH, TRASA_PODZIEMNA_WALK, WORLD_CHUNKS, WORLD_SCENERY, groundY, rawHeight } from "../src";
import { teleportPlayer } from "./helpers";

/**
 * Trasa Podziemna under the Rynek (ADR-0048): in through the Trybunał's door, down the stairs,
 * along two corridors into the loch; the terrain dug out under it stays inside the Trybunał.
 */

const TRYBUNAL = MAP_CHUNKS.flatMap((c) => c.buildings).find((b) => b.id === TRASA_PODZIEMNA.building)!;
const outline: GroundPoint[] = [];
for (let i = 0; i < TRYBUNAL.outline.length; i += 2) outline.push({ x: TRYBUNAL.outline[i]! + TRYBUNAL.x, z: TRYBUNAL.outline[i + 1]! + TRYBUNAL.z });

/** Sprints to (x, z), turning towards it every step; the distance left when it stopped. */
const walkTo = (sim: Simulation, x: number, z: number): number => {
  for (let i = 0; i < 900; i++) {
    const p = sim.player()!;
    const d = Math.hypot(x - p.position.x, z - p.position.z);
    if (d < 0.5) return d;
    const want = Math.atan2(x - p.position.x, z - p.position.z);
    sim.step({ ...EMPTY_INPUT, moveZ: 1, lookYaw: Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw)) });
  }
  const p = sim.player()!;
  return Math.hypot(x - p.position.x, z - p.position.z);
};

describe("Trasa Podziemna (ADR-0048)", () => {
  it("starts where the real one does, in the Trybunał Koronny on the Rynek", () => {
    expect(TRYBUNAL.name).toBe("Trybunał Koronny");
    const view = WORLD_SCENERY.find((s) => s.view.kind === "building" && s.view.name === "Trybunał Koronny")?.view;
    expect(view?.kind === "building" && view.passages?.length).toBe(1);
    expect(view?.kind === "building" && view.doorways?.length).toBe(1);
  });

  it("digs the terrain out under the Trybunał: the Rynek round it keeps its ground but for a dip at one wall", () => {
    const worst = [0, 0];
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i]!;
      const b = outline[(i + 1) % outline.length]!;
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const nx = (b.z - a.z) / len;
      const nz = -(b.x - a.x) / len;
      for (let t = 0; t <= 1; t += 0.05) {
        for (const out of [0, 0.5, 2]) {
          const x = a.x + (b.x - a.x) * t + nx * out;
          const z = a.z + (b.z - a.z) * t + nz * out;
          const k = out < 1 ? 0 : 1;
          worst[k] = Math.max(worst[k]!, Math.abs(groundY(x, z) - rawHeight(x, z)));
        }
      }
    }
    // The 5 m cells round the dug-out ones slope down to it: at the foot of the north-east wall
    // the cobbles dip by under 40 cm (the walls reach below that), two metres out by under 15.
    expect(worst[0]).toBeLessThan(0.4);
    expect(worst[1]).toBeLessThan(0.15);
    // Under the cellars it is below their floor.
    expect(groundY(LOCH_SPOT.x, LOCH_SPOT.z)).toBeLessThan(TRASA_PODZIEMNA.floor);
  });

  it("is walked in from the Rynek: the door, the stairs down, the corridors and the loch, where a bag waits", () => {
    const sim = Simulation.create({ seed: 2 });
    const [x0, z0] = TRASA_PODZIEMNA_WALK[0]!;
    teleportPlayer(sim, { x: x0, y: groundY(x0, z0), z: z0 }, Math.PI / 2);
    sim.step();
    expect(sim.district).toBe("kanal");
    for (const [x, z] of TRASA_PODZIEMNA_WALK.slice(1)) expect(walkTo(sim, x, z), `${x}, ${z}`).toBeLessThan(0.5);
    const p = sim.player()!;
    expect(p.position.y).toBeCloseTo(TRASA_PODZIEMNA.floor, 1);
    expect(sim.domain.flags).toContain(`placed:${TRASA_PODZIEMNA_STASH.key}`);
    const bag = sim.domain.loot.containers.find((c) => c.key === TRASA_PODZIEMNA_STASH.key);
    expect(bag?.position.y).toBeCloseTo(TRASA_PODZIEMNA.floor, 6);
    // The way back up comes out on the Rynek again.
    for (const [x, z] of [...TRASA_PODZIEMNA_WALK].reverse().slice(1)) expect(walkTo(sim, x, z), `${x}, ${z}`).toBeLessThan(0.5);
    expect(sim.player()!.position.y).toBeCloseTo(groundY(x0, z0), 1);
  }, 60_000);

  it("keeps its shell inside the Trybunał's chunk, as interior blocks", () => {
    const chunk = WORLD_CHUNKS.find((c) => c.id === "stare-miasto-0-0")!;
    const shell = chunk.props.filter((p) => p.interior && p.center.y < TRASA_PODZIEMNA.door);
    expect(shell.length).toBeGreaterThan(10);
  });
});
