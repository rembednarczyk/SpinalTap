import { describe, expect, it } from "vitest";
import { DIFFICULTY_PRESETS, type DomainEvents } from "@seki/core";
import { Simulation, runReplay, stateHash, type ReplayFrame } from "../src";
import { FLOOR, FLOOR_SAVE_AT, floorRun, floorScript, floorSim, play } from "./fixtures/determinism-floor";
import { input, run } from "./helpers";

const hashOf = (sim: Simulation) => stateHash(sim.snapshot(null, "test", ""));

/**
 * Determinism on the test floor (decision of 16.11): a small world of its own (`fixtures/determinism-floor.ts`)
 * far from the city, so the golden hash depends on the rules of the simulation and the floor alone.
 * No change of Lublin's content or its tables moves it (`determinism-floor-content.test.ts`); the
 * map is guarded by generating its tables again (CI's Map tables job, ADR-0083). Update the golden hash only by hand
 * (`vitest -u`) and say in the commit which rule changed it; `pnpm hashes:check --write` refuses it.
 */
describe("determinism on the test floor", () => {
  /** The events of the floor's run, counted: the run gives every part of the step work. */
  const EVENTS = ["ShotFired", "DamageDealt", "EntityKilled", "LootDropped", "MeleeSwing", "Staggered", "CrowdReacted", "CrimeReported", "AwarenessChanged", "ReloadStarted", "WeaponToggled", "ItemUsed", "ExperienceGained"] as const satisfies readonly (keyof DomainEvents)[];

  it("same seed + same input stream = same end state, the player, the Hebi, the bystander and the crowd all at work", () => {
    const a = floorSim(1234);
    const seen = new Map<string, number>();
    for (const t of EVENTS) a.bus.on(t, () => seen.set(t, (seen.get(t) ?? 0) + 1));
    play(a, floorScript());
    const b = floorRun(1234);
    expect(hashOf(a)).toBe(hashOf(b));
    expect(a.tick).toBe(1331);
    for (const t of EVENTS) expect(seen.get(t) ?? 0, t).toBeGreaterThan(0);
    // The player lives through it; the residents are still about (not saved: none in a loaded game).
    expect(a.player()?.health?.current ?? 0).toBeGreaterThan(0);
    expect([...a.world].filter((e) => e.view?.kind === "crowd")).toHaveLength(5);
  });

  it("three fresh runs in a row end the same, whichever simulation of the file each one is", () => {
    // `floorSim` makes two simulations (a new game and its kit loaded into it), so runs in a row
    // would all step the 2nd, 4th, 6th one: a leak of module state that changes every other
    // simulation would pass unseen. A spare simulation shifts the next runs by one (the stepped
    // ones are the n+2nd, n+5th and n+7th of the file), so the three cover both parities.
    const first = hashOf(floorRun(1234));
    Simulation.create({ seed: 1234, chunks: FLOOR });
    const second = hashOf(floorRun(1234));
    const third = hashOf(floorRun(1234));
    expect([second, third]).toEqual([first, first]);
  });

  it("a different seed diverges once randomness is involved", () => {
    expect(hashOf(floorRun(1234))).not.toBe(hashOf(floorRun(4321)));
  });

  it("matches the recorded golden hash (update by hand, with the reason, only when a rule changes)", () => {
    // v42 (ADR-0082 stage 3b, the loud way: optional contract fields, none in this run) changes only
    // the version: with SAVE_SCHEMA_VERSION at 41 the run hashes to d2d12bd1, the golden of before.
    // v43 (G-901, the last threat in the save): the run ends with lastThreat { tick 1204,
    // floor-ganger }; without the field and at version 42 it hashes to fc3fc982, the golden of before.
    // v44 (G-913, the step onto a ladder's rungs in the save, no ladder on the floor) changes only
    // the version: with SAVE_SCHEMA_VERSION at 43 the run hashes to 936bb239, the golden of before.
    // v48 (ADR-0091 stage 2, the gangs' standings per district; nobody's grudge on the floor, an
    // empty map): without `domain.gangStandings` and at version 47 the run hashes to 9040c483, the golden of before.
    // v49 (ADR-0091 stage 5, the street's board: slot 5 of day 1, nothing done, the floor in no
    // district): without `domain.streetCrimes` and at version 48 the run hashes to ce128c9e, the golden of before.
    // v50 (ADR-0074 stage 5d2, Hebi's stash into Alchemia's shelter; nothing of it on the floor) changes
    // only the version: with SAVE_SCHEMA_VERSION at 49 the run hashes to 5c7c3abb, the golden of before.
    expect(hashOf(floorRun(1234))).toMatchInlineSnapshot(`"d6e95343"`);
  });

  it("the same run on 'hard' (ADR-0066) ends elsewhere, and the same each time", () => {
    const hard = floorRun(1234, floorScript(), DIFFICULTY_PRESETS.hard);
    expect(hard.domain.difficulty).toEqual(DIFFICULTY_PRESETS.hard);
    expect(hashOf(hard)).toBe(hashOf(floorRun(1234, floorScript(), DIFFICULTY_PRESETS.hard)));
    expect(hashOf(hard)).not.toBe(hashOf(floorRun(1234)));
  });

  it("the crowd of residents (ADR-0041) is not saved and changes no outcome", () => {
    const frames = floorScript();
    const without = floorSim(1234);
    for (const e of [...without.world]) if (e.view?.kind === "crowd") without.world.remove(e);
    expect(hashOf(play(without, frames))).toBe(hashOf(floorRun(1234, frames)));
  });

  it("a loaded snapshot continues exactly like the original run, through the whole fight", () => {
    const frames = floorScript();
    const original = play(floorSim(1234), frames.slice(0, FLOOR_SAVE_AT));
    // Through JSON, as a save on disk; the floor instead of the city, no crowd (it is not saved).
    const restored = Simulation.fromSnapshot(JSON.parse(JSON.stringify(original.snapshot(null, "mid", ""))), undefined, "off", "off", FLOOR);
    expect(hashOf(restored)).toBe(hashOf(original));
    const rest = frames.slice(FLOOR_SAVE_AT);
    play(original, rest);
    play(restored, rest);
    expect(hashOf(restored)).toBe(hashOf(original));
  });

  it("saved and loaded at every 50th step of the fight, the game goes on as the one saved from (G-883)", () => {
    // Saved as the game saves (`calmForSave` first, ADR-0029: the street's fear is not saved), each
    // load goes on to the next save, and the last one to the end: crouched, in the air, aiming,
    // mid-reload, mid-draw, mid-swing and staggered, as the run is at these steps.
    const frames = floorScript();
    const original = floorSim(1234);
    const loads: { at: number; sim: Simulation }[] = [];
    const differ: number[] = [];
    let done = 0;
    for (const at of [...Array.from({ length: 17 }, (_, i) => 200 + 50 * i), frames.length]) {
      play(original, frames.slice(done, at));
      done = at;
      const last = loads.at(-1);
      if (last) {
        play(last.sim, frames.slice(last.at, at));
        if (hashOf(last.sim) !== hashOf(original)) differ.push(last.at);
      }
      if (at === frames.length) break;
      original.calmForSave();
      loads.push({ at, sim: Simulation.fromSnapshot(JSON.parse(JSON.stringify(original.snapshot(null, "mid", ""))), undefined, "off", "off", FLOOR) });
    }
    expect(loads).toHaveLength(17);
    expect(differ).toEqual([]);
  });
});

/**
 * Out of Mori's clinic, where a new game starts (ADR-0038): off the chair, through the doorway
 * in the partition, out of the automatic door onto the deptak, facing east along it again
 * (the clinic is a room of a tenement on Krakowskie Przedmieście since ADR-0045).
 */
const outOfTheClinic = (): ReplayFrame[] => {
  const walk = (n: number): ReplayFrame[] => Array.from({ length: n }, () => ({ input: input({ moveZ: 1 }) }));
  const turn = (yaw: number): ReplayFrame => ({ input: input({ lookYaw: yaw }) });
  return [...walk(43), turn(Math.PI / 2), ...walk(80), turn(Math.PI / 2), ...walk(17), turn(-Math.PI / 2), ...walk(130), turn(-Math.PI / 2)];
};

/**
 * A scripted run in Lublin: out of the clinic, sprint east down the deptak towards Plac Łokietka,
 * look around, creep forward crouched, then fire at whatever is ahead while strafing, half of the
 * time crouched, then aimed down sights, then reload, holster and draw.
 */
const script = (): ReplayFrame[] => {
  const frames: ReplayFrame[] = [];
  frames.push({ input: input(), commands: [{ type: "set-flag", flag: "met_fixer" }] });
  frames.push(...outOfTheClinic());
  for (let i = 0; i < 150; i++) frames.push({ input: input({ moveZ: 1, sprint: true }) });
  for (let i = 0; i < 30; i++) frames.push({ input: input({ lookYaw: 0.01, lookPitch: 0.002 }) });
  for (let i = 0; i < 60; i++) frames.push({ input: input({ moveZ: 1, crouch: true }) });
  for (let i = 0; i < 360; i++) {
    frames.push({ input: input({ fire: true, crouch: i % 180 >= 90, moveX: i % 120 < 60 ? 1 : -1, lookYaw: i % 90 < 45 ? -0.004 : 0.004 }) });
  }
  for (let i = 0; i < 120; i++) frames.push({ input: input({ aim: i < 90, fire: i >= 20, moveZ: i % 60 < 30 ? 1 : 0, lookYaw: i % 40 < 20 ? 0.002 : -0.002 }) });
  frames.push({ input: input({ reload: true }) });
  for (let i = 0; i < 40; i++) frames.push({ input: input() });
  frames.push({ input: input({ weaponSlot: 3 }) });
  frames.push({ input: input({ toggleWeapon: true }) });
  frames.push({ input: input({ weaponSlot: 2 }) });
  for (let i = 0; i < 120; i++) frames.push({ input: input({ fire: true, lookYaw: i % 60 < 30 ? 0.003 : -0.003 }) });
  return frames;
};

/**
 * Determinism in the city: two runs of the same script end in the same state. No golden hash
 * here, so a change of the map needs no update; the floor above holds the golden one.
 */
describe("determinism", () => {
  it("same seed + same input stream = same end state", () => {
    const a = runReplay(1234, script());
    const b = runReplay(1234, script());
    expect(hashOf(a)).toBe(hashOf(b));
    expect(a.tick).toBe(1159);
  });

  it("restores killed NPCs as absent", () => {
    const sim = Simulation.create({ seed: 1 });
    sim.enqueue({ type: "set-flag", flag: "dead:guard" });
    run(sim, 1);
    const restored = Simulation.fromSnapshot(sim.snapshot(null, "x", ""));
    expect([...restored.world].some((e) => e.key === "guard")).toBe(false);
    expect([...restored.world].some((e) => e.key === "courier")).toBe(true);
  });
});
