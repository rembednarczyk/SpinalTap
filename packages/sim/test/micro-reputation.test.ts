import { describe, expect, it } from "vitest";
import { MICRO_EVENT_CHANCE, MICRO_EVENT_CHANCE_DISTRUSTED, MICRO_EVENT_REWARD, type SaveSnapshot } from "@seki/core";
import { Simulation } from "../src";
import { input, run, teleportPlayer } from "./helpers";
import { type RollBand, enterKanal, street, walkIntoKanal } from "./micro-scenes";

/**
 * ADR-0070, stage 5: while the street thinks badly of the player (civilians below −10) a
 * micro-event starts on 25% of district entries instead of 12%, and an aid thanks with +3.
 */

/** Rolls that start one only while the street thinks badly of the player. */
const DISTRUST: RollBand = { from: MICRO_EVENT_CHANCE, below: MICRO_EVENT_CHANCE_DISTRUSTED };

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;

describe("micro-events while the street thinks badly of the player (ADR-0070)", () => {
  it.each([-11, -30, -60])("a roll between 0.12 and 0.25 starts one at %i", (civilians) => {
    const { sim, started } = enterKanal("mugging", 13, civilians, DISTRUST);
    expect(started).toEqual([{ encounterId: expect.stringMatching(/^micro:mugging:/), knot: "", npcId: expect.any(Number) }]);
    expect(sim.session.street2.micro?.attackers).toHaveLength(2);
  });

  it.each([-10, 0, 30])("the same roll starts nothing at %i", (civilians) => {
    const { sim, started } = enterKanal("mugging", 13, civilians, DISTRUST);
    expect(started).toEqual([]);
    expect(sim.session.street2.micro).toBeNull();
  });

  it("another seed, an aid: the same band starts it only below −10", () => {
    const low = enterKanal("aid", 21, -30, DISTRUST);
    const even = enterKanal("aid", 21, 0, DISTRUST);
    expect(low.started.map((e) => e.encounterId)).toEqual([expect.stringMatching(/^micro:aid:/)]);
    expect(even.started).toEqual([]);
  });

  it("a roll at 25% or above starts nothing even at −60", () => {
    const { started } = enterKanal("mugging", 13, -60, { from: MICRO_EVENT_CHANCE_DISTRUSTED, below: 1 });
    expect(started).toEqual([]);
  });

  it("the standing comes from the save: saved and loaded at −30, the band starts one", () => {
    const saved = street(21, 13, -30);
    const loaded = Simulation.fromSnapshot(roundTrip(saved.snapshot(null, "t", "")));
    const { started } = walkIntoKanal(loaded, "mugging", DISTRUST);
    expect(started.map((e) => e.encounterId)).toEqual([expect.stringMatching(/^micro:mugging:/)]);
  });

  it("an aid thanks with +3 and 25 eddies", () => {
    const { sim, ended } = enterKanal("aid", 13, -30, DISTRUST);
    const victim = [...sim.world].find((e) => e.id === sim.session.street2.micro!.victim)!;
    teleportPlayer(sim, { x: victim.position.x + 1, y: victim.position.y, z: victim.position.z });
    run(sim, 1);
    const [eddies, civ] = [sim.domain.wallet.eddies, sim.domain.reputation.civilians];
    sim.step(input({ interact: true }));
    expect(ended.map((e) => e.outcome)).toEqual(["helped"]);
    expect([sim.domain.wallet.eddies - eddies, sim.domain.reputation.civilians - civ]).toEqual([25, 3]);
  });

  it("a mugging beaten in a fight at −30: +3 from the street, the muggers do not count on their own", () => {
    const { sim, ended } = enterKanal("mugging", 13, -30, DISTRUST);
    const run0 = sim.session.street2.micro!;
    const player = sim.player()!.id;
    const civ = sim.domain.reputation.civilians;
    for (const e of [...sim.world]) {
      if (!run0.attackers.includes(e.id)) continue;
      e.ai!.alerted = true;
      e.lastHitBy = player;
      e.health = { current: 0, max: e.health!.max };
    }
    run(sim, 2);
    expect(ended.map((e) => e.outcome)).toEqual(["won"]);
    expect(sim.domain.reputation.civilians - civ).toBe(MICRO_EVENT_REWARD.mugging.civilians);
  });
});
