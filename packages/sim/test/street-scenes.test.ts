import { describe, expect, it } from "vitest";
import { MICRO_EVENT_CHANCE, MICRO_EVENT_REWARD, SECONDS_PER_HOUR, type SaveSnapshot } from "@seki/core";
import { Simulation, deriveRandom, ground } from "../src";
import { ALLEY_START, byKey, collect, input, run, teleportPlayer } from "./helpers";

/** Shiro's lamp on Plac Litewski and the salaryman's pavement by Neon Koi (ADR-0045). */
const POET = { x: 102, z: -23 };
const SALARYMAN = { x: 328, z: -91 };

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;

/** After the prologue (Kaito met), at `hour`. */
const street = (hour: number, seed = 6): Simulation => {
  const snap = Simulation.create({ seed }).snapshot(null, "t", "");
  const sim = Simulation.fromSnapshot({ ...snap, domain: { ...snap.domain, flags: ["met_fixer"], clock: { seconds: hour * SECONDS_PER_HOUR } } });
  run(sim, 1);
  return sim;
};

describe("street encounters (ADR-0034)", () => {
  it("the poet stands under his lamp in the evening and the scene starts up close", () => {
    const sim = street(21);
    const started = collect<{ encounterId: string; knot: string; npcId: number | null }>(sim, "EncounterStarted");
    const ended = collect<{ encounterId: string; outcome: string }>(sim, "EncounterEnded");
    teleportPlayer(sim, ground(POET.x, POET.z + 10));
    run(sim, 2);
    expect(started).toEqual([]);
    const poet = [...sim.world].find((e) => !e.key && e.view?.kind === "npc" && Math.hypot(e.position.x - POET.x, e.position.z - POET.z) < 0.5);
    expect(poet).toBeDefined();
    teleportPlayer(sim, ground(POET.x, POET.z + 3));
    run(sim, 1);
    expect(started).toEqual([{ encounterId: "s7_poet", knot: "enc_s7_poet", npcId: poet!.id }]);
    expect(sim.session.dialogueActive).toBe(true);
    expect(sim.domain.encounters.used).toEqual(["s7_poet"]);
    sim.enqueue({ type: "set-flag", flag: "enc_s7_poet_listened" });
    sim.enqueue({ type: "end-dialogue" });
    run(sim, 1);
    expect(ended).toEqual([{ encounterId: "s7_poet", outcome: "listened" }]);
    // Saved and loaded, it never plays again.
    const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
    const again = collect(loaded, "EncounterStarted");
    run(loaded, 30, input({ moveZ: -1 }));
    expect(again).toEqual([]);
    expect(loaded.domain.encounters.used).toEqual(["s7_poet"]);
  });

  it("waits for its hours, for the prologue, and an outcome with a reward pays once", () => {
    const early = street(12);
    teleportPlayer(early, ground(SALARYMAN.x, SALARYMAN.z + 2));
    const none = collect(early, "EncounterStarted");
    run(early, 2);
    expect(none).toEqual([]);
    const fresh = Simulation.create({ seed: 6 });
    teleportPlayer(fresh, ground(POET.x, POET.z + 2));
    run(fresh, 2);
    expect(fresh.session.street2.encounter).toBeNull();
    const night = street(2);
    teleportPlayer(night, ground(SALARYMAN.x, SALARYMAN.z + 2));
    run(night, 1);
    expect(night.session.street2.encounter).toBe("s7_salaryman");
    const eddies = night.domain.wallet.eddies;
    night.enqueue({ type: "set-flag", flag: "enc_s7_salaryman_robbed" });
    night.enqueue({ type: "end-dialogue" });
    run(night, 1);
    expect(night.domain.wallet.eddies).toBe(eddies + 60);
  });
});

/** The first tick from `from` whose micro-event roll starts one of `kind`. */
const tickFor = (seed: number, from: number, kind: "mugging" | "aid"): number => {
  for (let t = from; ; t++) {
    const r = deriveRandom(seed, `micro:${t}`);
    const roll = r.next();
    const mugging = r.next() < 0.6;
    if (roll < MICRO_EVENT_CHANCE && mugging === (kind === "mugging")) return t;
  }
};

/** Walks from Krakowskie through Brama Krakowska into the Old Town on the step whose roll starts `kind`. */
const enterKanal = (kind: "mugging" | "aid") => {
  const sim = street(21, 13);
  teleportPlayer(sim, ground(450, -96));
  run(sim, 2);
  const t = tickFor(sim.seed, sim.tick + 1, kind);
  while (sim.tick < t) sim.step();
  const started = collect<{ encounterId: string; npcId: number }>(sim, "EncounterStarted");
  const ended = collect<{ encounterId: string; outcome: string }>(sim, "EncounterEnded");
  teleportPlayer(sim, ground(497, -79));
  sim.step();
  return { sim, started, ended };
};

describe("micro-events (ADR-0034)", () => {
  it("a mugging on entering the district: down the gang, save the passer-by, get paid", () => {
    const { sim, started, ended } = enterKanal("mugging");
    expect(started).toEqual([{ encounterId: expect.stringMatching(/^micro:mugging:/), knot: "", npcId: expect.any(Number) }]);
    const run0 = sim.session.street2.micro!;
    expect(run0.attackers).toHaveLength(2);
    // Not in a save.
    expect(sim.snapshot(null, "t", "").entities.some((e) => e.key.startsWith("micro:"))).toBe(false);
    const eddies = sim.domain.wallet.eddies;
    const civ = sim.domain.reputation.civilians;
    for (const e of [...sim.world]) if (run0.attackers.includes(e.id)) e.health = { current: 0, max: 80 };
    run(sim, 2);
    expect(ended).toEqual([{ encounterId: run0.id, outcome: "won" }]);
    expect(sim.domain.wallet.eddies).toBeGreaterThanOrEqual(eddies + MICRO_EVENT_REWARD.mugging.eddies);
    // The thanks of the street, less what the kills themselves cost with the civilians.
    expect(sim.domain.reputation.civilians).toBeGreaterThan(civ);
    expect(sim.domain.flags.filter((f) => f.includes("micro:"))).toEqual([]);
  });

  it("an aid: help the passer-by with the interact key; walking away ends a mugging with nothing", () => {
    const { sim, ended } = enterKanal("aid");
    const victim = [...sim.world].find((e) => e.id === sim.session.street2.micro!.victim)!;
    teleportPlayer(sim, { x: victim.position.x + 1, y: victim.position.y, z: victim.position.z });
    run(sim, 1);
    sim.step(input({ interact: true }));
    expect(ended.map((e) => e.outcome)).toEqual(["helped"]);
    const mug = enterKanal("mugging");
    teleportPlayer(mug.sim, ALLEY_START);
    run(mug.sim, 2);
    expect(mug.ended.map((e) => e.outcome)).toEqual(["left"]);
    expect(byKey(mug.sim, `${mug.started[0]!.encounterId}:m0`)).toBeUndefined();
  });
});
