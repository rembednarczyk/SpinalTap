import { describe, expect, it } from "vitest";
import { DIFFICULTY_PRESETS, type DomainState, type SaveSnapshot } from "@seki/core";
import { Simulation, gangerEntity, runReplay, stateHash, type ReplayFrame } from "../src";
import { input, run, streetSim } from "./helpers";

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
 * A scripted run: out of the clinic, sprint east down the deptak towards Plac Łokietka, look around,
 * creep forward crouched, then fire at whatever is ahead while strafing, half of the time
 * crouched, then aimed down sights.
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
  // Aim down sights (ADR-0019): walk in slowly, fire aimed, let go halfway.
  for (let i = 0; i < 120; i++) frames.push({ input: input({ aim: i < 90, fire: i >= 20, moveZ: i % 60 < 30 ? 1 : 0, lookYaw: i % 40 < 20 ? 0.002 : -0.002 }) });
  // Weapon handling (ADR-0015): reload, an empty slot, holster, draw again and keep firing.
  frames.push({ input: input({ reload: true }) });
  for (let i = 0; i < 40; i++) frames.push({ input: input() });
  frames.push({ input: input({ weaponSlot: 3 }) });
  frames.push({ input: input({ toggleWeapon: true }) });
  frames.push({ input: input({ weaponSlot: 2 }) });
  for (let i = 0; i < 120; i++) frames.push({ input: input({ fire: true, lookYaw: i % 60 < 30 ? 0.003 : -0.003 }) });
  return frames;
};

const hashOf = (sim: Simulation) => stateHash(sim.snapshot(null, "test", ""));

/**
 * The hash of a run as schema v17 had it, before the difficulty (ADR-0066): without the profile.
 * "normal" changes no rule, so its runs hash to the goldens recorded before v18.
 */
const v17HashOf = (sim: Simulation) => {
  const snap = sim.snapshot(null, "test", "");
  const { difficulty: _d, ...domain } = snap.domain;
  return stateHash({ ...snap, version: 17, domain } as unknown as SaveSnapshot);
};

/**
 * The hash of a run as schema v19 had it, before a waiting difficulty was saved (G-171): with no
 * profile waiting the snapshot differs in the version only, so it hashes to the goldens of v19.
 */
const v19HashOf = (sim: Simulation) => {
  const snap = sim.snapshot(null, "test", "");
  expect(snap.pendingDifficulty).toBeUndefined();
  return stateHash({ ...snap, version: 19 } as unknown as SaveSnapshot);
};

/** The scripted run on "hard" (ADR-0066): the profile set by command in its first frame. */
const hardScript = (): ReplayFrame[] => {
  const [first, ...rest] = script();
  if (!first) return rest;
  return [{ ...first, commands: [{ type: "set-difficulty", profile: DIFFICULTY_PRESETS.hard }, ...(first.commands ?? [])] }, ...rest];
};

describe("determinism", () => {
  it("same seed + same input stream = same end state", () => {
    const a = runReplay(1234, script());
    const b = runReplay(1234, script());
    expect(hashOf(a)).toBe(hashOf(b));
    expect(a.tick).toBe(1159);
  });

  it("a different seed diverges once randomness is involved", () => {
    expect(hashOf(runReplay(1234, script()))).not.toBe(hashOf(runReplay(4321, script())));
  });

  it("matches the recorded golden hash (update deliberately when rules change)", () => {
    const sim = runReplay(1234, script());
    expect(hashOf(sim)).toMatchInlineSnapshot(`"9957ac6d"`);
    // Re-recorded for the v18 field (ADR-0066), the v19 version (ADR-0065, no new rule) and the v20
    // version (G-171, no new rule); without the field, as v17, it is the golden of before, and as
    // v19 the golden of v19.
    expect(v17HashOf(sim)).toBe("c52fd247");
    expect(v19HashOf(sim)).toBe("ef63b731");
  });

  it("the same run on 'hard' has a golden hash of its own (ADR-0066)", () => {
    const sim = runReplay(1234, hardScript());
    expect(sim.domain.difficulty).toEqual(DIFFICULTY_PRESETS.hard);
    expect(hashOf(sim)).toBe(hashOf(runReplay(1234, hardScript())));
    expect(hashOf(sim)).toMatchInlineSnapshot(`"92bfb504"`);
    // Not just the field: without it the run still ends elsewhere than on "normal".
    expect(v17HashOf(sim)).not.toBe("c52fd247");
    expect(v19HashOf(sim)).toBe("e296d440");
  });

  it("the crowd of residents (ADR-0041) and the traffic (ADR-0050) leave the golden run as it was, at every density", () => {
    const golden = hashOf(runReplay(1234, script()));
    for (const crowd of ["low", "high"] as const) {
      const sim = runReplay(1234, script(), crowd);
      expect([...sim.world].some((e) => e.view?.kind === "crowd")).toBe(true);
      // The traffic follows the crowd's density: cars on Lubartowska and Królewska by Plac Łokietka.
      if (crowd === "high") expect([...sim.world].some((e) => e.vehicle !== undefined)).toBe(true);
      expect(hashOf(sim)).toBe(golden);
    }
  });

  it("without the v13 fields of ADR-0033, the v17 progression and the v18 difficulty the replay hashes as with sim B of wave 2 (fields, not rules)", () => {
    const snap = runReplay(1234, script()).snapshot(null, "test", "");
    // The v17 progression (ADR-0059) is left out as well: the run's XP changes no rule it hashes.
    // So is the v18 difficulty (ADR-0066): "normal" changes no rule either.
    const { buffs: _b, capacityShards: _c, disguise: _d, progression: _p, difficulty: _f, ...domain } = snap.domain;
    const { doors: _doors, ...rest } = snap;
    // Re-recorded for ADR-0038 (the run starts in the clinic) and ADR-0045 (the clinic is on
    // Krakowskie Przedmieście), and for the car wash moved off Plac Łokietka into the yard behind
    // it; the v14 door states are left out too.
    expect(stateHash({ ...rest, version: 12, domain } as unknown as SaveSnapshot)).toBe("380539e5");
  });

  it("a loaded snapshot continues exactly like the original run", () => {
    const frames = script();
    // Split while standing with a settled aim: crouch and bloom are transient and not saved (ADR-0016).
    const original = runReplay(1234, frames.slice(0, 455));
    const restored = Simulation.fromSnapshot(original.snapshot(null, "mid", ""));
    expect(hashOf(restored)).toBe(hashOf(original));
    for (const f of frames.slice(455)) {
      original.step(f.input);
      restored.step(f.input);
    }
    expect(hashOf(restored)).toBe(hashOf(original));
  });

  it("a melee duel replays to its golden hash (ADR-0019)", () => {
    const duel = () => {
      const base = streetSim({ seed: 77 });
      const snap = base.snapshot(null, "t", "");
      const d: DomainState = snap.domain;
      const domain: DomainState = {
        ...d,
        inventory: { ...d.inventory, items: [...d.inventory.items, { uid: "i9", def: "baton", rarity: "common" }], nextUid: d.inventory.nextUid + 1 },
        equipment: { ...d.equipment, melee: "i9", active: "melee" },
      };
      const sim = Simulation.fromSnapshot({ ...snap, domain });
      const p = sim.player()!;
      const b = gangerEntity(4000, { key: "brawler", position: { x: p.position.x, y: p.position.y, z: p.position.z + 4 }, yaw: Math.PI }, null, 90, p.chunk ?? "", undefined, "hebi_brawler");
      b.ai!.alerted = true;
      sim.world.add(b);
      const seen: string[] = [];
      for (const t of ["MeleeSwing", "AttackBlocked", "Staggered", "DamageDealt"] as const) sim.bus.on(t, () => seen.push(t));
      // Guard, parry attempts, combos, a step back during a windup.
      for (let i = 0; i < 600; i++) {
        const phase = i % 150;
        sim.step(input({ aim: phase >= 40 && phase < 70, fire: phase >= 80 && phase < 120, moveZ: phase >= 130 ? -1 : 0, lookYaw: i % 50 < 25 ? 0.003 : -0.003 }));
      }
      return { sim, seen };
    };
    const { sim, seen } = duel();
    // Swings both ways, a blocked blow and staggers: the duel exercises the whole package.
    for (const t of ["MeleeSwing", "AttackBlocked", "Staggered", "DamageDealt"]) expect(seen).toContain(t);
    expect(hashOf(sim)).toBe(hashOf(duel().sim));
    expect(hashOf(sim)).toMatchInlineSnapshot(`"1d2880c1"`);
    expect(v17HashOf(sim)).toBe("62992d7b");
    expect(v19HashOf(sim)).toBe("36a75c45");
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
