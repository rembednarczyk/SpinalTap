import { describe, expect, it } from "vitest";
import type { DomainState, SaveSnapshot } from "@seki/core";
import { Simulation, gangerEntity, runReplay, stateHash, type ReplayFrame } from "../src";
import { input, run, streetSim } from "./helpers";

/**
 * Out of Mori's clinic, where a new game starts (ADR-0038): off the chair, through the doorway
 * in the partition, out of the automatic door onto the street, facing north again.
 */
const outOfTheClinic = (): ReplayFrame[] => {
  const walk = (n: number): ReplayFrame[] => Array.from({ length: n }, () => ({ input: input({ moveZ: 1 }) }));
  const turn = (yaw: number): ReplayFrame => ({ input: input({ lookYaw: yaw }) });
  return [...walk(43), turn(Math.PI / 2), ...walk(80), turn(Math.PI / 2), ...walk(17), turn(-Math.PI / 2), ...walk(130), turn(-Math.PI / 2)];
};

/**
 * A scripted run: out of the clinic, walk north up the street towards the alley, look around,
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
    expect(hashOf(runReplay(1234, script()))).toMatchInlineSnapshot(`"181fbc08"`);
  });

  it("without the street life of ADR-0026 in the snapshot, the run hashes as before it (content, not rules)", () => {
    // The run reaches the alley: Ulica Kanałowa streams in with its four new people, and the
    // stashes behind Neon Koi, behind PACHINKO and by the passage are placed. Nothing else moved.
    const snap = runReplay(1234, script()).snapshot(null, "test", "");
    const added = new Set(["hideo", "tetsu", "mei", "sachiko"]);
    const stash = /^(placed:)?stash:(s7|kanal)-/;
    // Wave 2 left the run alone and only added fields to the save: the metro and the encounters
    // of ADR-0034 (v12), the buffs, the shards and the disguise of ADR-0033 (v13).
    const { metro: _metro, encounters: _encounters, buffs, capacityShards, disguise, ...domain } = snap.domain;
    expect({ buffs, capacityShards, disguise }).toEqual({ buffs: [], capacityShards: 0, disguise: { role: null, blown: false } });
    const { doors: _doors, ...rest } = snap;
    const before = {
      ...rest,
      version: 11,
      entities: snap.entities.filter((e) => !added.has(e.key)),
      domain: {
        ...domain,
        flags: snap.domain.flags.filter((f) => !stash.test(f)),
        loot: { ...snap.domain.loot, containers: snap.domain.loot.containers.filter((c) => !stash.test(c.key)) },
      },
    } as unknown as SaveSnapshot;
    expect(snap.entities.filter((e) => added.has(e.key))).toHaveLength(4);
    // The hash of the same run with the rules of ADR-0029 (wave 1), without this content and the wave 2 fields.
    // Re-recorded for ADR-0038: the run now starts in Mori's clinic and walks out of its door.
    expect(stateHash(before)).toBe("35b2130d");
  });

  it("without the v13 fields of ADR-0033 the replay hashes as with sim B of wave 2 (fields, not rules)", () => {
    const snap = runReplay(1234, script()).snapshot(null, "test", "");
    const { buffs: _b, capacityShards: _c, disguise: _d, ...domain } = snap.domain;
    const { doors: _doors, ...rest } = snap;
    // Re-recorded for ADR-0038 (the run starts in the clinic); the v14 door states are left out too.
    expect(stateHash({ ...rest, version: 12, domain } as unknown as SaveSnapshot)).toBe("09a78a85");
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
      const b = gangerEntity(4000, { key: "brawler", position: { x: p.position.x, y: 0, z: p.position.z + 4 }, yaw: Math.PI }, null, 90, p.chunk ?? "", undefined, "hebi_brawler");
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
    expect(hashOf(sim)).toMatchInlineSnapshot(`"74312929"`);
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
