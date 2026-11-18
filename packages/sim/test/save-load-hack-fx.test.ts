import { describe, expect, it } from "vitest";
import type { SaveSnapshot } from "@seki/core";
import { SIM_HZ, Simulation, spotNear, stateHash } from "../src";
import { byKey, run, teleportPlayer } from "./helpers";

/*
 * G-420: a hack's effects on an enemy (blinded, crippled, pinged) go into the save. Loaded
 * mid-fight, the hacked guard is as it was, and the game runs on as it would have without the
 * load (the hash of both runs is the same).
 */

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));

describe("G-420: hack effects in the save", () => {
  it("a guard blinded, crippled and pinged stays so after a load, and the run goes on the same", () => {
    const sim = Simulation.create({ seed: 7 });
    sim.step();
    const g = byKey(sim, "guard")!;
    expect(g.enemy).toBeDefined();
    teleportPlayer(sim, spotNear(g.position.x + 3, g.position.z + 3), 0);
    run(sim, SIM_HZ);
    // As a quickhack puts it on (`hackFxOf`): a component the hack system counts down.
    sim.world.addComponent(g, "hackFx", { pinged: 12, blind: 20, crippled: 15 });
    run(sim, SIM_HZ);
    const before = { ...g.hackFx };
    const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
    const twin = byKey(loaded, "guard");
    expect(twin).toBeDefined();
    expect(twin!.hackFx).toEqual(before);
    run(sim, 3 * SIM_HZ);
    run(loaded, 3 * SIM_HZ);
    expect(twin!.hackFx).toEqual(g.hackFx);
    expect(hash(loaded)).toBe(hash(sim));
  });
});
