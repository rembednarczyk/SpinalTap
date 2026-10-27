import { describe, expect, it } from "vitest";
import type { DomainState } from "@seki/core";
import { Simulation, gangerEntity, runReplay, stateHash, type ReplayFrame } from "../src";
import { input, run } from "./helpers";

/**
 * A scripted run: walk north into the alley, look around, creep forward crouched, then fire at
 * whatever is ahead while strafing, half of the time crouched, then aimed down sights.
 */
const script = (): ReplayFrame[] => {
  const frames: ReplayFrame[] = [];
  frames.push({ input: input(), commands: [{ type: "set-flag", flag: "met_fixer" }] });
  for (let i = 0; i < 420; i++) frames.push({ input: input({ moveZ: 1, sprint: true }) });
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
    expect(a.tick).toBe(1155);
  });

  it("a different seed diverges once randomness is involved", () => {
    expect(hashOf(runReplay(1234, script()))).not.toBe(hashOf(runReplay(4321, script())));
  });

  it("matches the recorded golden hash (update deliberately when rules change)", () => {
    expect(hashOf(runReplay(1234, script()))).toMatchInlineSnapshot(`"5c60913b"`);
  });

  it("a loaded snapshot continues exactly like the original run", () => {
    const frames = script();
    // Split while standing with a settled aim: crouch and bloom are transient and not saved (ADR-0016).
    const original = runReplay(1234, frames.slice(0, 451));
    const restored = Simulation.fromSnapshot(original.snapshot(null, "mid", ""));
    expect(hashOf(restored)).toBe(hashOf(original));
    for (const f of frames.slice(451)) {
      original.step(f.input);
      restored.step(f.input);
    }
    expect(hashOf(restored)).toBe(hashOf(original));
  });

  it("a melee duel replays to its golden hash (ADR-0019)", () => {
    const duel = () => {
      const base = Simulation.create({ seed: 77 });
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
    expect(hashOf(sim)).toMatchInlineSnapshot(`"4ddb6f18"`);
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
