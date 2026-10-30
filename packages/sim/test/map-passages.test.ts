import { describe, expect, it } from "vitest";
import { Simulation, ground } from "../src";
import { PASSAGES } from "../src/content/lublin/sites";
import { input, run, teleportPlayer } from "./helpers";

/** The covered lanes of the Old Town the map draws under its houses (ADR-0048). */
const LANES = [
  ["Rybna", "w66293430"],
  ["Ku Farze", "w66293395"],
] as const;

describe("passages through the map's buildings (ADR-0048)", () => {
  it("come from the map's gateways too, the gates' own buildings left to the hand-made ones", () => {
    expect(PASSAGES.length).toBeGreaterThan(15);
    expect(PASSAGES.filter((p) => p.building === "w232362876")).toHaveLength(1);
    for (const [, building] of LANES) expect(PASSAGES.some((p) => p.building === building)).toBe(true);
  });

  it.each(LANES)("%s runs on under its house: the player walks through", (_, building) => {
    const p = PASSAGES.find((x) => x.building === building)!;
    const sim = Simulation.create({ seed: 1 });
    const start = ground(p.from.x, p.from.z);
    teleportPlayer(sim, start, Math.atan2(p.to.x - p.from.x, p.to.z - p.from.z));
    run(sim, 2);
    for (const g of [...sim.world.with("ai")]) sim.world.remove(g);
    const len = Math.hypot(p.to.x - p.from.x, p.to.z - p.from.z);
    for (let i = 0; i < 5 * 60; i++) sim.step(input({ moveZ: 1 }));
    const at = sim.player()!.position;
    // Past the far facade, on the passage's line.
    expect(((at.x - p.from.x) * (p.to.x - p.from.x) + (at.z - p.from.z) * (p.to.z - p.from.z)) / len).toBeGreaterThan(len - 0.5);
  });
});
