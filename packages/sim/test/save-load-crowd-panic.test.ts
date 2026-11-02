import { describe, expect, it } from "vitest";
import { type DomainEvents, type SaveSnapshot, WITNESS_CALL_SECONDS } from "@seki/core";
import { SIM_HZ, Simulation, TAKEDOWN_TIME, ground, stateHash, type Entity } from "../src";
import { byKey, collect, input, run, streetSim, teleportPlayer } from "./helpers";
import { enterKanal } from "./micro-scenes";
import { CROUCH, offset, quietStreet, stallholder, takeDown, ticks, victim } from "./takedown-scenes";

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
      const scared = sim.world.with("civilian").entities.filter((c) => (c.civilian.crowd?.state ?? "calm") !== "calm").map((c) => c.id);
      expect(afraid(sim)).toContain("hideo");
      const reacted = collect<DomainEvents["CrowdReacted"]>(sim, "CrowdReacted");
      sim.calmForSave();
      // The renderer and the sound hear that it calmed down.
      expect([...reacted].sort((a, b) => a.entityId - b.entityId)).toEqual(scared.sort((a, b) => a - b).map((entityId) => ({ entityId, state: "calm" })));
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

  /** A guard knocked out in front of a bystander (ADR-0065): it starts a call to the security. */
  const witnessed = () => {
    const sim = quietStreet();
    victim(sim);
    const w = stallholder(sim, 4300, offset(sim, -2, 0));
    const reports = collect<DomainEvents["CrimeReported"]>(sim, "CrimeReported");
    takeDown(sim);
    expect(w.civilian!.crowd?.call).toBeTruthy();
    expect(reports).toEqual([]);
    return { sim, w, reports };
  };
  const brief = (r: DomainEvents["CrimeReported"]) => [r.crime, r.channel, r.witnessId];

  it("a witness's call goes through at the save, as at its end without one, in both games", () => {
    const plain = witnessed();
    run(plain.sim, ticks(WITNESS_CALL_SECONDS + 1), CROUCH);
    expect(plain.reports.map(brief)).toEqual([["assault", "civilian", plain.w.id]]);
    const saved = witnessed();
    saved.sim.calmForSave();
    expect(saved.reports.map(brief)).toEqual(plain.reports.map(brief));
    expect(saved.sim.domain.heat.level).toBe(plain.sim.domain.heat.level);
    expect(saved.sim.domain.heat.faction).toBe(plain.sim.domain.heat.faction);
    // The call is made once: nothing more comes of it.
    const again = collect(saved.sim, "CrimeReported");
    run(saved.sim, ticks(WITNESS_CALL_SECONDS + 1), CROUCH);
    expect(again).toEqual([]);
  });

  it("a shot in front of babcia Ume, saved mid-call: reported in both games, which go on the same", () => {
    for (const seed of [5, 9]) {
      const sim = streetSim({ seed });
      sim.player()!.health = { current: 1e6, max: 1e6 };
      const ume = byKey(sim, "ume")!;
      teleportPlayer(sim, ground(ume.position.x + 9, ume.position.z), -Math.PI / 2);
      sim.step();
      sim.player()!.pitch = -0.6;
      sim.step(input({ fire: true }));
      run(sim, SIM_HZ);
      expect(ume.civilian?.crowd?.call).toBeTruthy();
      const reports = collect<DomainEvents["CrimeReported"]>(sim, "CrimeReported");
      sim.calmForSave();
      expect(reports.map(brief)).toEqual([["gunfire", "civilian", ume.id]]);
      const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
      expect(loaded.domain.heat).toEqual(sim.domain.heat);
      for (let i = 0; i < 2 * WITNESS_CALL_SECONDS * SIM_HZ; i++) {
        sim.step();
        loaded.step();
        expect(hash(loaded), `seed ${seed}, step ${i}`).toBe(hash(sim));
      }
      expect(reports).toHaveLength(1);
    }
  });

  it("a witness held in a takedown has its call go through at the save; one knocked out has none (G-141)", () => {
    for (const out of [false, true]) {
      const { sim, w, reports } = witnessed();
      teleportPlayer(sim, { ...w.position, x: w.position.x + 0.8 }, Math.PI / 2);
      sim.step(CROUCH);
      sim.enqueue({ type: "takedown", lethal: false });
      run(sim, ticks(out ? TAKEDOWN_TIME + 0.5 : TAKEDOWN_TIME / 2), CROUCH);
      expect(!!w.unconscious).toBe(out);
      sim.calmForSave();
      expect(reports.map(brief)).toEqual(out ? [] : [["assault", "civilian", w.id]]);
    }
  });
});
