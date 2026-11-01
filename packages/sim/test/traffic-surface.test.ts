import { describe, expect, it } from "vitest";
import { hm } from "@seki/core";
import { Simulation, ground } from "../src";
import { surfaceLiftAt } from "../src/content/lublin/roads";
import { bridgeDeckAt } from "../src/content/lublin/decks";
import { groundY } from "../src/content/lublin/terrain";
import { MAP_CHUNKS } from "../src/content/lublin/sites";
import { TRAFFIC_LANES, pointAt } from "../src/content/traffic";
import { WORLD_CHUNKS } from "../src/content/world-map";
import { GroundField } from "../src/world/ground";
import { run, teleportPlayer } from "./helpers";

/** The ground the simulation walks (ADR-0043). */
const FIELD = new GroundField(WORLD_CHUNKS);

/** The top of what the renderer draws at (x, z): the ground and the highest paving of its level there (a bridge's deck or the terrain). */
const drawn = (x: number, z: number) => {
  const y = groundY(x, z);
  return y + surfaceLiftAt(x, z, bridgeDeckAt(x, z) === y);
};

const vehicleYs = (sim: Simulation) => [...sim.world].filter((e) => e.vehicle !== undefined).map((e) => ({ id: e.id, ...e.position }));

describe("the traffic on the drawn carriageway (G-130)", () => {
  it("drives every vehicle on the carriageway the renderer draws, not 10 cm into it, from its spawn on", () => {
    const sim = Simulation.create({ seed: 3, crowd: "high" });
    const now = Math.floor((sim.clock.seconds % 86400) / 60);
    sim.enqueue({ type: "wait", minutes: (hm(8) - now + 1440) % 1440 });
    sim.step();
    teleportPlayer(sim, ground(820, 352), Math.PI / 2);
    run(sim, 2);
    const fresh = vehicleYs(sim);
    run(sim, 240);
    const driven = vehicleYs(sim);
    expect(fresh.length).toBeGreaterThan(8);
    for (const v of [...fresh, ...driven]) expect(v.y, `vehicle ${v.id} at ${v.x.toFixed(1)},${v.z.toFixed(1)}`).toBeCloseTo(drawn(v.x, v.z), 3);
  });
});

describe("the lanes on the map (G-138)", () => {
  it("keeps every lane inside the map, off its edge, where the simulation's ground and the map's agree", () => {
    const off = TRAFFIC_LANES.flatMap((r) => {
      const out: string[] = [];
      for (let s = 0; s <= r.length; s += 0.25) {
        const p = pointAt(r.points, s);
        // On a chunk 5 cm round about: a seam between two chunks is inside the map, its edge is not.
        const inside = [-0.05, 0.05].every((a) => [-0.05, 0.05].every((c) => MAP_CHUNKS.some(({ bounds: b }) => p.x + a >= b.minX && p.x + a <= b.maxX && p.z + c >= b.minZ && p.z + c <= b.maxZ)));
        if (!inside || groundY(p.x, p.z) !== FIELD.heightAt(p.x, p.z)) out.push(`${r.id} at ${s} (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`);
      }
      return out;
    });
    expect(off).toEqual([]);
  });
});
