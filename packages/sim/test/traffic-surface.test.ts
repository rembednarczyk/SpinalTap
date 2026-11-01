import { describe, expect, it } from "vitest";
import { hm } from "@seki/core";
import { Simulation, ground } from "../src";
import { surfaceLiftAt } from "../src/content/lublin/roads";
import { bridgeDeckAt } from "../src/content/lublin/decks";
import { groundY } from "../src/content/lublin/terrain";
import { run, teleportPlayer } from "./helpers";

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
