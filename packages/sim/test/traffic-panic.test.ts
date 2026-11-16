import { describe, expect, it } from "vitest";
import { type DomainEvents, type SaveSnapshot, hm } from "@seki/core";
import { type CrowdDensity, Simulation, ground, stateHash } from "../src";
import { collect, input, teleportPlayer } from "./helpers";

/**
 * The crowd (ADR-0041) and the traffic (ADR-0050) are never saved, so they change no outcome:
 * also while shots on the deptak make a car panic (stop or flee) and the residents run, and
 * across a save made in the middle of it. `traffic.test.ts` checks the same on a walk only.
 * On the deptak by Krakowskie Przedmieście the player stands off the carriageway: a car the
 * player walks into does change the outcome (it is solid), as it would on Aleja Tysiąclecia.
 */
const DEPTAK = ground(90, -30);
/** Fire while strafing, a reload at the end of each round: 17 shots in 480 steps. */
const STEPS = 480;
const fire = (i: number) => input({ reload: i % 160 === 150, fire: i % 160 < 140, moveX: i % 120 < 60 ? 1 : -1, lookYaw: i % 90 < 45 ? -0.004 : 0.004 });
/**
 * The save: mid-fight, 2 s in, a car still in its panic (5-6 s from the shot near it) and the
 * residents running. Not during the reload (steps 150-200): the player's reload in progress is not
 * saved, so a save then goes on otherwise with no crowd and no traffic as well (G-883, the todo below).
 */
const SAVE_AT = 120;

const hashOf = (sim: Simulation) => stateHash(sim.snapshot(null, "test", ""));
const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;

/** A morning on the deptak (8:00, the traffic on its timetable), the player off the carriageway. */
const deptak = (crowd: CrowdDensity): Simulation => {
  const sim = Simulation.create({ seed: 1234, crowd });
  const now = Math.floor((sim.clock.seconds % 86400) / 60);
  sim.enqueue({ type: "wait", minutes: (hm(8) - now + 1440) % 1440 });
  sim.step();
  teleportPlayer(sim, DEPTAK, Math.PI / 2);
  return sim;
};

/** Steps `from..to` of the fight; the most cars in a panic at once. */
const shoot = (sim: Simulation, from: number, to: number): number => {
  let panic = 0;
  for (let i = from; i < to; i++) {
    sim.step(fire(i));
    panic = Math.max(panic, [...sim.world].filter((e) => e.vehicle?.panic).length);
  }
  return panic;
};

/** The whole fight, saved (calmed, through JSON) and loaded at `SAVE_AT`; the loaded game goes on. */
const savedMidFight = (crowd: CrowdDensity) => {
  const sim = deptak(crowd);
  shoot(sim, 0, SAVE_AT);
  const panicAtSave = [...sim.world].filter((e) => e.vehicle?.panic).length;
  const afraidAtSave = sim.world.with("civilian").entities.filter((c) => c.view?.kind === "crowd" && (c.civilian.crowd?.state ?? "calm") !== "calm").length;
  sim.calmForSave();
  const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "mid", "")), undefined, crowd);
  expect(hashOf(loaded)).toBe(hashOf(sim));
  shoot(sim, SAVE_AT, STEPS);
  shoot(loaded, SAVE_AT, STEPS);
  return { sim, loaded, panicAtSave, afraidAtSave };
};

describe("the crowd and the traffic in a panic (ADR-0041, ADR-0050)", () => {
  let quiet: string | undefined;
  const quietRun = (): string => {
    if (quiet === undefined) {
      const sim = deptak("off");
      shoot(sim, 0, STEPS);
      quiet = hashOf(sim);
    }
    return quiet;
  };
  let quietSaved: string | undefined;
  const quietSavedRun = (): string => (quietSaved ??= hashOf(savedMidFight("off").loaded));

  for (const crowd of ["low", "high"] as const) {
    it(`shots that make the cars and the crowd panic leave the run as without them, at density ${crowd}`, () => {
      const sim = deptak(crowd);
      const reacted = collect<DomainEvents["CrowdReacted"]>(sim, "CrowdReacted");
      const panic = shoot(sim, 0, STEPS);
      expect(panic).toBeGreaterThan(0);
      const residents = new Set([...sim.world].filter((e) => e.view?.kind === "crowd").map((e) => e.id));
      expect(reacted.some((r) => residents.has(r.entityId) && r.state !== "calm")).toBe(true);
      expect(hashOf(sim)).toBe(quietRun());
    });

    it(`saved and loaded mid-panic, the game goes on as the one saved from and as without them, at density ${crowd}`, () => {
      const { sim, loaded, panicAtSave, afraidAtSave } = savedMidFight(crowd);
      expect(panicAtSave).toBeGreaterThan(0);
      expect(afraidAtSave).toBeGreaterThan(0);
      expect(hashOf(loaded)).toBe(hashOf(sim));
      expect(hashOf(loaded)).toBe(quietSavedRun());
    });
  }

  // G-883: saved at step 200, 50 steps into the player's reload, the loaded game fires at once (the
  // reload in progress is not in the player's save, `factory.ts` keeps it for NPCs only) and the
  // fight goes on otherwise, with no crowd and no traffic too. Make it a test once G-883 is fixed:
  // the same as the case above with the save at step 200.
  it.todo("saved and loaded mid-reload in the panic, the game goes on as the one saved from (G-883)");
});
