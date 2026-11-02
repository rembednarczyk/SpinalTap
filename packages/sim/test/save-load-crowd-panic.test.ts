import { describe, expect, it } from "vitest";
import type { SaveSnapshot } from "@seki/core";
import { SIM_HZ, Simulation, stateHash, type Entity } from "../src";
import { teleportPlayer } from "./helpers";
import { enterKanal } from "./micro-scenes";
import { CROUCH, takeDown } from "./takedown-scenes";

/**
 * A save while the street panics after a fight (G-240). The crowd's fear is transient (ADR-0029):
 * a loaded game starts calm, so the game saved from calms down with the save, and from then on
 * both go on the same, step by step.
 */

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;
const hash = (sim: Simulation) => stateHash(sim.snapshot(null, "t", ""));
/** Longer than the longest fright (cowering, then running): 12 s. */
const AFTER = 15 * SIM_HZ;

const afraid = (sim: Simulation) =>
  sim.world.with("civilian").entities.filter((c) => (c.civilian.crowd?.state ?? "calm") !== "calm").map((c) => c.key ?? `#${c.id}`);

/** The mugging by Brama Krakowska won by a takedown and a shot: the street runs from it. */
const panic = (seed: number): Simulation => {
  const { sim } = enterKanal("mugging", seed);
  const run0 = sim.session.street2.micro!;
  const [m0, m1] = run0.attackers;
  const a = [...sim.world].find((e) => e.id === m0)!;
  for (const e of [...sim.world] as Entity[]) if (run0.attackers.includes(e.id)) e.hackFx = { pinged: 0, blind: 100, crippled: 0 };
  const p = sim.player()!;
  p.posture = { ...p.posture!, crouched: true, amount: 1, prevAmount: 1 };
  teleportPlayer(sim, { x: a.position.x - Math.sin(a.yaw), y: a.position.y, z: a.position.z - Math.cos(a.yaw) }, a.yaw);
  takeDown(sim, true);
  for (const e of [...sim.world] as Entity[]) if (e.id === m1) e.health = { current: 0, max: 80 };
  sim.step(CROUCH);
  sim.step(CROUCH);
  expect(sim.session.street2.micro).toBeNull();
  return sim;
};

describe("a save while the street panics (G-240)", () => {
  for (const seed of [13, 7]) {
    it(`goes on the same after a load, step by step (seed ${seed})`, () => {
      const sim = panic(seed);
      // Hideo, saved by key, runs too.
      expect(afraid(sim)).toContain("hideo");
      sim.calmForSave();
      const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
      expect(hash(loaded)).toBe(hash(sim));
      for (let i = 0; i < AFTER; i++) {
        sim.step(CROUCH);
        loaded.step(CROUCH);
        expect(hash(loaded), `step ${i}`).toBe(hash(sim));
      }
    });
  }

  it("a calm street is left as it is", () => {
    const sim = panic(13);
    for (let i = 0; i < AFTER; i++) sim.step(CROUCH);
    expect(afraid(sim)).toEqual([]);
    const before = hash(sim);
    sim.calmForSave();
    expect(hash(sim)).toBe(before);
  });
});
