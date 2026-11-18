import { describe, expect, it } from "vitest";
import { type EnemyTypeId, angleTo } from "@seki/core";
import { SIM_DT, Simulation, gangerEntity, w3, type Entity } from "../src";
import { chestOf, eyeOf, lineOfSight } from "../src/world/hitscan";
import { giveLead } from "../src/systems/ai/ganger-perception";
import { input, run, teleportPlayer } from "./helpers";
import { CROUCH, emptySquare, enemyAt, secondsToAlarm } from "./stealth-scenes";

/*
 * Stage 3 of ADR-0069, the balance of sight and hearing: a lead heard through a wall follows her
 * step by step, an enemy walks to a lead facing the way it goes, and a sprint in front of a
 * trained enemy takes as long to be seen as it did before the steps were heard.
 */

const SPRINT = input({ moveZ: 1, sprint: true });

/** How far off its facing a point is, rad. */
const offFacing = (g: Entity, x: number, z: number): number => Math.abs(angleTo({ x: g.position.x, z: g.position.z, yaw: g.yaw }, x, z));

/** W-3's pickup yard (seed 7, ADR-0082): the player south of the container facing east, a Hebi ganger behind it by the basin, looking away. */
const containerYard = (): { sim: Simulation; g: Entity } => {
  const sim = Simulation.create({ seed: 7 });
  const at = w3(2526.5, 0, 444.4);
  teleportPlayer(sim, at, Math.PI / 2);
  sim.step();
  teleportPlayer(sim, at, Math.PI / 2);
  for (const e of [...sim.world.with("ai")]) sim.world.remove(e);
  for (const d of [...sim.world.with("device")]) sim.world.remove(d);
  const where = w3(2530, 0, 449.6);
  const g = sim.world.add(gangerEntity(9600, { key: "yard", position: where, yaw: 0 }, null, 1e6, sim.streamer.chunkIdAt(where), undefined, "hebi_ganger"));
  return { sim, g };
};

describe("a lead heard through a wall (ADR-0069, stage 3)", () => {
  it("follows every step she is heard sprinting behind the container, not only the first", () => {
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
    // Turning round, then its meter filling some 8 m off (ADR-0069, 18.11: 1.5 s close by and slower farther).
    expect(secondsToAlarm(sim, g)).toBeLessThan(2.5);
  });
});

describe("sight of a sprint in front (ADR-0069, stage 3)", () => {
  const trained: readonly EnemyTypeId[] = ["kagami_cleaner", "tessen_guard"];
  for (const type of trained) {
    it(`${type}: sees her sprint at it from 10 m in 1.9 to 2.6 s, the noise of a sprint it sees adding nothing`, () => {
      const sim = emptySquare(false);
      const g = enemyAt(sim, type, 10, true);
      const s = secondsToAlarm(sim, g, SPRINT);
      expect(s).not.toBeNull();
      // The meter of ADR-0069 after 18.11, filling faster as she closes in (2.1 s and 2.3 s).
      expect(s!).toBeGreaterThanOrEqual(1.9);
      expect(s!).toBeLessThanOrEqual(2.6);
    });
  }

  for (const type of ["hebi_ganger", "kagami_cleaner"] as const) {
    it(`${type}: a sprint it sees still gives it a lead, so crouching just out of its crouched sight does not lose it`, () => {
      const sim = emptySquare(false);
      const p = sim.player()!;
      p.yaw = Math.PI / 2;
      p.prevYaw = p.yaw;
      // 8.8 m is past its sight of a crouching player (17 × 0.5 = 8.5 m).
      const g = enemyAt(sim, type, 8.8, true);
      run(sim, Math.round(0.25 / SIM_DT), SPRINT);
      expect(g.ai!.alerted).toBe(false);
      expect(g.ai!.lastKnown).toBeTruthy();
      expect(secondsToAlarm(sim, g, CROUCH)).not.toBeNull();
    });
  }
});
