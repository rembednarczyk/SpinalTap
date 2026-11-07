import { describe, expect, it } from "vitest";
import { MICRO_EVENT_REWARD, type SaveSnapshot } from "@seki/core";
import { Simulation, ground } from "../src";
import { ALLEY_START, byKey, collect, input, run, teleportPlayer } from "./helpers";
import { enterKanal, street } from "./micro-scenes";
import { takeDown } from "./takedown-scenes";

/** Shiro's lamp on Plac Litewski and the salaryman's pavement by Neon Koi (ADR-0045). */
const POET = { x: 97, z: -23 };
const SALARYMAN = { x: 328, z: -91 };

const roundTrip = (s: SaveSnapshot): SaveSnapshot => JSON.parse(JSON.stringify(s)) as SaveSnapshot;

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
    // The thanks of the street: the muggers are the event's own, they do not count on their own (ADR-0070).
    expect(sim.domain.reputation.civilians).toBe(civ + MICRO_EVENT_REWARD.mugging.civilians);
    expect(sim.domain.flags.filter((f) => f.includes("micro:"))).toEqual([]);
  });

  it.each([false, true])("a mugger taken down (lethal: %s) counts as beaten: one payout, kept over a save (G-231)", (lethal) => {
    const { sim, ended } = enterKanal("mugging");
    const run0 = sim.session.street2.micro!;
    const [m0, m1] = run0.attackers;
    // One shot down, the other taken down from behind: its body stays in the world.
    for (const e of [...sim.world]) if (e.id === m1) e.health = { current: 0, max: 80 };
    sim.step();
    const a = [...sim.world].find((e) => e.id === m0)!;
    const p = sim.player()!;
    p.posture = { ...p.posture!, crouched: true, amount: 1, prevAmount: 1 };
    teleportPlayer(sim, { x: a.position.x - Math.sin(a.yaw), y: a.position.y, z: a.position.z - Math.cos(a.yaw) }, a.yaw);
    const eddies = sim.domain.wallet.eddies;
    takeDown(sim, lethal);
    expect([...sim.world].find((e) => e.id === m0)?.downed).toBeDefined();
    run(sim, 2);
    expect(ended).toEqual([{ encounterId: run0.id, outcome: "won" }]);
    expect(sim.domain.wallet.eddies).toBe(eddies + MICRO_EVENT_REWARD.mugging.eddies);
    const loaded = Simulation.fromSnapshot(roundTrip(sim.snapshot(null, "t", "")));
    const again = collect(loaded, "EncounterEnded");
    teleportPlayer(sim, ALLEY_START);
    teleportPlayer(loaded, ALLEY_START);
    run(sim, 2);
    run(loaded, 2);
    expect([ended.length, again]).toEqual([1, []]);
    expect([sim.domain.wallet.eddies, loaded.domain.wallet.eddies]).toEqual([eddies + MICRO_EVENT_REWARD.mugging.eddies, eddies + MICRO_EVENT_REWARD.mugging.eddies]);
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
