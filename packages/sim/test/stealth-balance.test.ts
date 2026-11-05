import { describe, expect, it } from "vitest";
import { angleTo } from "@seki/core";
import { SIM_DT, Simulation, docks, gangerEntity, type Entity } from "../src";
import { chestOf, eyeOf, lineOfSight } from "../src/world/hitscan";
import { giveLead } from "../src/systems/ai/ganger-perception";
import { input, run, teleportPlayer } from "./helpers";
import { emptySquare, enemyAt, secondsToAlarm } from "./stealth-scenes";

/*
 * Stage 3 of ADR-0069, the balance of sight and hearing: a lead heard through a wall follows her
 * step by step, an enemy walks to a lead facing the way it goes, and a sprint in front of a
 * trained enemy takes as long to be seen as it did before the steps were heard.
 */

const SPRINT = input({ moveZ: 1, sprint: true });

/** How far off its facing a point is, rad. */
const offFacing = (g: Entity, x: number, z: number): number => Math.abs(angleTo({ x: g.position.x, z: g.position.z, yaw: g.yaw }, x, z));

/** The docks yard (seed 7): the player in the north aisle facing east, a Hebi ganger south of the first row of containers. */
const containerYard = (): { sim: Simulation; g: Entity } => {
  const sim = Simulation.create({ seed: 7 });
  const at = docks(-6, 0, 113.5);
  teleportPlayer(sim, at, Math.PI / 2);
  sim.step();
  teleportPlayer(sim, at, Math.PI / 2);
  for (const e of [...sim.world.with("ai")]) sim.world.remove(e);
  for (const d of [...sim.world.with("device")]) sim.world.remove(d);
  const where = docks(-2, 0, 108);
  const g = sim.world.add(gangerEntity(9600, { key: "yard", position: where, yaw: Math.PI }, null, 1e6, sim.streamer.chunkIdAt(where), undefined, "hebi_ganger"));
  return { sim, g };
};

describe("a lead heard through a wall (ADR-0069, stage 3)", () => {
  it("follows every step she is heard sprinting behind the containers, not only the first", () => {
    const { sim, g } = containerYard();
    const p = sim.player()!;
    let heardUnseen = 0;
    for (let i = 0; i < 40; i++) {
      sim.step(SPRINT);
      if (lineOfSight(sim.world, eyeOf(g), chestOf(p))) continue;
      heardUnseen++;
      const lead = g.ai!.lastKnown!;
      expect(Math.hypot(lead.x - p.position.x, lead.z - p.position.z)).toBeLessThan(0.25);
    }
    expect(heardUnseen).toBeGreaterThan(20);
    expect(g.ai!.alerted).toBe(false);
  });
});

describe("walking to a lead (ADR-0069, stage 3)", () => {
  it("turns to the lead it walks to instead of walking there backwards", () => {
    const sim = emptySquare(false);
    const g = enemyAt(sim, "hebi_ganger", 6);
    g.hackFx = { pinged: 0, blind: 1e6, crippled: 0 };
    const lead = { x: g.position.x + 10, y: g.position.y, z: g.position.z - 2 };
    giveLead(g, lead);
    run(sim, Math.ceil(0.5 / SIM_DT));
    expect(Math.hypot(g.velocity!.x, g.velocity!.z)).toBeGreaterThan(1);
    expect(offFacing(g, lead.x, lead.z)).toBeLessThan(0.3);
  });

  it("heard sprinting behind it, it turns round on its way and sees her", () => {
    const sim = emptySquare(false);
    const g = enemyAt(sim, "hebi_ganger", 8);
    run(sim, 3, SPRINT);
    expect(g.ai!.lastKnown).toBeTruthy();
    expect(secondsToAlarm(sim, g)).toBeLessThan(1.5);
  });
});
